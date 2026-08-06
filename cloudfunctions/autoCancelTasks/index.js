const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const now = new Date();

  // 超时未完成自动取消
  await db.collection('tasks').where({
    status: _.in(['accepted', 'submitted']),
    deadline: _.lt(now)
  }).update({ data: { status: 'cancelled' } });

  // 待评价超过12小时自动好评
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const submittedTasks = await db.collection('tasks').where({
    status: 'submitted',
    submitTime: _.lt(twelveHoursAgo)
  }).get();

  for (const task of submittedTasks.data) {
    try {
      await db.runTransaction(async transaction => {
        const t = await transaction.collection('tasks').doc(task._id).get();
        if (t.data.status !== 'submitted') return;
        const youthPoints = 5 * 10;
        const elderPoints = 20;
        await transaction.collection('tasks').doc(task._id).update({
          data: {
            status: 'completed',
            rating: 5,
            youthPoints,
            elderPoints,
            completeTime: new Date()
          }
        });
        await transaction.collection('users').doc(t.data.youthId).update({
          data: { points: _.inc(youthPoints) }
        });
        await transaction.collection('users').doc(t.data.elderId).update({
          data: { points: _.inc(elderPoints) }
        });
      });
    } catch (e) {
      console.error('auto rate error', task._id, e);
    }
  }
  return { processed: submittedTasks.data.length };
};