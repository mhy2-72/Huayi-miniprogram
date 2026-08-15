// cloudfunctions/getMyTasks/index.js
const cloud = require('wx-server-sdk');
cloud.init({env:'cloud1-d3gqpcznd38f2891a'})
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const skipPersonal = event.skipPersonal === true;

  if (skipPersonal) {
    const published = await db.collection('tasks')
      .where({ status: 'published' })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get();
    return {
      role: 'guest',
      tasks: [],
      published: published.data,
      myActive: []
    };
  }

  let role = 'young';
  try {
    const user = await db.collection('users').doc(openid).get();
    if (user.data && user.data.role) {
      role = user.data.role;
    }
  } catch (e) {
    console.warn('用户不存在，使用默认角色: young', e);
  }

  // 所有角色都能看到自己的发布任务
  const tasks = await db.collection('tasks')
    .where({ elderId: openid })
    .orderBy('createTime', 'desc')
    .get();

  // 所有角色都能看到可接取的任务（status=published，排除自己发布的）
  const published = await db.collection('tasks')
    .where({
      status: 'published',
      elderId: _.neq(openid)
    })
    .orderBy('createTime', 'desc')
    .get();

  // 所有角色都能看到自己接取的任务
  const myActive = await db.collection('tasks')
    .where({
      youthId: openid,
      status: _.in(['accepted', 'submitted', 'completed'])
    })
    .orderBy('createTime', 'desc')
    .get();

  return {
    role: role,
    tasks: tasks.data,
    published: published.data,
    myActive: myActive.data
  };
};
