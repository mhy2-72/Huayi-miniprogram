const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, taskName, rating } = event;  // rating 可选，默认5星
  if (!openid || !taskName) return { reply: '参数错误' };

  const star = rating || 5;  // 未指定则默认5星
  if (star < 1 || star > 5) return { reply: '评分需在1-5星之间' };

  // 查找老人提交后状态为 submitted 的任务
  const tasks = await db.collection('tasks').where({
    elderId: openid,
    description: taskName,
    status: 'submitted'
  }).get();

  if (tasks.data.length === 0) return { reply: `未找到待评价的任务“${taskName}”` };
  const task = tasks.data[0];

  // 获取年轻人昵称
  let youthName = '年轻人';
  if (task.youthId) {
    const youth = await db.collection('users').doc(task.youthId).get().catch(() => null);
    if (youth) youthName = youth.data.nickName;
  }

  // 积分计算（与 confirmTask 云函数保持一致的逻辑）
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
  });

  return { reply: `任务“${taskName}”已完成，评价为“${star}”星，“${youthName}”获得“${youthPoints}”积分` };
};