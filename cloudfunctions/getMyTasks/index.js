const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const user = await db.collection('users').doc(wxContext.OPENID).get();
  const role = user.data.role;
  if (role === 'elder') {
    const myTasks = await db.collection('tasks').where({ elderId: wxContext.OPENID })
      .orderBy('createTime', 'desc').get();
    return { role: 'elder', tasks: myTasks.data };
  } else {
    const published = await db.collection('tasks').where({ status: 'published' }).get();
    const myActive = await db.collection('tasks').where({
      youthId: wxContext.OPENID,
      status: _.in(['accepted', 'submitted'])
    }).get();
    return { role: 'youth', published: published.data, myActive: myActive.data };
  }
};