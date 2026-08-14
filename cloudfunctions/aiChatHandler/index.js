// cloudfunctions/aiChatHandler/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const axios = require('axios');

// ===== 生活圈 POI 数据（与 data/livingCircle.js 保持同步） =====
const POIS = [
  { id: 'canteen_001', name: '煌泰泰·新市北社邻食堂', category: 'canteen', categoryName: '食堂', address: '新市北路1517、1519号', latitude: 31.2950, longitude: 121.4480, rating: 4.3, inRange: true, desc: '家常菜为主，菜品丰富，新开店铺' },
  { id: 'canteen_002', name: '凉城新村街道社区长者食堂', category: 'canteen', categoryName: '食堂', address: '广灵四路268号', latitude: 31.2800, longitude: 121.4630, rating: 4.2, inRange: true, desc: '面向长者打造社区配套，价格亲民' },
  { id: 'canteen_003', name: '宜德饭堂(江杨店)', category: 'canteen', categoryName: '食堂', address: '江杨南路232号', latitude: 31.2900, longitude: 121.4550, rating: 4.1, inRange: true, desc: '商务餐性价比突出' },
  { id: 'canteen_004', name: '泰润饭堂(虹湾路店)', category: 'canteen', categoryName: '食堂', address: '虹湾路266号', latitude: 31.2860, longitude: 121.4580, rating: 4.4, inRange: true, desc: '菜品种类多、口味佳，经济实惠' },
  { id: 'canteen_005', name: '江湾社区食堂(彩虹湾金枫里店)', category: 'canteen', categoryName: '食堂', address: '彩虹湾金枫里北门旁', latitude: 31.2920, longitude: 121.4600, rating: 4.3, inRange: true, desc: '适合老年人，菜式丰富' },
  { id: 'canteen_006', name: '广中路街道花园社区长者食堂', category: 'canteen', categoryName: '食堂', address: '八字桥居委会水电路120号B幢1楼', latitude: 31.2730, longitude: 121.4720, rating: 4.2, inRange: true, desc: '经济实惠' },
  { id: 'canteen_007', name: '四川北路街道虹德社区长者食堂', category: 'canteen', categoryName: '食堂', address: '中州路居委会衡水路363号1楼', latitude: 31.2780, longitude: 121.4760, rating: 4.1, inRange: true, desc: '经济实惠' },
  { id: 'canteen_008', name: '北外滩街道滨芬食光熊猫食堂', category: 'canteen', categoryName: '食堂', address: '北外滩街道海宁居委会百官街18号', latitude: 31.2550, longitude: 121.4850, rating: 4.0, inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_009', name: '曲阳路街道第三市民驿站长者食堂', category: 'canteen', categoryName: '食堂', address: '东体育会路705号2楼', latitude: 31.2760, longitude: 121.4800, rating: 4.2, inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_010', name: '嘉兴路街道第五市民驿站长者食堂', category: 'canteen', categoryName: '食堂', address: '香烟桥路87号', latitude: 31.2710, longitude: 121.4840, rating: 4.5, inRange: true, desc: '嘉兴路街道社区食堂' },
  { id: 'canteen_011', name: '江湾镇街道第一市民驿站长者食堂', category: 'canteen', categoryName: '食堂', address: '虹湾路59号', latitude: 31.2900, longitude: 121.4550, rating: 4.1, inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_012', name: '曲阳路街道市民驿站赤二延伸点长者食堂', category: 'canteen', categoryName: '食堂', address: '曲阳路610弄13号1楼', latitude: 31.2780, longitude: 121.4780, rating: 4.2, inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_013', name: '杨浦区睦邻社区长者食堂', category: 'canteen', categoryName: '食堂', address: '打虎山路26号', latitude: 31.2750, longitude: 121.4720, rating: 4.3, inRange: true, desc: '临近地铁站，从早到晚不断档' },
  { id: 'canteen_014', name: '欧阳路街道社区食堂', category: 'canteen', categoryName: '食堂', address: '天宝西路248弄7号', latitude: 31.2680, longitude: 121.4920, rating: 4.4, inRange: true, desc: '高性价比，食材新鲜，环境整洁' },
  { id: 'canteen_015', name: '泰丰饭堂·社邻餐厅', category: 'canteen', categoryName: '食堂', address: '西江湾路103号', latitude: 31.2740, longitude: 121.4730, rating: 4.2, inRange: true, desc: '味道不错，不可吸烟，打烊晚' },
  { id: 'canteen_016', name: '荟心食坊', category: 'canteen', categoryName: '食堂', address: '横浜路256号党群服务中心', latitude: 31.2730, longitude: 121.4820, rating: 4.5, inRange: true, desc: '硬件新，少糖少盐少油，适合老年人' },
  { id: 'canteen_017', name: '联寓社区食堂', category: 'canteen', categoryName: '食堂', address: '陈家宅路20号', latitude: 31.2760, longitude: 121.4870, rating: 4.3, inRange: true, desc: '店面宽敞，不用排队' },
  { id: 'canteen_018', name: '祥德市集', category: 'canteen', categoryName: '食堂', address: '祥德路95号底楼', latitude: 31.2850, longitude: 121.4680, rating: 4.2, inRange: true, desc: '熟食铺火爆，鲜肉草头三拼锅贴' },
  { id: 'canteen_019', name: '川北好食光', category: 'canteen', categoryName: '食堂', address: '溧阳路1155号', latitude: 31.2780, longitude: 121.4780, rating: 4.1, inRange: true, desc: '社区食堂' },
  { id: 'canteen_020', name: '永昌盛邻里饭堂', category: 'canteen', categoryName: '食堂', address: '芷江西路134号', latitude: 31.2880, longitude: 121.4620, rating: 4.0, inRange: true, desc: '清洁卫生，称重自选店' },
  { id: 'canteen_021', name: '百乐汇社区食堂', category: 'canteen', categoryName: '食堂', address: '芷江西路98号', latitude: 31.2880, longitude: 121.4630, rating: 4.1, inRange: true, desc: '比隔壁方便' },
  { id: 'canteen_022', name: '鸿昌兴大食堂', category: 'canteen', categoryName: '食堂', address: '广纪路91号', latitude: 31.2950, longitude: 121.4550, rating: 4.2, inRange: true, desc: '适合本地人口味' },
  { id: 'canteen_023', name: '老鸿兴社区饭堂', category: 'canteen', categoryName: '食堂', address: '打虎山路80号', latitude: 31.2750, longitude: 121.4750, rating: 4.3, inRange: true, desc: '性价比高，包子好吃' },
  { id: 'canteen_024', name: '虹口区市民驿站(曲阳路街道)', category: 'canteen', categoryName: '食堂', address: '东体育会路1130号', latitude: 31.2760, longitude: 121.4810, rating: 4.1, inRange: true, desc: '市民驿站配套' },
  { id: 'barber_001', name: '舒雨 Salon·Beauty', category: 'barber', categoryName: '理发', address: '江湾店', latitude: 31.2900, longitude: 121.4550, rating: 4.5, inRange: true, desc: '服务耐心，剪发造型手艺出色' },
  { id: 'barber_002', name: '贤剪', category: 'barber', categoryName: '理发', address: '凉城路店', latitude: 31.2800, longitude: 121.4600, rating: 4.4, inRange: true, desc: '全程无推销，性价比很高' },
  { id: 'barber_003', name: '东方麒麟·潘多拉SALON', category: 'barber', categoryName: '理发', address: '盛邻MALL店', latitude: 31.2820, longitude: 121.4650, rating: 4.3, inRange: true, desc: '技术稳定靠谱，店内环境优质' },
  { id: 'barber_004', name: 'PE SALON', category: 'barber', categoryName: '理发', address: '水电路店', latitude: 31.2730, longitude: 121.4720, rating: 4.2, inRange: true, desc: '地理位置方便，性价比优异' },
  { id: 'barber_005', name: '7FAM 美发沙龙烫·染(天宝路店)', category: 'barber', categoryName: '理发', address: '天宝路飘鹰世纪大厦12层02室', latitude: 31.2680, longitude: 121.4920, rating: 4.4, inRange: true, desc: '主打烫染护理' },
  { id: 'barber_006', name: '米娜造型(天宝路店)', category: 'barber', categoryName: '理发', address: '天宝路578号飘鹰大厦1201室', latitude: 31.2680, longitude: 121.4910, rating: 4.2, inRange: true, desc: '预算友好，适合基础日常造型' },
  { id: 'barber_007', name: 'PE SALON(四平路店)', category: 'barber', categoryName: '理发', address: '四平路719号', latitude: 31.2770, longitude: 121.4990, rating: 4.3, inRange: true, desc: '理发师沟通耐心' },
  { id: 'course_001', name: '嘉兴路街道社区文化活动中心', category: 'course', categoryName: '课程', address: '瑞虹路400号', latitude: 31.2740, longitude: 121.4850, rating: 4.6, inRange: true, desc: '有丰富的老年活动课程，开放时间8:30～17:00' },
  { id: 'course_002', name: '上海四平老年大学', category: 'course', categoryName: '课程', address: '抚顺路鞍山三村57号', latitude: 31.2800, longitude: 121.4980, rating: 4.3, inRange: true, desc: '老年大学，距离相对较远' },
  { id: 'entertainment_001', name: '龙小主24H麻将棋牌室(骏丰大厦店)', category: 'entertainment', categoryName: '娱乐', address: '大连路1619号504室', latitude: 31.2580, longitude: 121.5050, rating: 4.3, inRange: true, desc: '老板人好，有免费茶水' },
  { id: 'entertainment_002', name: '品雀阁棋牌(新港路店)', category: 'entertainment', categoryName: '娱乐', address: '新港路333号4L', latitude: 31.2680, longitude: 121.5050, rating: 4.4, inRange: true, desc: '环境好，有免费零食' },
  { id: 'entertainment_003', name: '和平公园', category: 'entertainment', categoryName: '娱乐', address: '天宝路891号', latitude: 31.2680, longitude: 121.4900, rating: 4.7, inRange: true, desc: '无需门票，晚上有广场舞' },
  { id: 'entertainment_004', name: '四平电影院', category: 'entertainment', categoryName: '娱乐', address: '四平路901号', latitude: 31.2770, longitude: 121.5000, rating: 4.3, inRange: true, desc: '宽敞舒适，观影体验好' },
  { id: 'counseling_001', name: '森恬心理', category: 'counseling', categoryName: '心理咨询', address: '嘉兴路街道高阳路669弄2304室', latitude: 31.2710, longitude: 121.4870, rating: 4.6, inRange: true, desc: '咨询师温柔，善于沟通' },
  { id: 'counseling_002', name: '壹点灵·心理咨询中心(虹口龙之梦店)', category: 'counseling', categoryName: '心理咨询', address: '凯德商业中心东北门', latitude: 31.2650, longitude: 121.5050, rating: 4.5, inRange: true, desc: '环境好，咨询师专业耐心' }
];

const CATEGORY_KEYWORDS = {
  canteen: ['食堂', '吃饭', '就餐', '早饭', '午饭', '晚饭', '社区食堂', '长者食堂', '饭堂', '大食堂', '市集', '邻里饭堂'],
  barber: ['理发', '剪发', '烫发', '染发', '美发', '造型', '发型'],
  course: ['课程', '老年大学', '活动中心', '培训班', '学习班', '兴趣班'],
  entertainment: ['娱乐', '棋牌室', '麻将', '电影院', '公园', '散步', '广场舞', '看电影'],
  counseling: ['心理咨询', '心理', '咨询', '咨询师', '倾诉']
};

function matchCategory(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  let best = null;
  let bestCount = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const count = keywords.filter(k => t.includes(k)).length;
    if (count > bestCount) { bestCount = count; best = category; }
  }
  return bestCount > 0 ? best : null;
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const CENTER = { latitude: 31.2620, longitude: 121.4880 };

// ===== 云端 POI 加载（带本地降级） =====
let _cloudPOIsCache = null;
let _cloudPOIsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

async function loadPOIs() {
  // 缓存命中
  if (_cloudPOIsCache && Date.now() - _cloudPOIsCacheTime < CACHE_TTL) {
    return _cloudPOIsCache;
  }
  try {
    const res = await cloud.database().collection('livingCirclePOIs')
      .limit(200)
      .get();
    if (res.data && res.data.length > 0) {
      _cloudPOIsCache = res.data;
      _cloudPOIsCacheTime = Date.now();
      return res.data;
    }
  } catch (e) {
    console.warn('从云端加载POI失败，使用本地数据', e);
  }
  // 返回本地硬编码数据作为降级
  return POIS;
}

// ===== 主入口 =====
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { text } = event;

  let reply = '';
  let voiceFileID = '';
  let actionResult = null;

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

      actionResult = {
        action: parsed.action,
        code: execResult.code,
        taskId: execResult.taskId || '',
        taskName: (parsed.params && parsed.params.taskName) || execResult.taskName || '',
        rating: (parsed.params && parsed.params.rating) || 5,
        status: execResult.status || '',
        reply: reply,
        pois: execResult.pois || null,
        notice: execResult.notice || ''
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

  return { reply, voiceFileID, actionResult };
};

// ===== AI 调用 =====
async function callAI(prompt) {
  const systemPrompt = `你是一个助老服务助手。根据用户指令判断是否需要执行以下操作：
- 发布任务：发布任务：任务名
- 评价任务：评价任务：任务名为x星
- 取消任务：取消任务：任务名
- 查询任务状态：查询任务：任务名
- 生活圈服务：当用户询问食堂、理发、课程、娱乐、心理咨询等生活服务时

如果需要执行任务操作，请输出JSON：
{"action":"publish","params":{"taskName":"任务名"},"reply":"回复给用户的文字"}

action 可选值：publish、confirm、cancel、getStatus、livingCircle
params 说明：
- publish、cancel、getStatus：taskName
- confirm：taskName 和 rating（1-5星，默认5星）
- livingCircle：serviceType（可选，值为canteen/barber/course/entertainment/counseling）

如果不需要执行任何操作，直接输出回复文本。`;

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

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { return null; }
    }
    return null;
  }
}

// ===== 执行操作 =====
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
    case 'livingCircle':
      return await handleLivingCircle(params, actionObj.reply);
    default:
      return { code: -1, reply: '未知操作' };
  }

  return result.result;
}

// ===== 生活圈服务处理 =====
async function handleLivingCircle(params, aiReply) {
  const allPOIs = await loadPOIs();
  const serviceType = params && params.serviceType;
  let targetCategory = serviceType;

  if (!targetCategory) {
    targetCategory = matchCategory(aiReply || '');
  }

  let pool = targetCategory ? allPOIs.filter(p => p.category === targetCategory) : allPOIs;

  // Filter out POIs without valid coordinates for distance calculation
  const validPool = pool.filter(p => p.latitude && p.longitude);
  const noCoordPool = pool.filter(p => !p.latitude || !p.longitude);

  const inRangeList = validPool.filter(p => p.inRange).map(p => ({
    ...p,
    distanceMeters: calcDistance(CENTER.latitude, CENTER.longitude, p.latitude, p.longitude)
  })).sort((a, b) => a.distanceMeters - b.distanceMeters);

  const outOfRangeList = validPool.filter(p => !p.inRange).map(p => ({
    ...p,
    distanceMeters: calcDistance(CENTER.latitude, CENTER.longitude, p.latitude, p.longitude)
  })).sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Add POIs without coordinates at the end (no distance sorting)
  const noCoordWithDistance = noCoordPool.map(p => ({ ...p, distanceMeters: 0 }));

  const pois = [
    ...(inRangeList.length > 0 ? inRangeList.slice(0, 5) : outOfRangeList.slice(0, 3)),
    ...noCoordWithDistance.slice(0, 2)
  ];

  let notice = '';
  let reply = aiReply || '';

  if (inRangeList.length === 0 && outOfRangeList.length > 0) {
    notice = '⚠️ 该服务在虹口区范围内暂无网点，此功能还在测试中，剩余功能待开发。以下为范围外的参考信息。';
    reply = (reply || '根据您的需求') + '，为您找到以下参考信息（暂不在虹口区范围内）：';
  } else if (outOfRangeList.length > 0) {
    notice = '虹口区范围内已有服务，超出范围的功能还在测试中';
    reply = (reply || '根据您的需求') + '，为您找到虹口区范围内的服务：';
  } else {
    reply = (reply || '根据您的需求') + '，为您找到虹口区范围内的服务：';
  }

  if (pois.length === 0) {
    reply += ' 暂未找到相关服务。';
  }

  return {
    code: 0,
    reply: reply,
    pois: pois,
    notice: notice
  };
}

// ===== TTS =====
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
