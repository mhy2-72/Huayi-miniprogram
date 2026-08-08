// cloudfunctions/getNotifications/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const res = await db.collection('notifications')
      .where({ recipient: openid })
      .orderBy('createTime', 'desc')
      .limit(100)
      .get();

    return {
      code: 0,
      data: res.data
    };
  } catch (e) {
    console.error('获取通知失败:', e);
    return {
      code: -1,
      msg: '获取通知失败',
      data: []
    };
  }
};