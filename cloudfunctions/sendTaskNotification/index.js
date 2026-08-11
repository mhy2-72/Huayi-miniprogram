// cloudfunctions/sendTaskNotification/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gqpcznd38f2891a' });
const db = cloud.database();

// 【修复1】初始化 openapi 对象，确保可以用 cloud.openapi
const openapi = cloud.openapi; 

exports.main = async (event, context) => {
  const { taskId, type, taskData } = event;
  const wxContext = cloud.getWXContext();

  console.log('=== sendTaskNotification 开始 ===');
  console.log('接收参数:', { taskId, type, taskData });

  try {
    // 获取任务详情（始终从数据库获取最新数据，确保积分准确）
    let task = taskData;
    if (!taskId && taskData) {
      task = taskData;
      console.log('使用传入的 taskData');
    } else if (taskId) {
      console.log('从数据库获取任务详情, taskId:', taskId);
      const taskRes = await db.collection('tasks').doc(taskId).get();
      task = taskRes.data;
      console.log('获取到的任务:', task);
    }

    if (!task) {
      console.error('任务不存在');
      return { code: -1, msg: '任务不存在' };
    }

    // 获取相关用户昵称
    console.log('获取用户昵称...');
    const elderUser = await db.collection('users').doc(task.elderId).get().catch(err => {
      console.error('获取老人用户失败:', err);
      return null;
    });
    const youthUser = task.youthId ? await db.collection('users').doc(task.youthId).get().catch(err => {
      console.error('获取年轻人用户失败:', err);
      return null;
    }) : null;
    const elderName = elderUser ? elderUser.data.nickName : '老人';
    const youthName = youthUser ? youthUser.data.nickName : '年轻人';
    console.log('昵称:', { elderName, youthName });

    const notifications = [];
    const now = new Date();

    // 根据不同类型生成通知
    switch (type) {
      case 'accepted':
        notifications.push({
          recipient: task.elderId,
          taskId: task._id,
          title: '任务已被接取',
          message: `${youthName} 接取了您的任务 "${task.description.substring(0, 20)}"`,
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
          message: `${youthName} 已完成任务 "${task.description.substring(0, 20)}" 并提交凭证，请确认评价`,
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
          message: `任务 "${task.description.substring(0, 20)}" 已被 ${elderName} 确认完成，您获得 ${task.youthPoints || 0} 积分`,
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
            message: `任务 "${task.description.substring(0, 20)}" 已被 ${elderName} 取消${task.cancelReason ? '：' + task.cancelReason : ''}`,
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
            message: `任务 "${task.description.substring(0, 20)}" 已被取消${task.cancelReason ? '：' + task.cancelReason : ''}`,
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
          message: `${youthName} 已放弃任务 "${task.description.substring(0, 20)}"，任务已重新开放接取`,
          type: 'task_youth_cancelled',
          read: false,
          createTime: now
        });
        break;
    }

    console.log('生成的通知数量:', notifications.length);

    // 批量插入通知
    if (notifications.length > 0) {
      for (const notif of notifications) {
        try {
          await db.collection('notifications').add({ data: notif });
          console.log('通知写入成功:', notif.recipient, notif.title);
        } catch (insertErr) {
          console.error('通知写入失败:', insertErr, notif);
        }
      }
    }

    // 发送微信订阅消息
    let subscribeResults = [];
    const needSubscribeTypes = ['accepted', 'completed', 'submitted'];
    if (needSubscribeTypes.includes(type)) {
      for (const notif of notifications) {
        if (notif.needSubscribe) {
          try {
            const result = await sendSubscribeMessage(notif.recipient, notif, task, youthName, elderName);
            subscribeResults.push(result);
          } catch (subErr) {
            console.error('订阅消息异常:', subErr);
          }
        }
      }
    }
          
    return {
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
          
// 发送微信订阅消息（已适配实际模板字段）
async function sendSubscribeMessage(openid, notification, task, youthName, elderName) {
  console.log('--- sendSubscribeMessage 开始 ---');
  console.log('openid:', openid);
  console.log('notification:', notification);
  console.log('task:', { id: task._id, desc: task.description });
  console.log('youthName:', youthName, 'elderName:', elderName);

  try {
    const templateId = '5-rezkv5Ou5ph7UMnVjUX2gVZAg4VFgW-5_c137PrX0';
    console.log('使用的模板ID:', templateId);

    // 按照实际模板字段构建数据：
    // 任务标题: thing2.DATA
    // 任务状态: thing3.DATA
    // 操作时间: time8.DATA
    // 备注: thing11.DATA
    const messageData = {
      thing2: { value: task.description.substring(0, 20) },                    // 任务标题
      thing3: { value: notification.title },                                  // 任务状态
      time8: { value: new Date().toLocaleString('zh-CN', { hour12: false }) }, // 操作时间
      thing11: { value: notification.message.length > 20 ? notification.message.substring(0, 20) : notification.message } // 备注
    };
    console.log('订阅消息数据:', messageData);

    const result = await openapi.subscribeMessage.send({
      touser: openid,
      page: '/pages/notifications/notifications',
      data: messageData,
      templateId: templateId,
      miniprogramState: 'trial' // 调试阶段使用 developer，正式上线改为 formal
    });
    console.log('订阅消息 API 返回成功:', result);
    return { code: 0, result };
  } catch (e) {
    console.error('订阅消息 API 调用失败:');
    console.error('错误码:', e.errCode);
    console.error('错误信息:', e.errMsg || e.message);
    console.error('完整错误:', JSON.stringify(e));
    if (e.errCode === 43101) {
      return { code: 43101, msg: '用户未订阅' };
    }
    return { code: -1, msg: '发送失败', error: e.errMsg || e.message };
  }
}