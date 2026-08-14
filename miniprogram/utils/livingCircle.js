// miniprogram/utils/livingCircle.js —— 纯函数，无 wx.* 依赖
const { CENTER, RANGE_RADIUS, POIS } = require('../data/livingCircle.js');

const CATEGORY_KEYWORDS = {
  canteen:      ['食堂', '吃饭', '就餐', '早饭', '午饭', '晚饭', '社区食堂', '长者食堂', '饭堂', '大食堂', '市集', '邻里饭堂'],
  barber:       ['理发', '剪发', '烫发', '染发', '美发', '造型', '发型'],
  course:       ['课程', '老年大学', '活动中心', '培训班', '学习班', '兴趣班'],
  entertainment: ['娱乐', '棋牌室', '麻将', '电影院', '公园', '散步', '广场舞', '看电影'],
  counseling:   ['心理咨询', '心理', '咨询', '咨询师', '倾诉']
};

function matchCategory(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  let best = null;
  let bestCount = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const count = keywords.filter(k => t.includes(k)).length;
    if (count > bestCount) {
      bestCount = count;
      best = category;
    }
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

// 计算某点是否在虹口区限定范围内
function isInRange(lat, lng) {
  const distance = calcDistance(CENTER.latitude, CENTER.longitude, lat, lng);
  return distance <= RANGE_RADIUS;
}

function recommend({ text, category, center, onlyInRange }) {
  const c = center || CENTER;
  const target = category || matchCategory(text);
  const matched = Boolean(target);
  let pool = target ? POIS.filter(p => p.category === target) : POIS;

  if (onlyInRange) {
    pool = pool.filter(p => p.inRange);
  }

  const list = pool
    .map(p => ({
      ...p,
      distanceMeters: calcDistance(c.latitude, c.longitude, p.latitude, p.longitude)
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { list, matched, category: target };
}

// 搜索POIs，返回范围内和范围外的结果
function smartSearch({ text, category }) {
  const target = category || matchCategory(text);
  let pool = target ? POIS.filter(p => p.category === target) : POIS;

  const inRange = pool.filter(p => p.inRange);
  const outOfRange = pool.filter(p => !p.inRange);

  const enrich = (list) => list
    .map(p => ({
      ...p,
      distanceMeters: calcDistance(CENTER.latitude, CENTER.longitude, p.latitude, p.longitude)
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return {
    matched: Boolean(target),
    category: target,
    inRangeList: enrich(inRange),
    outOfRangeList: enrich(outOfRange)
  };
}

module.exports = { CATEGORY_KEYWORDS, matchCategory, calcDistance, isInRange, recommend, smartSearch };
