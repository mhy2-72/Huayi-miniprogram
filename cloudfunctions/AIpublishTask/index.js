//cloudfunctions\AIpublishTask\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { openid, taskName } = event;
  if (!openid || !taskName) return { code: -1, reply: '参数错误' };

  const user = await db.collection('users').doc(openid).get();
  const role = user.data.role;
  // 新角色系统：young/middle/elderly 都可发布任务，只有 teen 不可
  if (role === 'teen') return { code: -1, reply: '少年组不可发布任务' };

  const activeCount = await db.collection('tasks').where({
    elderId: openid,
    status: _.in(['published', 'accepted', 'submitted'])
  }).count();
  if (activeCount.total >= 1) return { code: -1, reply: '您已有未完成的任务，请先处理' };

  const now = new Date();
  const deadline = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const addResult = await db.collection('tasks').add({
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

  return { code: 0, reply: `任务"${taskName}"已发布`, taskId: addResult._id, taskName };
};
