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

  loadProducts() {
    wx.cloud.callFunction({ name: 'getProducts' }).then(res => {
      this.setData({ products: res.result.data });
    });
  },

  loadMyPoints() {
    const db = wx.cloud.database();
    const openid = getApp().globalData.openid;
    db.collection('users').doc(openid).get().then(res => {
      this.setData({ myPoints: res.data.points || 0 });
    });
  },

  exchange(e) {
    const productId = e.currentTarget.dataset.id;
    wx.cloud.callFunction({ name: 'exchangeProduct', data: { productId } }).then(res => {
      if (res.result.code === 0) {
        wx.showToast({ title: '兑换成功' });
        this.loadProducts();
        this.loadMyPoints();
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    });
  }
});