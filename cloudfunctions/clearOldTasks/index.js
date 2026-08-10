const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const MAX_LIMIT = 100;          // 每次查询任务数
  const FILE_BATCH_SIZE = 50;     // 云存储每次最多删除文件数
  let deletedTasksCount = 0;
  let deletedFilesCount = 0;
  let failedFilesCount = 0;

  // 收集需要删除的文件ID
  const collectFileIDs = (task) => {
    const ids = [];
    if (task.images && Array.isArray(task.images)) {
      ids.push(...task.images);
    }
    if (task.evidenceImages && Array.isArray(task.evidenceImages)) {
      ids.push(...task.evidenceImages);
    }
    return ids;
  };

  // 分批删除文件
  const deleteFilesInBatches = async (fileIDs) => {
    for (let i = 0; i < fileIDs.length; i += FILE_BATCH_SIZE) {
      const batch = fileIDs.slice(i, i + FILE_BATCH_SIZE);
      try {
        const res = await cloud.deleteFile({ fileList: batch });
        const errFiles = res.fileList.filter(f => f.status !== 0);
        if (errFiles.length > 0) {
          failedFilesCount += errFiles.length;
          console.warn('部分文件删除失败:', errFiles.map(f => f.fileID));
        }
        deletedFilesCount += batch.length - errFiles.length;
      } catch (e) {
        failedFilesCount += batch.length;
        console.error('删除文件批次失败:', e);
      }
    }
  };

  // 分页处理任务
  while (true) {
    const tasks = await db.collection('tasks')
      .where({ createTime: _.lt(ninetyDaysAgo) })
      .limit(MAX_LIMIT)
      .get();

    if (tasks.data.length === 0) break;

    const taskIds = tasks.data.map(t => t._id);
    const allFileIDs = [];
    tasks.data.forEach(task => {
      allFileIDs.push(...collectFileIDs(task));
    });

    // 去重
    const uniqueFileIDs = [...new Set(allFileIDs)];

    // 先删除文件
    if (uniqueFileIDs.length > 0) {
      await deleteFilesInBatches(uniqueFileIDs);
    }

    // 再删除任务文档
    await db.collection('tasks').where({ _id: _.in(taskIds) }).remove();
    deletedTasksCount += taskIds.length;
  }

  return {
    deletedTasks: deletedTasksCount,
    deletedFiles: deletedFilesCount,
    failedFiles: failedFilesCount
  };
};