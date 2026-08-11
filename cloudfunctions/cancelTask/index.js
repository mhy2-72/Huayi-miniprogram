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

  // 老人取消 published 任务
  if (isElder && task.data.status === 'published') {
    await db.collection('tasks').doc(taskId).update({ data: { status: 'cancelled' } });
    return { code: 0, msg: '任务已取消' };
  }

  // 禁止取消待评价（submitted）的任务
  if (isElder && task.data.status === 'submitted') {
    return { code: -1, msg: '任务已完成，禁止取消，请评价任务！' };
  }

  // 年轻人取消接取 (accepted)
  if (isYouth && task.data.status === 'accepted') {
    const createTime = new Date(task.data.createTime);
    const maxDeadline = new Date(createTime.getTime() + 48 * 60 * 60 * 1000);
    let newDeadline = new Date(task.data.deadline.getTime() + 3 * 60 * 60 * 1000);
    if (newDeadline > maxDeadline) newDeadline = maxDeadline;

    await db.collection('tasks').doc(taskId).update({
      data: {
        status: 'published',
        youthId: null,
        acceptTime: null,
        deadline: newDeadline,
        evidenceImages: [],
        submitNote: '',
        submitTime: null
      }
    });
    return { code: 0, msg: '已取消接取，任务重新发布' };
  }

  return { code: -1, msg: '当前状态不可取消' };
};