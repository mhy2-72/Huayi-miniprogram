const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  let user;
  try {
    const userRes = await db.collection('users').doc(openid).get();
    user = userRes.data;
  } catch (e) {
    console.error('查询用户失败:', e);
    return { code: -1, msg: '用户不存在或已注销' };
  }
  if (!user) return { code: -1, msg: '用户不存在' };

  // 删除头像文件
  if (user.avatarUrl) {
    try {
      await cloud.deleteFile({ fileList: [user.avatarUrl] });
    } catch (e) {
      console.warn('头像删除失败', e);
    }
  }

  // 删除用户文档
  await db.collection('users').doc(openid).remove();

  // 清理通知、订单、积分记录
  await db.collection('notifications').where(
    _.or([{ recipient: openid }, { userId: openid }])
  ).remove();
  await db.collection('orders').where({ userId: openid }).remove();
  await db.collection('pointLogs').where({ userId: openid }).remove();

  // 清理 TTS 语音文件
  const ttsRecords = await db.collection('ttsFiles').where({ userId: openid }).get();
  if (ttsRecords.data.length > 0) {
    const fileIDs = ttsRecords.data.map(record => record.fileID);
    const BATCH_SIZE = 50;
    for (let i = 0; i < fileIDs.length; i += BATCH_SIZE) {
      const batch = fileIDs.slice(i, i + BATCH_SIZE);
      await cloud.deleteFile({ fileList: batch }).catch(err => {
        console.error('删除TTS文件失败', err);
      });
    }
    await db.collection('ttsFiles').where({ userId: openid }).remove();
  }

  // 更新任务中的用户ID为 'accountDeleted'，保留任务数据供前端展示注销状态
  try {
    if (user.role === 'elder') {
      await db.collection('tasks').where({ elderId: openid }).update({
        data: { elderId: 'accountDeleted' }
      });
    } else if (user.role === 'youth') {
      await db.collection('tasks').where({ youthId: openid }).update({
        data: { youthId: 'accountDeleted' }
      });
    }
    // 若角色为其他，可忽略或按需扩展
  } catch (e) {
    console.error('更新任务中的用户ID失败:', e);
    // 更新失败不影响注销流程
  }

  // 记录注销日志
  await db.collection('deletionLogs').add({
    data: {
      userId: openid,
      nickName: user.nickName || '未知',
      role: user.role,
      deleteTime: new Date()
    }
  });

  return { code: 0, msg: '账号已注销' };
};