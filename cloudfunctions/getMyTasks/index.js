const cloud = require('wx-server-sdk');
cloud.init({env:'cloud1-d3gqpcznd38f2891a'})
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  let role = 'youth'; // 默认角色
  try {
    const user = await db.collection('users').doc(openid).get();
    if (user.data && user.data.role) {
      role = user.data.role;
    }
  } catch (e) {
    // 用户不存在，使用默认角色
    console.warn('用户不存在，使用默认角色: youth', e);
  }

  if (role === 'elder') {
    const tasks = await db.collection('tasks')
      .where({ elderId: openid })
      .orderBy('createTime', 'desc')
      .get();
    return { role: 'elder', tasks: tasks.data };
  } else {
    // youth 角色
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