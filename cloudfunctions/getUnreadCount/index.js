const cloud = require('wx-server-sdk');
cloud.init({env:'cloud1-d3gqpcznd38f2891a'});
const db = cloud.database();

exports.main = async(event, context) =>{
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    const res = await db.collection('notifications')
      .where({
        recipient: openid,
        read: false
      })
      .count();
    
    return {
      code: 0,
      count: res.total
    };
  } catch (e) {
    console.error('获取未读数量失败:', e);
    return {
      code: -1,
      count: 0,
      msg: '获取未读数量失败'
    };
  }
}