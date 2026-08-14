const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CENTER = { latitude: 31.2620, longitude: 121.4880 };
const RANGE_RADIUS = 5000;

function calcDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 99999;
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

exports.main = async (event) => {
  try {
    const { category } = event;

    let categories = [];
    try {
      const configRes = await db.collection('livingCircleConfig').get();
      if (configRes.data && configRes.data.length > 0) {
        categories = configRes.data[0].categories || [];
      }
    } catch (e) {
      console.warn('获取分类配置失败，使用默认分类', e);
      categories = [
        { key: 'canteen', name: '食堂' },
        { key: 'barber', name: '理发' },
        { key: 'course', name: '课程' },
        { key: 'entertainment', name: '娱乐' },
        { key: 'counseling', name: '心理咨询' }
      ];
    }

    let pois = [];
    try {
      let query = {};
      if (category) {
        query = { category };
      }
      const poisRes = await db.collection('livingCirclePOIs')
        .where(query)
        .orderBy('category', 'asc')
        .orderBy('rating', 'desc')
        .limit(200)
        .get();
      pois = poisRes.data || [];
    } catch (e) {
      console.warn('获取POI数据失败', e);
      return {
        code: 500,
        msg: '云端数据暂不可用',
        data: { categories, pois: [], source: 'cloud_error' }
      };
    }

    const enrichedPois = pois.map(p => {
      const cat = categories.find(c => c.key === p.category);
      const inRange = p.latitude && p.longitude
        ? calcDistance(CENTER.latitude, CENTER.longitude, p.latitude, p.longitude) <= RANGE_RADIUS
        : false;
      return {
        ...p,
        categoryName: cat ? cat.name : (p.categoryName || p.category),
        inRange: inRange
      };
    });

    return {
      code: 0,
      data: {
        categories,
        pois: enrichedPois,
        source: 'cloud'
      }
    };
  } catch (error) {
    console.error('getLivingCircle error:', error);
    return {
      code: 500,
      msg: error.message || '服务器错误',
      data: { categories: [], pois: [], source: 'error' }
    };
  }
};
