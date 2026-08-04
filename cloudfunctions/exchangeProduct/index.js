const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const userId = wxContext.OPENID;
  const { productId } = event;

  if (!productId) return { code: -1, msg: '商品ID不能为空' };

  try {
    // 使用事务保证数据一致性
    const result = await db.runTransaction(async transaction => {
      // 获取商品信息
      const product = await transaction.collection('products').doc(productId).get();
      if (!product.data) throw new Error('商品不存在');
      if (product.data.stock <= 0) throw new Error('库存不足');

      // 获取用户信息
      const user = await transaction.collection('users').doc(userId).get();
      if (!user.data) throw new Error('用户不存在');
      if (user.data.points < product.data.points) throw new Error('积分不足');

      // 扣减库存
      await transaction.collection('products').doc(productId).update({
        data: { stock: db.command.inc(-1) }
      });

      // 扣减用户积分
      await transaction.collection('users').doc(userId).update({
        data: { points: db.command.inc(-product.data.points) }
      });

      // 生成订单
      const orderRes = await transaction.collection('orders').add({
        data: {
          userId,
          productId,
          pointsCost: product.data.points,
          status: 'pending',
          createTime: new Date(),
          code: Math.random().toString(36).slice(2, 10).toUpperCase() // 简单核销码
        }
      });

      return { orderId: orderRes._id };
    });

    return { code: 0, msg: '兑换成功', data: result };
  } catch (e) {
    console.error('兑换失败:', e);
    return { code: -1, msg: e.message || '兑换失败，请稍后重试' };
  }
};