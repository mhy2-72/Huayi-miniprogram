// app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-d3gqpcznd38f2891a',   // 换成你自己的
      traceUser: true
    });
    this.getOpenid();
  },

  async getOpenid() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' });
      this.globalData.openid = res.result.openid;
    } catch (err) {
      console.error('获取 openid 失败', err);
    }
  },

  globalData: {
    openid: ''
  }
});