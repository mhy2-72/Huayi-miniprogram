const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
exports.main = async () => {
  const now = new Date();
  const res = await db.collection('tasks').where({
    status: db.command.in(['accepted', 'submitted']),
    deadline: db.command.lt(now)
  }).update({ data: { status: 'cancelled' } });
  return res.stats;
};