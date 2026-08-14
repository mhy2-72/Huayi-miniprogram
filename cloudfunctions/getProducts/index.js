//cloudfunctions\getProducts\index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  // 只返回库存大于0的商品，按创建时间倒序
  const _ = db.command;
  const res = await db.collection('products')
    .where({ stock: _.gt(0) })
    .orderBy('createTime', 'desc')
    .get();
  return { code: 0, data: res.data };
};