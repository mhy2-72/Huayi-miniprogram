const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const elderId = wxContext.OPENID;
  const { description, images } = event; // images 可选

  const user = await db.collection('users').doc(elderId).get();
  if (user.data.role !== 'elder') return { code: -1, msg: '仅老人可发布任务' };

  // 检查未完成任务数（published/accepted/submitted）
  const activeCount = await db.collection('tasks').where({
    elderId,
    status: db.command.in(['published', 'accepted', 'submitted'])
  }).count();
  if (activeCount.total >= 3) return { code: -1, msg: '您已有3个未完成任务，请先完成或取消' };

  const res = await db.collection('tasks').add({
    data: {
      elderId,
      youthId: null,
      description,
      images: images || [],          // 老人附上的图片，仅接取后年轻人可见
      status: 'published',
      createTime: new Date(),
      acceptTime: null,
      deadline: null,
      submitTime: null,
      completeTime: null,
      evidenceImages: [],           // 年轻人提交的凭证图片
      submitNote: '',
      rating: 0,
      elderPoints: 0,
      youthPoints: 0
    }
  });
  return { code: 0, taskId: res._id, msg: '发布成功' };
};