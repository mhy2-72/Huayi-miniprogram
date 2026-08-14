// cloudfunctions/aiChat/index.js
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const API_KEY = 'sk-9827580dc83347dbabbe4496e9486ae2'; 

const API_URL = 'https://api.deepseek.com/chat/completions';
// ---------------------------
exports.main = async (event, context) => {
  const { userInput, history } = event;

  // 构造传给大模型的消息数组 (维持对话上下文)
  const messages = [];
  
  // 如果有历史记录，先放进去（让 AI 记住之前聊了什么）
  if (history && history.length > 0) {
    history.forEach(item => {
      messages.push({
        role: item.role === 'user' ? 'user' : 'assistant',
        content: item.content
      });
    });
  } else {
    // 如果没有历史记录，给一个系统预设，让它更懂你的业务
    messages.push({
      role: 'system',
      content: '你是一个专业的小程序任务助手，专门解答关于上海市虹口区的问题。回答要热情、简洁、友好。'
    });
  }

  // 最后加上用户当前问的问题
  messages.push({ role: 'user', content: userInput });

  try {
    const response = await axios.post(
      API_URL,
      {
        model: 'deepseek-chat',          // 使用的模型名称
        messages: messages,      // 聊天上下文
        temperature: 0.7,
        stream:false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    );

    // 提取 AI 返回的回答文本
    const reply = response.data.choices[0].message.content;

    // 成功返回给小程序前端
    return {
      code: 0,
      reply: reply
    };

  } catch (error) {
    console.error('调用 AI 接口出错:', error);
    
    // 把具体的报错信息打印出来，方便调试
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }

    // 失败返回给前端
    return {
      code: -1,
      msg: 'AI 暂时无法回复，请稍后重试'
    };
  }
};