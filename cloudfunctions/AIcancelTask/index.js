//cloudfunctions\AIcancelTask\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, taskName } = event;
  if (!openid || !taskName) return { code: -1, reply: '参数错误' };

  const tasks = await db.collection('tasks').where({
    elderId: openid,
    description: taskName,
    status: db.command.in(['published', 'accepted', 'submitted'])
  }).get();

  if (tasks.data.length === 0) return { code: -1, reply: `未找到可取消的任务“${taskName}”` };
  const task = tasks.data[0];

  if (task.status === 'submitted') {
    return { code: -1, reply: '任务已完成，禁止取消，请评价任务！' };
  }

  await db.collection('tasks').doc(task._id).update({
    data: {
      status: 'cancelled',
      cancelReason: '用户通过AI助手取消',
      cancelTime: new Date()
    }
  });

  return { code: 0, reply: `任务“${taskName}”已取消，感谢使用` };
};