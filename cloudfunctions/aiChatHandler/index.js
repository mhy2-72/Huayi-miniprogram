// cloudfunctions/aiChatHandler/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const axios = require('axios');
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { text } = event;

  // 1. 解析操作类型和关键词
  const parsed = parseUserCommand(text);
  if (!parsed) {
    // 未识别为任务操作，当作普通对话
    return await handleNormalChat(text, openid);
  }

  const { action, keyword, rating } = parsed;

  // 2. 发布任务 - 先规范化描述，再创建
  if (action === 'publish') {
    return await handlePublish(openid, keyword);
  }

  // 3. 其他操作：需要查找任务
  // 先尝试方案1：正则模糊匹配
  let task = await findTaskByRegex(openid, keyword, action);
  if (!task) {
    // 方案2：AI辅助匹配
    task = await findTaskByAI(openid, keyword, action);
  }

  if (!task) {
    return buildResponse('未查询到您的任务，或任务已完成。请确认任务名称是否正确。');
  }

  // 4. 执行对应操作
  switch (action) {
    case 'getStatus':
      return await handleGetStatus(openid, task);
    case 'confirm':
      return await handleConfirm(openid, task, rating);
    case 'cancel':
      return await handleCancel(openid, task);
    default:
      return buildResponse('未知操作');
  }
};

// ---------- 辅助函数 ----------
function buildResponse(reply, actionResult = null) {
  return { reply, voiceFileID: '', actionResult };
}

async function handleNormalChat(text, openid) {
  const aiResponse = await callAI(text);
  const voiceFileID = await textToSpeech(aiResponse);
  return { reply: aiResponse, voiceFileID, actionResult: null };
}

// ---------- 发布任务（增加规范化） ----------
async function handlePublish(openid, rawTaskName) {
  // 1. 调用大模型规范化描述
  let normalized = rawTaskName;
  try {
    const normPrompt = `请用简洁清晰的白话描述以下任务需求，不超过20个字：${rawTaskName}`;
    const normRes = await callAISimple(normPrompt, 20); // 限制输出长度
    if (normRes && normRes.length > 0) {
      normalized = normRes.trim();
    }
  } catch (e) {
    console.warn('规范化任务描述失败，使用原始输入', e);
  }

  // 2. 调用发布云函数
  const result = await cloud.callFunction({
    name: 'AIpublishTask',
    data: { openid, taskName: normalized }
  });

  const reply = result.result.reply;
  const actionResult = { ...result.result, action: 'publish' };
  const voiceFileID = await textToSpeech(reply);
  return { reply, voiceFileID, actionResult };
}

async function handleGetStatus(openid, task) {
  const role = task.elderId === openid ? '发布' : '接取';
  const reply = `您${role}的任务“${task.description}”当前状态为“${statusMap[task.status] || task.status}”${task.status === 'cancelled' ? '（取消原因：' + (task.cancelReason || '无') + '）' : ''}`;
  const voiceFileID = await textToSpeech(reply);
  return { reply, voiceFileID, actionResult: { action: 'getStatus', code: 0, taskId: task._id } };
}

async function handleConfirm(openid, task, rating) {
  const result = await cloud.callFunction({
    name: 'AIconfirmTask',
    data: { taskId: task._id, rating }
  });
  const reply = result.result.reply;
  const voiceFileID = await textToSpeech(reply);
  return { reply, voiceFileID, actionResult: { ...result.result, action: 'confirm' } };
}

async function handleCancel(openid, task) {
  const result = await cloud.callFunction({
    name: 'AIcancelTask',
    data: { taskId: task._id }
  });
  const reply = result.result.reply;
  const voiceFileID = await textToSpeech(reply);
  return { reply, voiceFileID, actionResult: { ...result.result, action: 'cancel' } };
}

// ---------- 查找任务：方案1 正则模糊 ----------
async function findTaskByRegex(openid, keyword, action) {
  const regex = new RegExp(keyword, 'i');
  let where = { description: regex, status: _.neq('completed') };
  if (action === 'getStatus') {
    where = { ...where, $or: [{ elderId: openid }, { youthId: openid }] };
  } else if (action === 'confirm') {
    where = { ...where, elderId: openid, status: 'submitted' };
  } else if (action === 'cancel') {
    where = { ...where, $or: [{ elderId: openid, status: 'published' }, { youthId: openid, status: 'accepted' }] };
  }
  const tasks = await db.collection('tasks').where(where).limit(1).get();
  if (tasks.data.length > 0) {
    const t = tasks.data[0];
    t.isElder = t.elderId === openid;
    return t;
  }
  return null;
}

// ---------- 查找任务：方案2 AI辅助匹配 ----------
async function findTaskByAI(openid, keyword, action) {
  // 获取当前用户所有未完成的任务（仅 id 和 description）
  let query = { status: _.neq('completed') };
  if (action === 'getStatus') {
    query.$or = [{ elderId: openid }, { youthId: openid }];
  } else if (action === 'confirm') {
    query = { ...query, elderId: openid, status: 'submitted' };
  } else if (action === 'cancel') {
    query = { ...query, $or: [{ elderId: openid, status: 'published' }, { youthId: openid, status: 'accepted' }] };
  }
  const tasks = await db.collection('tasks')
    .where(query)
    .field({ _id: true, description: true, elderId: true })
    .limit(50)
    .get();

  if (tasks.data.length === 0) return null;

  // 构建任务列表，标注角色
  const taskList = tasks.data.map(t => {
    const role = t.elderId === openid ? '发布' : '接取';
    return `ID:${t._id} 您${role}的任务："${t.description}"`;
  }).join('\n');

  const prompt = `用户输入："${keyword}"\n以下是用户相关的任务列表：\n${taskList}\n请根据用户输入，选择最匹配的任务ID。如果找不到，请只回答"null"。只输出任务ID或null，不要有其他内容。`;
  const aiResponse = await callAISimple(prompt, 20);
  const matchedId = aiResponse.trim();
  if (matchedId !== 'null' && matchedId) {
    const task = await db.collection('tasks').doc(matchedId).get().catch(() => null);
    if (task && task.data && task.data.status !== 'completed') {
      task.data.isElder = task.data.elderId === openid;
      return task.data;
    }
  }
  return null;
}

// ---------- 调用大模型（普通对话） ----------
async function callAI(prompt) {
  const systemPrompt = `你是一个助老服务助手。回答要热情、简洁、友好。`;
  const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 500
  }, {
    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
  });
  return res.data.choices[0].message.content.trim();
}

// ---------- 调用大模型（简单问答，用于匹配和规范化） ----------
async function callAISimple(prompt, maxTokens = 50) {
  const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个任务处理助手，只输出必要信息，不要有多余内容。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: maxTokens || 50
  }, {
    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
  });
  return res.data.choices[0].message.content.trim();
}

// ---------- 解析用户指令 ----------
function parseUserCommand(text) {
  let match = text.match(/^(发布|创建|新增)\s*(.*?)\s*(?:任务)?$/);
  if (match && match[2]) {
    return { action: 'publish', keyword: match[2].trim() };
  }
  match = text.match(/^(查询|查看|状态|检查|看看)\s*(.*?)\s*(?:任务)?$/);
  if (match && match[2]) {
    return { action: 'getStatus', keyword: match[2].trim() };
  }
  match = text.match(/^(评价|打分|评星)\s*(.*?)\s*(?:为|得|给|打)\s*(\d)\s*星?/);
  if (match && match[2]) {
    const rating = parseInt(match[3]) || 5;
    return { action: 'confirm', keyword: match[2].trim(), rating };
  }
  match = text.match(/^(取消|撤销|删除)\s*(.*?)\s*(?:任务)?$/);
  if (match && match[2]) {
    return { action: 'cancel', keyword: match[2].trim() };
  }
  return null;
}

// ---------- TTS ----------
async function textToSpeech(text) {
  try {
    const res = await cloud.callFunction({
      name: 'textToSpeech',
      data: { text }
    });
    return res.result.fileID || '';
  } catch (e) {
    console.error('TTS调用失败', e);
    return '';
  }
}

const statusMap = {
  published: '待接取',
  accepted: '进行中',
  submitted: '待评价',
  completed: '已完成',
  cancelled: '已取消'
};