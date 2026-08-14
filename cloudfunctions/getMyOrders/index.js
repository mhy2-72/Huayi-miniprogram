const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const res = await db.collection('orders')
      .where({ userId: openid })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get();

    const orders = res.data.map(o => ({
      ...o,
      statusText: o.status === 'pending' ? '待使用' : (o.status === 'used' ? '已使用' : o.status)
    }));

    return { code: 0, data: orders };
  } catch (e) {
    console.error('获取兑换记录失败:', e);
    return { code: -1, msg: '获取失败', data: [] };
  }
};