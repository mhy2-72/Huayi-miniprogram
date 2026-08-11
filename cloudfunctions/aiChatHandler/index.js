const cloud = require('wx-server-sdk');
cloud.init();
const axios = require('axios');

// 关键词匹配（新格式：发布任务：[任务名] 等）
const taskHandlers = [
  { 
    pattern: /^发布任务：(.+)$/, 
    funcName: 'AIpublishTask', 
    extract: (match) => ({ taskName: match[1].trim() }) 
  },
  { 
    pattern: /^查询任务：(.+)$/, 
    funcName: 'AIgetTaskByName', 
    extract: (match) => ({ taskName: match[1].trim() }) 
  },
  { 
    pattern: /^评价任务：(.+)为(\d+)星$/, 
    funcName: 'AIconfirmTask', 
    extract: (match) => ({ taskName: match[1].trim(), rating: parseInt(match[2]) || 5 }) 
  },
  { 
    pattern: /^取消任务：(.+)$/, 
    funcName: 'AIcancelTask', 
    extract: (match) => ({ taskName: match[1].trim() }) 
  }
];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { text } = event;

  let reply = '';

  // 1. 检查是否是任务指令
  for (const handler of taskHandlers) {
    const match = text.match(handler.pattern);
    if (match) {
      const params = handler.extract(match);
      try {
        const res = await cloud.callFunction({
          name: handler.funcName,
          data: { openid, ...params }
        });
        reply = res.result.reply || '操作完成';
      } catch (e) {
        console.error(`调用${handler.funcName}失败`, e);
        reply = '服务暂时开小差了，请稍后重试';
      }
      break;
    }
  }

  // 2. 如果没有任务指令，调用 DeepSeek 对话
  if (!reply) {
    try {
      reply = await callAI(text);
    } catch (e) {
      console.error('AI调用失败', e);
      reply = '我有点迷糊，请再说一次吧';
    }
  }

  // 3. 生成语音（如果 TTS 已实现）
  let voiceFileID = '';
  try {
    voiceFileID = await textToSpeech(reply);
  } catch (e) {
    console.error('TTS生成失败', e);
  }

  return { reply, voiceFileID };
};

// 调用 DeepSeek API
async function callAI(prompt) {
  const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个贴心的老年生活助手，回答简洁温暖。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 500
  }, {
    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
  });
  return res.data.choices[0].message.content;
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