const app = getApp();

Page({
  data: {
    products: [],
    myPoints: 0
  },

  onLoad() {
    this.loadProducts();
    this.loadMyPoints();
  },

  onShow() {
    this.loadMyPoints();
  },

  onPullDownRefresh() {
    Promise.all([this.loadProducts(), this.loadMyPoints()]).then(() => {
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

  exchange(e) {
    const productId = e.currentTarget.dataset.id;
    wx.cloud.callFunction({ name: 'exchangeProduct', data: { productId } }).then(res => {
      if (res.result.code === 0) {
        wx.showToast({ title: '兑换成功' });
        if (res.result.pointsAfter !== undefined) {
          this.setData({ myPoints: res.result.pointsAfter });
        }
        this.loadProducts();
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    }).catch(err => {
      console.error('兑换失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
});