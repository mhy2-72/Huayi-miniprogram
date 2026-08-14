// pages/admin/admin.js
Page({
  data: {
    activeTab: 'complaints',
    pendingCount: 0,
    exchangeCodes: 0,
    taskCount: 0,
    userCount: 0,
    certPendingCount: 0
  },

  onLoad() {
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  async loadStats() {
    try {
      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'getStats' } });
      if (res.result.code === 0) {
        this.setData({
          pendingCount: res.result.data.pendingComplaints || 0,
          exchangeCodes: res.result.data.pendingExchanges || 0,
          taskCount: res.result.data.totalTasks || 0,
          userCount: res.result.data.totalUsers || 0,
          certPendingCount: res.result.data.pendingCertifications || 0
        });
      }
    } catch (e) {
      console.error('加载统计失败', e);
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  goComplaints() {
    wx.navigateTo({ url: '/pages/adminComplaints/adminComplaints' });
  },

  goProducts() {
    wx.navigateTo({ url: '/pages/adminProducts/adminProducts' });
  },

  goTasks() {
    wx.navigateTo({ url: '/pages/adminTasks/adminTasks' });
  },

  goUsers() {
    wx.navigateTo({ url: '/pages/adminUsers/adminUsers' });
  },

  goLivingCircle() {
    wx.navigateTo({ url: '/pages/adminLivingCircle/adminLivingCircle' });
  },

  goLogs() {
    wx.navigateTo({ url: '/pages/adminLogs/adminLogs' });
  },

  goQualifications() {
    wx.navigateTo({ url: '/pages/adminQualifications/adminQualifications' });
  }
});