const app = getApp();

Page({
  data: {
    logs: [],
    loading: true
  },
  onLoad() {
    this.loadLogs();
  },
  async loadLogs() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPointHistory'
      });
      this.setData({
        logs: res.result.data || [],
        loading: false
      });
    } catch (e) {
      console.error('加载积分记录失败', e);
      this.setData({ loading: false });
    }
  }
});