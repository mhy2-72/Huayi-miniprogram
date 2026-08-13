//cloudfunctions\AIpublishTask\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, taskName } = event;
  if (!openid || !taskName) return { code: -1, reply: '参数错误' };

  const user = await db.collection('users').doc(openid).get();
  if (user.data.role !== 'elder') return { code: -1, reply: '仅老人可发布任务' };

  const activeCount = await db.collection('tasks').where({
    elderId: openid,
    status: db.command.in(['published', 'accepted', 'submitted'])
  }).count();
  if (activeCount.total >= 1) return { code: -1, reply: '您已有未完成的任务，请先处理' };

  const now = new Date();
  const deadline = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  await db.collection('tasks').add({
    data: {
      elderId: openid,
      youthId: null,
      description: taskName,
      status: 'published',
      createTime: now,
      deadline,
      difficulty: 2,
      images: [],
      evidenceImages: [],
      submitNote: '',
      rating: 0,
      elderPoints: 0,
      youthPoints: 0
    }
  });
  return { code: 0, reply: `任务“${taskName}”已发布` };
};