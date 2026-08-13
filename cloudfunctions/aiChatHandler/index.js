// cloudfunctions/aiChatHandler/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const axios = require('axios');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { text } = event;

  let reply = '';
  let voiceFileID = '';
  let actionResult = null;   // 新增：要返回给前端的操作结果

  const aiResponse = await callAI(text);
  console.log('AI原始响应:', aiResponse);

  const parsed = tryParseJSON(aiResponse);

  if (parsed && parsed.action) {
    try {
      const execResult = await executeAction(openid, parsed);

      if (execResult.code === 0) {
        reply = parsed.reply || execResult.reply;
      } else {
        reply = execResult.reply || '操作失败，请重试';
      }

      // 新增：构造 actionResult，前端根据它渲染任务卡片
      actionResult = {
        action: parsed.action,
        code: execResult.code,
        taskId: execResult.taskId || '',
        taskName: (parsed.params && parsed.params.taskName) || execResult.taskName || '',
        rating: (parsed.params && parsed.params.rating) || 5,
        status: execResult.status || '',
        reply: reply
      };
    } catch (e) {
      console.error('执行操作失败:', e);
      reply = '服务暂时开小差了，请稍后重试';
      actionResult = {
        action: parsed.action,
        code: -1,
        reply: reply
      };
    }
  } else {
    reply = aiResponse;
  }

  try {
    voiceFileID = await textToSpeech(reply);
  } catch (e) {
    console.error('TTS生成失败', e);
  }

  // 关键：返回 actionResult
  return { reply, voiceFileID, actionResult };
};

// callAI 保持不变
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
    temperature: 0.3,
    max_tokens: 500
  }, {
    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
  });

  return res.data.choices[0].message.content.trim();
}

// 增强 JSON 解析，兼容 ```json ... ``` 包裹
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    // 尝试提取第一个 JSON 对象
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

// executeAction 保持不变
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

// textToSpeech 保持不变
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