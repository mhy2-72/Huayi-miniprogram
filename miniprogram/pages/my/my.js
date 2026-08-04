const app = getApp();

Page({
  data: {
    userInfo: {},
    roleText: ''   // 新增显示文本
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

  goMyOrders() {
    wx.navigateTo({ url: '/pages/myOrders/myOrders' });
  },

  goAbout() {
    wx.showModal({
      title: '关于我们',
      content: '**互助平台，让邻里互助更温暖。',
      showCancel: false
    });
  }
});