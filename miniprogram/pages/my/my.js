const app = getApp();

Page({
  data: {
    userInfo: {},
    roleText: ''
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const db = wx.cloud.database();
    const openid = app.globalData.openid;
    if (!openid) return;
    db.collection('users').doc(openid).get().then(res => {
      const user = res.data;
      const roleText = this.getRoleText(user.role, user.gender);
      this.setData({ userInfo: user, roleText });
    }).catch(err => {
      console.error('获取用户信息失败', err);
      wx.reLaunch({ url: '/pages/login/login' });
    });
  },

  getRoleText(role, gender) {
    if (role === 'elder') {
      return gender === 'male' ? '爷爷' : '奶奶';
    } else {
      return gender === 'male' ? '先生' : '女士';
    }
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  goPointHistory() {
    wx.navigateTo({ url: '/pages/pointHistory/pointHistory' });
  },

  goAbout() {
    wx.showModal({
      title: '关于申出圆手',
      content: '申出圆手互助平台，让邻里互助更温暖。',
      showCancel: false
    });
  },

  deleteAccount() {
    wx.showModal({
      title: '注销账号',
      content: '注销后您的所有信息将被清除，此操作不可恢复，确定继续？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: '注销中...' });
          const result = await wx.cloud.callFunction({
            name: 'deleteAccount'
          });
          wx.hideLoading();
          if (result.result.code === 0) {
            // 清除本地缓存
            wx.removeStorageSync('role');
            app.globalData.userInfo = null;
            wx.reLaunch({ url: '/pages/login/login' });
          } else {
            wx.showToast({ title: result.result.msg || '注销失败', icon: 'none' });
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  }
});