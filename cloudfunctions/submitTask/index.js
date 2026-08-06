const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const youthId = wxContext.OPENID;
  const { taskId, images, note } = event;   // images 是凭证图片 fileID 数组

  const task = await db.collection('tasks').doc(taskId).get();
  if (task.data.youthId !== youthId || task.data.status !== 'accepted') {
    return { code: -1, msg: '无权操作或状态错误' };
  }

  if ((!images || images.length === 0) && (!note || note.trim() === '')) {
    return { code: -1, msg: '请至少上传一张图片或填写文字说明' };
  }

  await db.collection('tasks').doc(taskId).update({
    data: {
      status: 'submitted',
      submitTime: new Date(),
      evidenceImages: images || [],
      submitNote: note || ''
    }
  });
  return { code: 0, msg: '提交成功' };
};