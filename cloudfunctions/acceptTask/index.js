//cloudfunctions\acceptTask\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const youthId = wxContext.OPENID;
  const { taskId } = event;

  const user = await db.collection('users').doc(youthId).get();
  if (user.data.role !== 'youth') return { code: -1, msg: '仅年轻人可接' };

  // 并发限制改为 1
  const activeCount = await db.collection('tasks').where({
    youthId,
    status: 'accepted'
  }).count();
  if (activeCount.total >= 1) return { code: -1, msg: '您已有进行中任务' };

  const task = await db.collection('tasks').doc(taskId).get();
  if (task.data.status !== 'published') return { code: -1, msg: '任务已被接或取消' };

  const acceptTime = new Date();
  // 不再修改 deadline，保持发布时设定的截止时间

  await db.collection('tasks').doc(taskId).update({
    data: {
      youthId,
      status: 'accepted',
      acceptTime
    }
  });
  return { code: 0, msg: '接取成功' };
};