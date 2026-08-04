const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { taskId } = event;
  const userId = wxContext.OPENID;

  const task = await db.collection('tasks').doc(taskId).get();
  if (!task.data) return { code: -1, msg: '任务不存在' };

  const isElder = task.data.elderId === userId;
  const isYouth = task.data.youthId === userId;
  if (isElder && task.data.status === 'published') {
    await db.collection('tasks').doc(taskId).update({ data: { status: 'cancelled' } });
    return { code: 0 };
  }
  if (isYouth && task.data.status === 'accepted') {
    await db.collection('tasks').doc(taskId).update({ data: { status: 'cancelled' } });
    return { code: 0 };
  }
  return { code: -1, msg: '不可取消' };
};