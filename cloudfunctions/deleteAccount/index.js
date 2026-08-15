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

  // 检查未完成任务（无论任何角色，都检查作为发布者和接取者的未完成任务）
  const UNFINISHED_STATUSES = ['published', 'accepted', 'submitted'];
  let unfinishedCount = 0;
  let unfinishedDetails = [];

  // 作为发布者（elderId），检查未完成的发布任务
  const elderTasks = await db.collection('tasks')
    .where({
      elderId: openid,
      status: _.in(UNFINISHED_STATUSES)
    })
    .get();
  if (elderTasks.data && elderTasks.data.length) {
    unfinishedCount += elderTasks.data.length;
    elderTasks.data.forEach(t => {
      const statusMap = { published: '已发布待接取', accepted: '进行中', submitted: '待确认' };
      unfinishedDetails.push(`「${t.description.slice(0,12)}」${statusMap[t.status] || t.status}`);
    });
  }

  // 作为接取者（youthId），检查未完成的接取任务
  const youthTasks = await db.collection('tasks')
    .where({
      youthId: openid,
      status: _.in(UNFINISHED_STATUSES)
    })
    .get();
  if (youthTasks.data && youthTasks.data.length) {
    unfinishedCount += youthTasks.data.length;
    youthTasks.data.forEach(t => {
      const statusMap = { published: '已发布待接取', accepted: '进行中', submitted: '待确认' };
      unfinishedDetails.push(`「${t.description.slice(0,12)}」${statusMap[t.status] || t.status}`);
    });
  }

  if (unfinishedCount > 0) {
    return {
      code: -2,
      msg: `您还有 ${unfinishedCount} 个未完成的任务，无法注销账号。请先处理完毕后再试。`,
      unfinishedCount,
      details: unfinishedDetails
    };
  }

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

  // 更新任务中的用户ID为 'accountDeleted'，无论任何角色都清除所有关联
  try {
    await db.collection('tasks').where({ elderId: openid }).update({
      data: { elderId: 'accountDeleted' }
    });
    await db.collection('tasks').where({ youthId: openid }).update({
      data: { youthId: 'accountDeleted' }
    });
  } catch (e) {
    console.error('更新任务中的用户ID失败:', e);
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