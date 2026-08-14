//cloudfunctions\exchangeProduct\index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const userId = wxContext.OPENID;
  const { productId } = event;

  if (!productId) return { code: -1, msg: '商品ID不能为空' };

  try {
    let exchangeCode = '';
    let productName = '';
    let costPoints = 0;

    const result = await db.runTransaction(async transaction => {
      const product = await transaction.collection('products').doc(productId).get();
      if (!product.data) throw new Error('商品不存在');
      if (product.data.stock <= 0) throw new Error('库存不足');

      const user = await transaction.collection('users').doc(userId).get();
      if (!user.data) throw new Error('用户不存在');
      if (user.data.points < product.data.points) throw new Error('积分不足');

      costPoints = product.data.points;

      // 扣减库存和积分
      await transaction.collection('products').doc(productId).update({
        data: { stock: db.command.inc(-1) }
      });
      await transaction.collection('users').doc(userId).update({
        data: { points: db.command.inc(-costPoints) }
      });

      exchangeCode = Math.random().toString(36).slice(2, 10).toUpperCase();
      productName = product.data.name;

      const now = new Date();

      // 创建订单（待兑换状态）
      await transaction.collection('orders').add({
        data: {
          userId,
          productId,
          pointsCost: costPoints,
          status: 'pending',
          createTime: now,
          code: exchangeCode
        }
      });

      // 同步写入兑换码记录，便于管理员查询和申诉关联
      await transaction.collection('exchangeCodes').add({
        data: {
          code: exchangeCode,
          userId,
          productId,
          productName,
          pointsCost: costPoints,
          status: 'pending',
          createTime: now,
          source: 'user_exchange'
        }
      });

      return { pointsAfter: user.data.points - costPoints, exchangeCode, productName, costPoints };
    });

    // 写入积分消费日志
    await db.collection('pointLogs').add({
      data: {
        userId,
        amount: -costPoints,
        type: 'expense',
        desc: `兑换“${productName}”消费${costPoints}积分，兑换码：${exchangeCode}`,
        createTime: new Date()
      }
    });

    // 发送通知
    await db.collection('notifications').add({
      data: {
        userId,
        title: '兑换成功',
        message: `您已成功兑换「${productName}」，兑换码：${exchangeCode}`,
        taskId: '',
        type: 'exchange',
        read: false,
        createTime: new Date()
      }
    });

    return {
      code: 0,
      msg: '兑换成功',
      pointsAfter: result.pointsAfter,
      exchangeCode,
      productName
    };
  } catch (e) {
    console.error('exchangeProduct error:', e);
    return { code: -1, msg: e.message || '兑换失败' };
  }
};