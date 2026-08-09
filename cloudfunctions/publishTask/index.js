//cloudfunctions\publishTask\index.js
const cloud = require('wx-server-sdk');
const axios = require('axios'); // 引入axios
cloud.init();
const db = cloud.database();

function detectDifficulty(description) {
  // 关键词 → 难度映射
  const difficultyMap = [
    //  高难度（3星）
    { keywords: ['法律', '医疗', '教育辅导', '财务', '投资', '保险', '合同', '诉讼', '诊断', '治疗', '辅导', '家教', '理财', '税务', '审计'], level: 3 },
    { keywords: ['搬重物', '换灯泡', '修家具', '通下水道', '家电维修', '修水管', '修电路', '拆装', '高空', '屋顶', '重物'], level: 3 },
    
    //中难度（2星）
    { keywords: ['手机', '电脑', '网络', '打印', '拍照', '视频', '微信', 'app', '软件', '设置', '账号', '密码', '智能', '数码'], level: 2 },
    { keywords: ['手工', '书法', '园艺', '编织', '绘画', '茶艺', '花艺', '种植', '修剪', '插花'], level: 2 },
    { keywords: ['看顾', '陪同', '送医', '急诊', '药房', '挂号', '就诊', '陪同', '守护'], level: 2 },
    { keywords: ['暴雨', '台风', '关窗', '防汛', '紧急', '临时', '急'], level: 2 },
    
    // 低难度（1星）
    { keywords: ['买菜', '取快递', '代取药', '送文件', '购物', '超市', '药店', '快递', '跑腿', '代买', '代送', '外卖'], level: 1 },
    { keywords: ['收纳', '晾晒', '浇花', '喂宠物', '扫地', '拖地', '擦窗', '除尘', '整理', '打扫', '清洁'], level: 1 },
    { keywords: ['聊天', '陪伴', '读报', '读书', '散步', '下棋', '听戏', '看剧', '倾诉', '谈心'], level: 1 },
  ];
  // 转为小写
  const text = description.toLowerCase();
  // 按匹配度加权计算
  let totalScore = 0;
  let matchCount = 0;
  for (const item of difficultyMap) {
    for (const keyword of item.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        totalScore += item.level;
        matchCount++;
        break; 
      }
    }
  }
  if (matchCount > 0) {
    const avg = Math.round(totalScore / matchCount);
    if (avg < 1) return 1;
    if (avg > 3) return 3;
    return avg;
  }
  // 无匹配关键词，默认 2 星
  return 2;
}



exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const elderId = wxContext.OPENID;
  const { description, images } = event;

  const user = await db.collection('users').doc(elderId).get();
  if (user.data.role !== 'elder') return { code: -1, msg: '仅老人可发布任务' };

  // 并发限制改为 1
  const activeCount = await db.collection('tasks').where({
    elderId,
    status: db.command.in(['published', 'accepted', 'submitted'])
  }).count();
  if (activeCount.total >= 1) return { code: -1, msg: '您已有未完成任务，请先完成或取消' };

  const now = new Date();
  const deadline = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  let difficulty = 2;
  try {
    //调用 DeepSeek API
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "你是一个任务难度评估专家。根据用户描述，只输出一个数字：1(简单), 2(中等), 3(困难)。" },
        { role: "user", content: description }
      ],
      temperature: 0.1, // 降低随机性
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` // 使用环境变量
      }
    });
    const aiResult = response.data.choices[0].message.content;
    const parsedDifficulty = parseInt(aiResult.trim());
    if (parsedDifficulty >= 1 && parsedDifficulty <= 3) {
      difficulty = parsedDifficulty;
    }

  } catch (error) {
    console.error('AI API调用失败:', error);
    difficulty = detectDifficulty(description)// 调用关键词匹配函数
  }
  const res = await db.collection('tasks').add({
    data: {
      elderId,
      youthId: null,
      description,
      images: images || [],
      status: 'published',
      createTime: now,
      acceptTime: null,
      difficulty: difficulty,
      deadline,
      submitTime: null,
      completeTime: null,
      evidenceImages: [],
      submitNote: '',
      rating: 0,
      elderPoints: 0,
      youthPoints: 0
    }
  });
  return { code: 0,
     taskId: res._id,
     difficulty: difficulty, 
     msg: '发布成功' };
};