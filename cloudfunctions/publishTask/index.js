const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const elderId = wxContext.OPENID;
  const { description } = event;

  const user = await db.collection('users').doc(elderId).get();
  if (user.data.role !== 'elder') return { code: -1, msg: '仅老人可发布任务' };

  const active = await db.collection('tasks').where({
    elderId,
    status: db.command.in(['published', 'accepted', 'submitted'])
  }).count();
  if (active.total > 0) return { code: -1, msg: '您有未完成的任务' };

  const res = await db.collection('tasks').add({
    data: {
      elderId,
      youthId: null,
      description,
      status: 'published',
      createTime: new Date(),
      acceptTime: null,
      deadline: null,
      submitTime: null,
      images: [],
      rating: 0,
      elderPoints: 0,
      youthPoints: 0
    }
  });
  return { code: 0, taskId: res._id };
};