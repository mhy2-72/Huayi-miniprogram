const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { collectionName } = event;
  if (!collectionName) {
    return { code: -1, msg: '请提供要清理的集合名称（collectionName）' };
  }

  // 检查集合是否存在
  try {
    await db.collection(collectionName).limit(1).get();
  } catch (e) {
    return { code: -1, msg: `集合 ${collectionName} 不存在或无权限访问` };
  }

  let deletedCount = 0;
  const MAX_LIMIT = 100;

  // 循环删除，直到集合为空
  while (true) {
    const res = await db.collection(collectionName)
      .where({ _id: _.exists(true) })   // 匹配所有文档
      .limit(MAX_LIMIT)
      .get();

    const docs = res.data;
    if (docs.length === 0) break;

    const ids = docs.map(doc => doc._id);
    await db.collection(collectionName).where({
      _id: _.in(ids)
    }).remove();

    deletedCount += ids.length;
  }

  return { code: 0, msg: `成功清空集合 ${collectionName}，共删除 ${deletedCount} 条记录` };
};