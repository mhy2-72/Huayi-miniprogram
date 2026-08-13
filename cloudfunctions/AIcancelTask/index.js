// cloudfunctions/AIcancelTask/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { taskId } = event;
  if (!taskId) return { code: -1, reply: '缺少任务ID' };

  const task = await db.collection('tasks').doc(taskId).get();
  if (!task.data) return { code: -1, reply: '任务不存在' };

  if (task.data.status === 'submitted') {
    return { code: -1, reply: '任务已完成，禁止取消，请评价任务！' };
  }
  if (task.data.status !== 'published' && task.data.status !== 'accepted') {
    return { code: -1, reply: '当前状态不可取消' };
  }

  await db.collection('tasks').doc(taskId).update({
    data: {
      status: 'cancelled',
      cancelReason: '用户通过AI助手取消',
      cancelTime: new Date()
    }
  });

  return { code: 0, reply: `任务“${task.data.description}”已取消，感谢使用` };
};