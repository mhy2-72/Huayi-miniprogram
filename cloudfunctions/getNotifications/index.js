// cloudfunctions/getNotifications/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const res = await db.collection('notifications')
      .where(_.or([
        { recipient: openid },
        { userId: openid }
      ]))
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