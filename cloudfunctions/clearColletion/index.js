//cloudfunctions\clearColletion\index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  // 支持传入 collectionName (字符串) 或 collectionNames (数组)
  let collectionNames = event.collectionNames || [];
  if (event.collectionName) {
    // 兼容旧版单集合调用
    collectionNames = [event.collectionName];
  }

  if (!collectionNames || collectionNames.length === 0) {
    return { code: -1, msg: '请提供要清理的集合名称（collectionName 或 collectionNames）' };
  }

  const results = [];

  // 对每个集合依次执行清空
  for (const collectionName of collectionNames) {
    if (typeof collectionName !== 'string' || collectionName.trim() === '') {
      results.push({ collection: collectionName, code: -1, msg: '集合名称无效' });
      continue;
    }

    // 检查集合是否存在
    try {
      await db.collection(collectionName).limit(1).get();
    } catch (e) {
      results.push({ collection: collectionName, code: -1, msg: `集合 ${collectionName} 不存在或无权限访问` });
      continue;
    }

    let deletedCount = 0;
    const MAX_LIMIT = 100;

    // 循环删除，直到集合为空
    try {
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
      results.push({ collection: collectionName, code: 0, msg: `成功清空，共删除 ${deletedCount} 条记录`, deletedCount });
    } catch (e) {
      results.push({ collection: collectionName, code: -1, msg: `清空失败: ${e.message}` });
    }
  }

  // 汇总结果
  const allSuccess = results.every(r => r.code === 0);
  return {
    code: allSuccess ? 0 : -1,
    msg: allSuccess ? '所有集合清空成功' : '部分集合清空失败，请查看 details',
    details: results
  };
};