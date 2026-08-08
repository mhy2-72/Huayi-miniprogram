const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const logs = await db.collection('pointLogs')
    .where({ userId: openid })
    .orderBy('createTime', 'desc')
    .limit(50)
    .get();
  return { data: logs.data };
};