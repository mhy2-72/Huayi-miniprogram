const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const elderId = wxContext.OPENID;
  const { taskId, rating } = event;

  const task = await db.collection('tasks').doc(taskId).get();
  if (task.data.elderId !== elderId || task.data.status !== 'submitted') {
    return { code: -1, msg: '无权或状态错误' };
  }

  const youthPoints = rating * 10;
  const elderPoints = 20;

  await db.collection('tasks').doc(taskId).update({
    data: {
      status: 'completed',
      rating,
      youthPoints,
      elderPoints
    }
  });

  const batch = db.batch();
  batch.updateCollection('users', task.data.youthId, { points: _.inc(youthPoints) });
  batch.updateCollection('users', elderId, { points: _.inc(elderPoints) });
  await batch.commit();
  return { code: 0 };
};