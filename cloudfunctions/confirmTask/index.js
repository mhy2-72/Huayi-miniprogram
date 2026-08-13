//cloudfunctions\confirmTask\index.js
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
      if (task.data.status === 'completed') return;
      if (task.data.status !== 'submitted') throw new Error('当前状态不可评价');

      const difficulty = task.data.difficulty || 3;
      const ratingScore = rating * 3;
      const difficultyScore = difficulty * 5;
      const totalScore = ratingScore + difficultyScore;
      const percentage = (totalScore / 30) * 100;
      const roundedPercent = Math.round(percentage);
      const youthPoints = roundedPercent * 0.5;
      const elderPoints = 0;

      await transaction.collection('tasks').doc(taskId).update({
        data: {
          status: 'completed',
          rating,
          youthPoints,
          elderPoints,
          completeTime: new Date()
        }
      });

      // 更新用户积分
      await transaction.collection('users').doc(task.data.youthId).update({
        data: { points: db.command.inc(youthPoints) }
      });
      await transaction.collection('users').doc(elderId).update({
        data: { points: db.command.inc(elderPoints) }
      });

      // 写入年轻人积分获得日志
      if (youthPoints > 0) {
        await transaction.collection('pointLogs').add({
          data: {
            userId: task.data.youthId,
            amount: youthPoints,
            type: 'income',
            desc: `完成“${task.data.description}”获得${youthPoints}积分（评分${rating}，难度${difficulty}）`,
            taskId: taskId,
            createTime: new Date()
          }
        });
      }
      // 老人积分变动为0，可不记录（如需记录可将elderPoints设为20等固定值）
    });
    return { code: 0, msg: '评价成功' };
  } catch (e) {
    return { code: -1, msg: e.message || '操作失败' };
  }
};