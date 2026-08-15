//cloudfunctions\AIconfirmTask\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, taskName, rating } = event;
  if (!openid || !taskName) return { code: -1, reply: '参数错误' };

  const star = rating || 5;
  if (star < 1 || star > 5) return { code: -1, reply: '评分需在1-5星之间' };

  const tasks = await db.collection('tasks').where({
    elderId: openid,
    description: taskName,
    status: 'submitted'
  }).get();

  if (tasks.data.length === 0) return { code: -1, reply: `未找到待评价的任务"${taskName}"` };
  const task = tasks.data[0];

  let youthName = '年轻人';
  if (task.youthId) {
    const youth = await db.collection('users').doc(task.youthId).get().catch(() => null);
    if (youth) youthName = youth.data.nickName;
  }

  const difficulty = task.difficulty || 3;
  const ratingScore = star * 3;
  const difficultyScore = difficulty * 5;
  const totalScore = ratingScore + difficultyScore;
  const percentage = (totalScore / 30) * 100;
  const roundedPercent = Math.round(percentage);
  const youthPoints = roundedPercent * 0.5;
  const elderPoints = 0;

  await db.runTransaction(async transaction => {
    await transaction.collection('tasks').doc(task._id).update({
      data: {
        status: 'completed',
        rating: star,
        youthPoints,
        elderPoints,
        completeTime: new Date()
      }
    });
    await transaction.collection('users').doc(task.youthId).update({
      data: { points: db.command.inc(youthPoints) }
    });

    // 写入年轻人积分获得日志（与 confirmTask 保持一致）
    if (youthPoints > 0) {
      await transaction.collection('pointLogs').add({
        data: {
          userId: task.youthId,
          amount: youthPoints,
          type: 'income',
          desc: `完成"${task.description}"获得${youthPoints}积分（AI评价${star}星，难度${difficulty}）`,
          taskId: task._id,
          createTime: new Date()
        }
      });
    }
  });

  return { code: 0, reply: `任务"${taskName}"已完成，评价为"${star}"星，"${youthName}"获得"${youthPoints}"积分` };
};
