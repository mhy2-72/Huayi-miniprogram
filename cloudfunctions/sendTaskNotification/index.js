// cloudfunctions/sendTaskNotification/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gqpcznd38f2891a' });
const db = cloud.database();

// 【修复1】初始化 openapi 对象，确保可以用 cloud.openapi
const openapi = cloud.openapi; 

exports.main = async (event, context) => {
  const { taskId, type, taskData } = event;
  const wxContext = cloud.getWXContext();

  try {
    // 获取任务详情
    let task = taskData;
    if (!task) {
      const taskRes = await db.collection('tasks').doc(taskId).get();
      task = taskRes.data;
    }

    if (!task) {
      return { code: -1, msg: '任务不存在' };
    }

    const notifications = [];
    const now = new Date();

    // 根据不同类型生成通知
    switch (type) {
      case 'published':
        // 任务发布通知
        break;
      case 'accepted':
        notifications.push({
          recipient: task.elderId,
          taskId: task._id,
          title: '任务已被接取',
          message: `您的任务 "${task.description.substring(0, 20)}..." 已被年轻人接取`,
          type: 'task_accepted',
          read: false,
          createTime: now,
          needSubscribe: true
        });
        break;
      case 'submitted':
        notifications.push({
          recipient: task.elderId,
          taskId: task._id,
          title: '任务已完成，等待确认',
          message: `年轻人已完成 "${task.description.substring(0, 20)}..."，请查看并评价`,
          type: 'task_submitted',
          read: false,
          createTime: now,
          needSubscribe: true
        });
        break;
      case 'completed':
        notifications.push({
          recipient: task.youthId,
          taskId: task._id,
          title: '任务已完成',
          message: `任务 "${task.description.substring(0, 20)}..." 已被老人确认完成，获得 ${task.youthPoints || 0} 积分`,
          type: 'task_completed',
          read: false,
          createTime: now,
          needSubscribe: true
        });
        break;
      case 'cancelled':
        if (task.youthId) {
          notifications.push({
            recipient: task.youthId,
            taskId: task._id,
            title: '任务已取消',
            message: `任务 "${task.description.substring(0, 20)}..." 已被取消${task.cancelReason ? '：' + task.cancelReason : ''}`,
            type: 'task_cancelled',
            read: false,
            createTime: now
          });
        }
        if (task.elderId) {
          notifications.push({
            recipient: task.elderId,
            taskId: task._id,
            title: '任务已取消',
            message: `任务 "${task.description.substring(0, 20)}..." 已被取消${task.cancelReason ? '：' + task.cancelReason : ''}`,
            type: 'task_cancelled',
            read: false,
            createTime: now
          });
        }
        break;
      case 'youth_cancelled':
        notifications.push({
          recipient: task.elderId,
          taskId: task._id,
          title: '年轻人已放弃接取',
          message: `年轻人已放弃任务 "${task.description.substring(0, 20)}..."，任务已重新开放接取`,
          type: 'task_youth_cancelled',
          read: false,
          createTime: now
        });
        break;
    }

    // 批量插入通知
    if (notifications.length > 0) {
      for (const notif of notifications) {
        await db.collection('notifications').add({ data: notif });
      }
    }

    // 发送微信订阅消息
    let subscribeResults = [];
    if (type === 'accepted' || type === 'completed') {
      for (const notif of notifications) {
        if (notif.needSubscribe) {
// 【修复2】调用时加上 try-catch 防止单个消息失败导致整个云函数崩溃
          try {
            const result = await sendSubscribeMessage(notif.recipient, notif, task);
            subscribeResults.push(result);
          } catch (subErr) {
            console.error('某条订阅消息发送失败:', subErr);
            subscribeResults.push({ code: -1, msg: '发送失败', error: subErr.message });
          }
        }
      }
    }
          
    return{
      code: 0,
      msg: '通知发送成功',
      notifications: notifications.length,
      subscribeResults
    };
          
  } catch (e) {
    console.error('发送通知失败:', e);
    return { code: -1, msg: '发送通知失败', error: e.message };
  }
}
          
// 发送微信订阅消息
async function sendSubscribeMessage(openid, notification, task) {
  try {
    // 注意：需要确保您在微信公众平台申请了模板ID，并且用户授权了
    const templateId = '5-rezkv5Ou5ph7UMnVjUX2gVZAg4VFgW-5_c137PrX0'; // 请确认这个ID正确
          
    const result = await openapi.subscribeMessage.send({
      touser: openid,
      page: '/pages/notifications/notifications', 
      data: {
        thing1: { value: notification.title },
        thing2: { value: notification.message.length > 20 ? notification.message.substring(0, 20) : notification.message },
        time3: { value: new Date().toLocaleString('zh-CN', { hour12: false }) },
        thing4: { value: task.description.substring(0, 20) + '...' }
      },
      templateId: templateId,
      miniprogramState: 'formal'
    });
          
    return { code: 0, result };
  } catch (e) {
    // 如果用户未订阅，返回特定错误码，不抛出异常
    if (e.errCode === 43101) {
      return { code: 43101, msg: '用户未订阅' };
    }
    // 【修复3】这里不要 throw，而是返回错误结果
    console.error('发送订阅消息失败:', e);
    return { code: -1, msg: '发送失败', error: e.message };
  }
}