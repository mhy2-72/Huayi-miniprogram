const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const MAX_LIMIT = 100;          // 每次查询记录数
  const FILE_BATCH_SIZE = 50;     // 云存储单次最多删除文件数

  let totalFiles = 0;
  let totalRecords = 0;

  // 分批处理 ttsFiles 集合
  while (true) {
    // 获取一批记录（按 _id 升序，避免重复）
    const res = await db.collection('ttsFiles')
      .limit(MAX_LIMIT)
      .get();

    const records = res.data;
    if (records.length === 0) break;

    // 提取文件ID并去重
    const fileIDs = [...new Set(records.map(r => r.fileID).filter(Boolean))];

    // 分批删除云存储文件
    if (fileIDs.length > 0) {
      for (let i = 0; i < fileIDs.length; i += FILE_BATCH_SIZE) {
        const batch = fileIDs.slice(i, i + FILE_BATCH_SIZE);
        try {
          await cloud.deleteFile({ fileList: batch });
          totalFiles += batch.length;
        } catch (e) {
          console.error('删除文件失败:', e);
        }
      }
    }

    // 删除这批记录
    const recordIds = records.map(r => r._id);
    await db.collection('ttsFiles').where({
      _id: _.in(recordIds)
    }).remove();
    totalRecords += recordIds.length;

    // 如果本批不足 MAX_LIMIT，说明已处理完
    if (records.length < MAX_LIMIT) break;
  }

  return {
    deletedFiles: totalFiles,
    deletedRecords: totalRecords
  };
};