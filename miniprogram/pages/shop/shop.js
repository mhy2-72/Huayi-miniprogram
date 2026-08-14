const app = getApp();

Page({
  data: {
    products: [],
    myPoints: 0,
    myOrders: [],
    showOrders: false
  },

  onLoad() {
    this.loadProducts();
    this.loadMyPoints();
    this.loadMyOrders();
  },

  onShow() {
    this.loadMyPoints();
    this.loadMyOrders();
  },

  onPullDownRefresh() {
    Promise.all([this.loadProducts(), this.loadMyPoints(), this.loadMyOrders()]).then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadProducts() {
    return wx.cloud.callFunction({ name: 'getProducts' }).then(res => {
      this.setData({ products: res.result.data });
    }).catch(err => {
      console.error('加载商品失败', err);
      throw err;
    });
  },

  loadMyPoints() {
    const db = wx.cloud.database();
    const openid = app.globalData.openid;
    if (!openid) return Promise.reject('openid为空');
    return db.collection('users').doc(openid).get().then(res => {
      this.setData({ myPoints: res.data.points || 0 });
    }).catch(err => {
      console.error('加载积分失败', err);
      throw err;
    });
  },

  loadMyOrders() {
    return wx.cloud.callFunction({ name: 'getMyOrders' }).then(res => {
      const orders = (res.result.data || []).map(o => ({
        ...o,
        createTime_str: this.formatDate(o.createTime)
      }));
      this.setData({ myOrders: orders });
    }).catch(err => {
      console.error('加载兑换记录失败', err);
    });
  },

  formatDate(date) {
    if (!date) return '';
    let d;
    if (typeof date === 'object' && date.$date) d = new Date(date.$date);
    else if (typeof date === 'string') d = new Date(date);
    else if (typeof date === 'number') d = new Date(date);
    else return '';
    if (isNaN(d.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  exchange(e) {
    const productId = e.currentTarget.dataset.id;
    wx.showLoading({ title: '兑换中...' });
    wx.cloud.callFunction({ name: 'exchangeProduct', data: { productId } }).then(res => {
      wx.hideLoading();
      if (res.result.code === 0) {
        const exchangeCode = res.result.exchangeCode;
        const productName = res.result.productName;
        wx.showModal({
          title: '兑换成功',
          content: `商品：${productName}\n兑换码：${exchangeCode}`,
          showCancel: false,
          confirmText: '我知道了'
        });
        this.setData({ myPoints: res.result.pointsAfter });
        this.loadProducts();
        this.loadMyOrders();
      } else {
        wx.showToast({ title: res.result.msg || '兑换失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('兑换失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  toggleOrders() {
    this.setData({ showOrders: !this.data.showOrders });
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '兑换码已复制' })
    });
  }
});