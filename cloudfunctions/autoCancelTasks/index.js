// cloudfunctions/autoCancelTasks/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const now = new Date();
  let result = {
    eightHourCancelled: 0,
    deadlineCancelled: 0,
    autoRated: 0
  };

  // ========== 1. 发布超过8小时未被接取的任务自动取消 ==========
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const expiredPublishedTasks = await db.collection('tasks').where({
    status: 'published',
    createTime: _.lt(eightHoursAgo)
  }).get();

  if (expiredPublishedTasks.data.length > 0) {
    const expiredIds = expiredPublishedTasks.data.map(t => t._id);
    await db.collection('tasks').where({ _id: _.in(expiredIds) }).update({
      data: {
        status: 'cancelled',
        cancelReason: '发布超过8小时未被接取，系统自动取消',
        cancelTime: new Date()
      }
    });

    for (const task of expiredPublishedTasks.data) {
      try {
        const title = task.title || task.description?.substring(0, 20) || '未命名任务';
        await db.collection('notifications').add({
          data: {
            recipient: task.elderId,
            type: 'task_cancelled',
            taskId: task._id,
            title: title,
            message: `您发布的任务 "${title}" 超过8小时未被接取，已被系统自动取消。如需重新发布，请创建新任务。`,
            read: false,
            createTime: new Date()
          }
        });
      } catch (e) {
        console.error('写入通知失败', task._id, e);
      }
    }
    result.eightHourCancelled = expiredPublishedTasks.data.length;
  }

  // ========== 2. 超时未完成自动取消（deadline过期） ==========
  const expiredDeadlineTasks = await db.collection('tasks').where({
    status: _.in(['accepted', 'submitted']),
    deadline: _.lt(now)
  }).get();

  if (expiredDeadlineTasks.data.length > 0) {
    const expiredIds = expiredDeadlineTasks.data.map(t => t._id);
    await db.collection('tasks').where({ _id: _.in(expiredIds) }).update({
      data: {
        status: 'cancelled',
        cancelReason: '超过截止时间未完成，系统自动取消',
        cancelTime: new Date()
      }
    });

    for (const task of expiredDeadlineTasks.data) {
      try {
        const title = task.title || task.description?.substring(0, 20) || '未命名任务';
        
        await db.collection('notifications').add({
          data: {
            recipient: task.elderId,
            type: 'task_cancelled',
            taskId: task._id,
            title: title,
            message: `任务 "${title}" 因超过截止时间未完成，已被系统自动取消。`,
            read: false,
            createTime: new Date()
          }
        });

        if (task.youthId) {
          await db.collection('notifications').add({
            data: {
              recipient: task.youthId,
              type: 'task_cancelled',
              taskId: task._id,
              title: title,
              message: `您接取的任务 "${title}" 因超过截止时间未完成，已被系统自动取消。`,
              read: false,
              createTime: new Date()
            }
          });
        }
      } catch (e) {
        console.error('写入通知失败', task._id, e);
      }
    }
    result.deadlineCancelled = expiredDeadlineTasks.data.length;
  }

  // ========== 3. 待评价超过3小时自动好评 ==========
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const submittedTasks = await db.collection('tasks').where({
    status: 'submitted',
    submitTime: _.lt(threeHoursAgo)
  }).get();

  for (const task of submittedTasks.data) {
    try {
      await db.runTransaction(async transaction => {
        const t = await transaction.collection('tasks').doc(task._id).get();
        if (t.data.status !== 'submitted') return;
        
        const youthPoints = 5 * 10;
        const elderPoints = 20;
        
        await transaction.collection('tasks').doc(task._id).update({
          data: {
            status: 'completed',
            rating: 5,
            youthPoints: youthPoints,
            elderPoints: elderPoints,
            completeTime: new Date()
          }
        });
        
        if (t.data.youthId) {
          await transaction.collection('users').doc(t.data.youthId).update({
            data: { points: _.inc(youthPoints) }
          });
        }
        
        if (t.data.elderId) {
          await transaction.collection('users').doc(t.data.elderId).update({
            data: { points: _.inc(elderPoints) }
          });
        }
      });
      result.autoRated++;
    } catch (e) {
      console.error('自动评价失败', task._id, e);
    }
  }

  return result;
};