// cloudfunctions/AIconfirmTask/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { taskId, rating } = event;
  if (!taskId) return { code: -1, reply: '缺少任务ID' };
  const star = rating || 5;
  if (star < 1 || star > 5) return { code: -1, reply: '评分需在1-5星之间' };

  const task = await db.collection('tasks').doc(taskId).get();
  if (!task.data) return { code: -1, reply: '任务不存在' };
  if (task.data.status !== 'submitted') return { code: -1, reply: '任务当前状态不可评价' };

  let youthName = '年轻人';
  if (task.data.youthId) {
    const youth = await db.collection('users').doc(task.data.youthId).get().catch(() => null);
    if (youth) youthName = youth.data.nickName;
  }

  const difficulty = task.data.difficulty || 3;
  const ratingScore = star * 3;
  const difficultyScore = difficulty * 5;
  const totalScore = ratingScore + difficultyScore;
  const percentage = (totalScore / 30) * 100;
  const roundedPercent = Math.round(percentage);
  const youthPoints = roundedPercent * 0.5;
  const elderPoints = 0;

  await db.runTransaction(async transaction => {
    await transaction.collection('tasks').doc(taskId).update({
      data: {
        status: 'completed',
        rating: star,
        youthPoints,
        elderPoints,
        completeTime: new Date()
      }
    });
    await transaction.collection('users').doc(task.data.youthId).update({
      data: { points: db.command.inc(youthPoints) }
    });
  });

  return { code: 0, reply: `任务“${task.data.description}”已完成，评价为“${star}”星，“${youthName}”获得“${youthPoints}”积分` };
};