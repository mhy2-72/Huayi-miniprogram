// cloudfunctions/getMyTasks/index.js
const cloud = require('wx-server-sdk');
cloud.init({env:'cloud1-d3gqpcznd38f2891a'})
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  let role = 'youth';
  try {
    const user = await db.collection('users').doc(openid).get();
    if (user.data && user.data.role) {
      role = user.data.role;
    }
  } catch (e) {
    console.warn('用户不存在，使用默认角色: youth', e);
  }

  // 非 teen 用户作为发布者，返回自己发布的任务
  if (role !== 'teen') {
    const tasks = await db.collection('tasks')
      .where({ elderId: openid })
      .orderBy('createTime', 'desc')
      .get();
    return { role: role, tasks: tasks.data };
  } else {
    // teen 用户作为接取者，返回可接任务和自己接取的任务
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