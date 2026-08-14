Page({
  data: {
    pendingCount: 0,
    taskCount: 0,
    userCount: 0,
    certPendingCount: 0,
    redeemCode: '',
    redeemResult: null,
    redeemLoading: false
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
          taskCount: res.result.data.totalTasks || 0,
          userCount: res.result.data.totalUsers || 0,
          certPendingCount: res.result.data.pendingCertifications || 0
        });
      }
    } catch (e) {
      console.error('加载统计失败', e);
    }
  },

  onRedeemInput(e) {
    this.setData({ redeemCode: e.detail.value, redeemResult: null });
  },

  async doRedeem() {
    const code = this.data.redeemCode;
    if (!code || !code.trim()) {
      wx.showToast({ title: '请输入兑换码', icon: 'none' });
      return;
    }
    this.setData({ redeemLoading: true, redeemResult: null });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: { action: 'redeemExchangeCode', code }
      });
      this.setData({ redeemLoading: false });
      if (res.result.code === 0) {
        this.setData({ redeemResult: { success: true, ...res.result.data } });
      } else {
        this.setData({ redeemResult: { success: false, msg: res.result.msg || '兑换码无效' } });
      }
    } catch (e) {
      this.setData({ redeemLoading: false });
      this.setData({ redeemResult: { success: false, msg: '网络错误，请重试' } });
    }
  },

  clearRedeem() {
    this.setData({ redeemCode: '', redeemResult: null });
  },

  goComplaints() {
    wx.navigateTo({ url: '/pages/adminComplaints/adminComplaints' });
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
  },

  goProducts() {
    wx.navigateTo({ url: '/pages/adminProducts/adminProducts' });
  }
});
