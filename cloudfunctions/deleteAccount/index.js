const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 查询用户信息
  const userRes = await db.collection('users').doc(openid).get();
  const user = userRes.data;
  if (!user) return { code: -1, msg: '用户不存在' };

  // 删除头像文件（如果存在）
  if (user.avatarUrl) {
    try {
      await cloud.deleteFile({ fileList: [user.avatarUrl] });
    } catch (e) {
      console.warn('头像删除失败或文件不存在', e);
    }
  }

  // 删除用户文档
  await db.collection('users').doc(openid).remove();

  // 可选择删除该用户的通知、订单等敏感数据（此处示例删除通知）
  await db.collection('notifications').where({
    _openid: openid
  }).remove();

  // 注意：任务记录保留，不删除

  return { code: 0, msg: '账号已注销' };
};