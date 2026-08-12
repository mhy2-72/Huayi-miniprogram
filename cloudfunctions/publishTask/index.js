// cloudfunctions/publishTask/index.js
const cloud = require('wx-server-sdk');
const axios = require('axios');
cloud.init();
const db = cloud.database();

// ========== 关键词匹配检测难度 ==========
function detectDifficulty(description) {
  const difficultyMap = [
    { keywords: ['法律', '医疗', '教育辅导', '财务', '投资', '保险', '合同', '诉讼', '诊断', '治疗', '辅导', '家教', '理财', '税务', '审计'], level: 3 },
    { keywords: ['搬重物', '换灯泡', '修家具', '通下水道', '家电维修', '修水管', '修电路', '拆装', '高空', '屋顶', '重物'], level: 3 },
    { keywords: ['手机', '电脑', '网络', '打印', '拍照', '视频', '微信', 'app', '软件', '设置', '账号', '密码', '智能', '数码'], level: 2 },
    { keywords: ['手工', '书法', '园艺', '编织', '绘画', '茶艺', '花艺', '种植', '修剪', '插花'], level: 2 },
    { keywords: ['看顾', '陪同', '送医', '急诊', '药房', '挂号', '就诊', '陪同', '守护'], level: 2 },
    { keywords: ['暴雨', '台风', '关窗', '防汛', '紧急', '临时', '急'], level: 2 },
    { keywords: ['买菜', '取快递', '代取药', '送文件', '购物', '超市', '药店', '快递', '跑腿', '代买', '代送', '外卖'], level: 1 },
    { keywords: ['收纳', '晾晒', '浇花', '喂宠物', '扫地', '拖地', '擦窗', '除尘', '整理', '打扫', '清洁'], level: 1 },
    { keywords: ['聊天', '陪伴', '读报', '读书', '散步', '下棋', '听戏', '看剧', '倾诉', '谈心'], level: 1 },
  ];

  const text = description.toLowerCase();
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
  return 2;
}

// ========== 任务分类 ==========
function classifyTask(description) {
  const taskCategoryMap = [
    {
      category: 'a', //跑腿代办
      keywords: ['买菜', '取快递', '代取药', '送文件', '购物', '超市', '药店', '快递', '跑腿', '代买', '代送', '外卖']
    },
    {
      category: 'b', //技术支持
      keywords: ['手机', '电脑', '网络', '打印', '拍照', '视频', '微信', 'app', '软件', '设置', '账号', '密码', '智能', '数码']
    },
    {
      category: 'c', //家政轻务
      keywords: ['收纳', '晾晒', '浇花', '喂宠物', '扫地', '拖地', '擦窗', '除尘', '整理', '打扫', '清洁']
    },
    {
      category: 'd', //陪伴关怀
      keywords: ['聊天', '陪伴', '读报', '读书', '散步', '下棋', '听戏', '看剧', '倾诉', '谈心']
    },
    {
      category: 'e', //经验分享
      keywords: ['手工', '书法', '园艺', '编织', '绘画', '茶艺', '花艺', '种植', '修剪', '插花']
    },
    {
      category: 'f', //专业服务
      keywords: ['法律', '医疗', '教育辅导', '财务', '投资', '保险', '合同', '诉讼', '诊断', '治疗', '辅导', '家教', '理财', '税务', '审计']
    },
    {
      category: 'g', //体力维修
      keywords: ['搬重物', '换灯泡', '修家具', '通下水道', '家电维修', '修水管', '修电路', '拆装', '高空', '屋顶', '重物']
    },
    {
      category: 'h', //应急互助
      keywords: ['暴雨', '台风', '关窗', '防汛', '紧急', '临时', '急']
    },
  ];
  const text2 = description.toLowerCase();

  for (const item of taskCategoryMap) {
    for (const keywords of item.keywords) {
      if (text2.includes(keywords)) {
        return item.category;
      }
    }
  }
  return 'other';
}

// ========== 检测是否需要资质认证 ==========
function detectCertificationRequired(description) {
  const certKeywords = [
    { keywords: ['法律', '律师', '诉讼', '合同', '法务', '法律咨询', '法律顾问', '起诉', '仲裁', '法律援助'], type: '法律咨询' },
    { keywords: ['医疗', '医生', '诊断', '治疗', '看病', '就医', '健康咨询', '医疗建议', '用药', '处方', '康复', '理疗'], type: '医疗咨询' },
    { keywords: ['辅导', '家教', '教学', '教育', '培训', '补习', '授课', '讲题', '学习方法', '考试', '功课', '作业辅导'], type: '教育辅导' },
    { keywords: ['财务', '投资', '理财', '税务', '审计', '会计', '报税', '财务咨询', '资产管理', '保险', '基金', '股票'], type: '财务咨询' },
  ];

  const text = description.toLowerCase();
  const matched = [];

  for (const item of certKeywords) {
    for (const keyword of item.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matched.push(item.type);
        break;
      }
    }
  }

  if (matched.length > 0) {
    return {
      required: true,
      types: matched,
      message: `该任务涉及${matched.join('、')}，需要上传相关资质证明`
    };
  }

  return {
    required: false,
    types: [],
    message: ''
  };
}

function getAgeGroup(age) {
  if (age >= 12 && age <= 17) return 'teen';
  if (age >= 18 && age <= 35) return 'young';
  if (age >= 36 && age <= 59) return 'middle';
  if (age >= 60) return 'elderly';
  return null;
}

function canPublishTask(ageGroup) {
  switch (ageGroup) {
    case 'teen':
      return { allowed: false, msg: '少年组（12-17岁）不可发布任务' };
    case 'young':
      return { allowed: true, msg: '' };
    case 'middle':
      return { allowed: true, msg: '' };
    case 'elderly':
      return { allowed: true, msg: '' };
    default:
      return { allowed: false, msg: '年龄不在有效范围内' };
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const userId = wxContext.OPENID;
  const { description, images, certificationImages } = event;

  if (!description || !description.trim()) {
    return { code: -1, msg: '请输入任务描述' };
  }

  let userData;
  try {
    const user = await db.collection('users').doc(userId).get();
    userData = user.data;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { code: -1, msg: '获取用户信息失败，请重新登录' };
  }

  const age = userData.age;
  if (!age) {
    return { code: -1, msg: '请先完善个人信息中的年龄' };
  }

  const ageGroup = getAgeGroup(age);
  if (!ageGroup) {
    return { code: -1, msg: '年龄不在有效范围内' };
  }

  const permission = canPublishTask(ageGroup);
  if (!permission.allowed) {
    return { code: -1, msg: permission.msg };
  }

  // 任务分类
  const category = classifyTask(description);

  // ✅ 检测是否需要资质认证
  const certCheck = detectCertificationRequired(description);
  console.log('资质检测结果:', certCheck);

  // ✅ 如果需要资质认证，但用户没有上传资质图片
  if (certCheck.required && (!certificationImages || certificationImages.length === 0)) {
    return {
      code: -2,  // 特殊状态码：需要资质认证
      msg: certCheck.message,
      certRequired: true,
      certTypes: certCheck.types
    };
  }

  // 并发限制
  try {
    const activeCount = await db.collection('tasks').where({
      elderId: userId,
      status: db.command.in(['published', 'accepted', 'submitted'])
    }).count();
    if (activeCount.total >= 1) {
      return { code: -1, msg: '您已有未完成任务，请先完成或取消' };
    }
  } catch (error) {
    console.error('查询活跃任务失败:', error);
    return { code: -1, msg: '系统繁忙，请稍后重试' };
  }

  // 计算难度
  let difficulty = 2;
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是一个任务难度评估专家。根据用户描述，只输出一个数字：1(简单), 2(中等), 3(困难)。" },
          { role: "user", content: description }
        ],
        temperature: 0.1,
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        timeout: 5000
      }
    );
    const aiResult = response.data.choices[0].message.content;
    const parsedDifficulty = parseInt(aiResult.trim());
    if (parsedDifficulty >= 1 && parsedDifficulty <= 3) {
      difficulty = parsedDifficulty;
    }
  } catch (error) {
    console.error('AI API调用失败:', error);
    difficulty = detectDifficulty(description);
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  let taskId;
  try {
    const result = await db.collection('tasks').add({
      data: {
        elderId: userId,
        youthId: null,
        description: description.trim(),
        images: images || [],
        status: 'published',
        createTime: now,
        acceptTime: null,
        difficulty: difficulty,
        category: category,
        deadline: deadline,
        submitTime: null,
        completeTime: null,
        evidenceImages: [],
        submitNote: '',
        rating: 0,
        elderPoints: 0,
        youthPoints: 0,
        publisherAgeGroup: ageGroup,
        publisherAge: age,
        // ✅ 资质认证相关字段
        certRequired: certCheck.required,
        certTypes: certCheck.types,
        certificationImages: certificationImages || [],
        isCertified: certCheck.required ? false : true
      }
    });
    taskId = result._id;
  } catch (error) {
    console.error('创建任务失败:', error);
    return { code: -1, msg: '创建任务失败，请重试' };
  }

  return {
    code: 0,
    taskId: taskId,
    difficulty: difficulty,
    category: category,
    ageGroup: ageGroup,
    certRequired: certCheck.required,
    msg: '发布成功'
  };
};