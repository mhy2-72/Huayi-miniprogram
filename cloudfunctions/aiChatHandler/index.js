//cloudfunctions\aiChatHandler\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const axios = require('axios');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { text } = event;

  let reply = '';
  let voiceFileID = '';

  // 调用大模型，获得结构化输出或普通回复
  const aiResponse = await callAI(text);
  console.log('AI原始响应:', aiResponse);

  // 尝试解析 JSON 操作指令
  const parsed = tryParseJSON(aiResponse);

  if (parsed && parsed.action) {
    // 执行对应操作
    try {
      const actionResult = await executeAction(openid, parsed);
      if (actionResult.code === 0) {
        // 操作成功，使用 AI 生成的友好回复
        reply = parsed.reply || actionResult.reply;
      } else {
        // 操作失败，使用云函数返回的错误信息
        reply = actionResult.reply || '操作失败，请重试';
      }
    } catch (e) {
      console.error('执行操作失败:', e);
      reply = '服务暂时开小差了，请稍后重试';
    }
  } else {
    // 普通对话，直接使用 AI 回复
    reply = aiResponse;
  }

  // 生成语音
  try {
    voiceFileID = await textToSpeech(reply);
  } catch (e) {
    console.error('TTS生成失败', e);
  }

  return { reply, voiceFileID };
};

// 调用 DeepSeek API，要求其根据需要输出操作码 JSON
async function callAI(prompt) {
  const systemPrompt = `你是一个助老服务助手。根据用户指令判断是否需要执行以下任务操作：
- 发布任务：发布任务：任务名
- 评价任务：评价任务：任务名为x星
- 取消任务：取消任务：任务名
- 查询任务状态：查询任务：任务名

如果需要执行操作，请只输出JSON，格式如下：
{"action":"publish","params":{"taskName":"任务名"},"reply":"回复给用户的文字"}

action 可选值：publish(发布)、confirm(评价)、cancel(取消)、getStatus(查询)
params 说明：
- publish、cancel、getStatus 只需要 taskName
- confirm 需要 taskName 和 rating（1-5星，若用户未指定默认5星）

如果不需要执行任何操作，请直接输出你的回复文本。`;

  const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,   // 降低随机性，确保输出稳定
    max_tokens: 500
  }, {
    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
  });

  return res.data.choices[0].message.content.trim();
}

// 尝试将字符串解析为 JSON，失败返回 null
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// 根据解析出的操作码调用对应云函数
async function executeAction(openid, actionObj) {
  const { action, params } = actionObj;
  let result;

  switch (action) {
    case 'publish':
      result = await cloud.callFunction({
        name: 'AIpublishTask',
        data: { openid, taskName: params.taskName }
      });
      break;
    case 'confirm':
      result = await cloud.callFunction({
        name: 'AIconfirmTask',
        data: { openid, taskName: params.taskName, rating: params.rating || 5 }
      });
      break;
    case 'cancel':
      result = await cloud.callFunction({
        name: 'AIcancelTask',
        data: { openid, taskName: params.taskName }
      });
      break;
    case 'getStatus':
      result = await cloud.callFunction({
        name: 'AIgetTaskByName',
        data: { openid, taskName: params.taskName }
      });
      break;
    default:
      return { code: -1, reply: '未知操作' };
  }

  return result.result;
}

// 文字转语音（调用 TTS 云函数）
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