// cloudfunctions/AIgetTaskByName/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

const statusMap = {
  published: '待接取',
  accepted: '进行中',
  submitted: '待评价',
  completed: '已完成',
  cancelled: '已取消'
};

exports.main = async (event, context) => {
  const { openid, taskName, taskId } = event;
  // 优先使用 taskId
  if (taskId) {
    const task = await db.collection('tasks').doc(taskId).get().catch(() => null);
    if (task && task.data) {
      const statusText = statusMap[task.data.status] || task.data.status;
      const role = task.data.elderId === openid ? '发布' : '接取';
      return {
        code: 0,
        reply: `您${role}的任务“${task.data.description}”当前状态为“${statusText}”`
      };
    }
    return { code: -1, reply: '任务不存在' };
  }

  // 兼容旧调用：通过 taskName 模糊查询
  if (!taskName) return { code: -1, reply: '参数错误' };
  const regex = new RegExp(taskName, 'i');
  const tasks = await db.collection('tasks')
    .where(_.or([
      { elderId: openid, description: regex },
      { youthId: openid, description: regex }
    ]))
    .orderBy('createTime', 'desc')
    .limit(10)
    .get();

  if (tasks.data.length === 0) {
    return { code: -1, reply: `未找到与“${taskName}”相关的任务` };
  }
  const task = tasks.data[0];
  const statusText = statusMap[task.status] || task.status;
  const role = task.elderId === openid ? '发布' : '接取';
  return {
    code: 0,
    reply: `您${role}的任务“${task.description}”当前状态为“${statusText}”${task.status === 'cancelled' ? '（取消原因：' + (task.cancelReason || '无') + '）' : ''}`
  };
};