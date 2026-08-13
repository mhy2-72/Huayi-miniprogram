// cloudfunctions/fixOldTasksDdl/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const MAX_LIMIT = 100;  // 每次最多取100条
  let hasMore = true;
  let processedCount = 0;
  let startAfter = null;

  while (hasMore) {
    const query = db.collection('tasks').orderBy('_id', 'asc');
    if (startAfter) {
      query.startAfter(startAfter);
    }
    const batch = await query.limit(MAX_LIMIT).get();
    const tasks = batch.data;
    if (tasks.length === 0) {
      hasMore = false;
      break;
    }

    for (const task of tasks) {
      // 获取 createTime，可能是云开发 Date 对象或字符串
      let createTime;
      if (task.createTime) {
        if (typeof task.createTime === 'object' && task.createTime.$date) {
          createTime = new Date(task.createTime.$date);
        } else if (typeof task.createTime === 'string') {
          createTime = new Date(task.createTime);
        } else if (task.createTime instanceof Date) {
          createTime = task.createTime;
        }
      }
      if (!createTime || isNaN(createTime.getTime())) {
        console.warn(`任务 ${task._id} 的 createTime 无效，跳过`);
        continue;
      }

      const newDeadline = new Date(createTime.getTime() + 8 * 60 * 60 * 1000);

      // 仅当需要更新时才更新（避免无意义写入）
      const currentDeadline = task.deadline;
      let needUpdate = false;
      if (!currentDeadline) {
        needUpdate = true;
      } else {
        let currentDate;
        if (typeof currentDeadline === 'object' && currentDeadline.$date) {
          currentDate = new Date(currentDeadline.$date);
        } else if (typeof currentDeadline === 'string') {
          currentDate = new Date(currentDeadline);
        } else if (currentDeadline instanceof Date) {
          currentDate = currentDeadline;
        }
        if (!currentDate || isNaN(currentDate.getTime()) || currentDate.getTime() !== newDeadline.getTime()) {
          needUpdate = true;
        }
      }

      if (needUpdate) {
        await db.collection('tasks').doc(task._id).update({
          data: { deadline: newDeadline }
        });
        processedCount++;
      }
    }

    // 记录下一批的起始位置
    startAfter = tasks[tasks.length - 1]._id;
  }

  return { processed: processedCount };
};