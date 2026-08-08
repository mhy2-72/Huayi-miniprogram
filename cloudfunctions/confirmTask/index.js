const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const elderId = wxContext.OPENID;
  const { taskId, rating } = event;

  if (!rating || rating < 1 || rating > 5) return { code: -1, msg: '请给出1-5分评价' };

  try {
    await db.runTransaction(async transaction => {
      const task = await transaction.collection('tasks').doc(taskId).get();
      if (task.data.elderId !== elderId) throw new Error('仅发布者可操作');
      if (task.data.status === 'completed') return; // 已处理
      if (task.data.status !== 'submitted') throw new Error('当前状态不可评价');

      // 新积分计算逻辑
      const difficulty = task.data.difficulty || 3;
      const ratingScore = rating * 3;
      const difficultyScore = difficulty * 5;
      const totalScore = ratingScore + difficultyScore;
      const percentage = (totalScore / 30) * 100;
      const roundedPercent = Math.round(percentage);
      const youthPoints = roundedPercent * 0.5;
      const elderPoints = 0;  // 貌似应该没有这个对象，先置0

      await transaction.collection('tasks').doc(taskId).update({
        data: {
          status: 'completed',
          rating,
          youthPoints,
          elderPoints,
          completeTime: new Date()
        }
      });
      await transaction.collection('users').doc(task.data.youthId).update({
        data: { points: db.command.inc(youthPoints) }
      });
      await transaction.collection('users').doc(elderId).update({
        data: { points: db.command.inc(elderPoints) }
      });
    });
    return { code: 0, msg: '评价成功' };
  } catch (e) {
    return { code: -1, msg: e.message || '操作失败' };
  }
};