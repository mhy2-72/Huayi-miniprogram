// cloudfunctions/markNotificationRead/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gqpcznd38f2891a' });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { notificationId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!notificationId) return { code: -1, msg: '缺少通知ID' };

  try {
    // 验证该通知是否属于当前用户（兼容 recipient 或 userId）
    const notif = await db.collection('notifications')
      .where(_.and([
        { _id: notificationId },
        _.or([
          { recipient: openid },
          { userId: openid }
        ])
      ]))
      .get();

    if (notif.data.length === 0) {
      return { code: -1, msg: '通知不存在或无权限' };
    }

    // 执行更新
    await db.collection('notifications')
      .doc(notificationId)
      .update({
        data: {
          read: true,
          readTime: new Date()
        }
      });

    return { code: 0, msg: '已标记为已读' };
  } catch (e) {
    console.error('标记已读失败:', e);
    return { code: -1, msg: '操作失败' };
  }
};