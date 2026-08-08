const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const user = await db.collection('users').doc(openid).get();
  const role = user.data.role;

  if (role === 'elder') {
    const tasks = await db.collection('tasks')
      .where({ elderId: openid })
      .orderBy('createTime', 'desc')
      .get();
    return { role: 'elder', tasks: tasks.data };
  } else {
    const published = await db.collection('tasks')
      .where({ status: 'published' })
      .orderBy('createTime', 'desc')
      .get();
    const myActive = await db.collection('tasks')
      .where({
        youthId: openid,
        status: _.in(['accepted', 'submitted', 'completed'])
      })
      .orderBy('createTime', 'desc')
      .get();
    return { role: 'youth', published: published.data, myActive: myActive.data };
  }
};