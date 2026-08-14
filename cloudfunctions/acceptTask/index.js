// cloudfunctions/acceptTask/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

const CERT_TYPE_NAMES = {
  nursing: '护理',
  repair: '修理'
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const youthId = wxContext.OPENID;
  const { taskId } = event;

  if (!taskId) return { code: -1, msg: '缺少任务ID' };

  try {
    const taskRes = await db.collection('tasks').doc(taskId).get();
    const task = taskRes.data;

    if (!task) return { code: -1, msg: '任务不存在' };

    if (task.status !== 'published') {
      return { code: -1, msg: '任务已被接取或已取消' };
    }

    if (task.elderId === youthId) {
      return { code: -1, msg: '不能接取自己发布的任务' };
    }

    // ✅ 资质认证校验
    if (task.certRequired && task.certTypes && task.certTypes.length > 0) {
      let userCerts = [];
      try {
        const userRes = await db.collection('users').doc(youthId).get();
        userCerts = (userRes.data && userRes.data.certifications) || [];
      } catch (e) {
        return { code: -1, msg: '系统繁忙，请稍后重试' };
      }

      const certNames = task.certTypes.map(t => CERT_TYPE_NAMES[t] || t).join('、');
      const hasAll = task.certTypes.every(t => userCerts.some(c => c.type === t && c.status === 'approved'));
      if (!hasAll) {
        return { code: -1, msg: `该任务需要${certNames}资质认证，您尚未通过该资质认证，请先申请认证` };
      }
    }

    await db.collection('tasks').doc(taskId).update({
      data: {
        youthId: youthId,
        status: 'accepted',
        acceptTime: new Date()
      }
    });

    return { code: 0, msg: '接取成功' };
  } catch (err) {
    console.error('接取任务失败:', err);
    return { code: -1, msg: '接取失败，请重试' };
  }
};
