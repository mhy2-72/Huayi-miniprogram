// miniprogram/utils/livingCircle.js —— 纯函数，无 wx.* 依赖，可被 node 测试
const { CENTER, POIS } = require('../data/livingCircle.js');

const CATEGORY_KEYWORDS = {
  pharmacy:    ['药', '降压', '感冒', '医保', '处方', '买药'],
  market:      ['买菜', '蔬菜', '菜', '肉', '海鲜', '水果'],
  bank:        ['银行', '取钱', '取款', '存款', '柜台', '存钱'],
  barber:      ['理发', '剪发', '烫发', '染发'],
  repair:      ['修', '维修', '家电', '电灯', '水管', '换锁', '配钥匙'],
  canteen:     ['食堂', '吃饭', '就餐', '早饭', '午饭', '晚饭'],
  supermarket: ['超市', '生活用品', '日用品', '油盐', '购物'],
  hospital:    ['医院', '看病', '挂号', '门诊', '急诊', '体检']
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
  const R = 6371000; // 地球半径，米
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function recommend({ text, category, center }) {
  const c = center || CENTER;
  const target = category || matchCategory(text);
  const matched = Boolean(target);
  const pool = target ? POIS.filter(p => p.category === target) : POIS;
  const list = pool
    .map(p => ({ ...p, distanceMeters: calcDistance(c.latitude, c.longitude, p.latitude, p.longitude) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { list, matched, category: target };
}

module.exports = { CATEGORY_KEYWORDS, matchCategory, calcDistance, recommend };
