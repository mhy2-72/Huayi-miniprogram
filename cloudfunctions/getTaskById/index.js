//cloudfunctions\getTaskById\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { taskId } = event;
  if (!taskId) return { code: -1, msg: '缺少任务ID' };
  try {
    const res = await db.collection('tasks').doc(taskId).get();
    if (res.data) {
      return { code: 0, data: res.data };
    } else {
      return { code: -1, msg: '任务不存在' };
    }
  } catch (e) {
    return { code: -1, msg: '查询失败' };
  }
};