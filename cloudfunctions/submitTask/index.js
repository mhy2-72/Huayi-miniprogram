const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { taskId, images } = event;
  const youthId = wxContext.OPENID;

  const task = await db.collection('tasks').doc(taskId).get();
  if (task.data.youthId !== youthId || task.data.status !== 'accepted') {
    return { code: -1, msg: '无权操作或状态错误' };
  }

  await db.collection('tasks').doc(taskId).update({
    data: {
      status: 'submitted',
      submitTime: new Date(),
      images: images || []
    }
  });
  return { code: 0 };
};