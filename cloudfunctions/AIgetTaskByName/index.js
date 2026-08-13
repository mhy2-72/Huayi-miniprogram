//cloudfunctions\AIgetTaskByName\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

const statusMap = {
  published: '待接取',
  accepted: '进行中',
  submitted: '待评价',
  completed: '已完成',
  cancelled: '已取消'
};

exports.main = async (event, context) => {
  const { openid, taskName } = event;
  if (!openid || !taskName) return { code: -1, reply: '参数错误' };

  const tasks = await db.collection('tasks').where({
    elderId: openid,
    description: taskName
  }).get();

  if (tasks.data.length === 0) return { code: -1, reply: `未找到任务“${taskName}”` };
  const task = tasks.data[0];
  const statusText = statusMap[task.status] || task.status;
  return { code: 0, reply: `任务“${taskName}”状态为“${statusText}”，请继续下一步操作！` };
};