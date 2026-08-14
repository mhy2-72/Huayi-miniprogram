//miniprogram\pages\login\login.js
const app = getApp();

Page({
  data: {
    isChecking: true,
    needRegister: false,
    error: false,
    userInfo: null,
    greeting: '',
    isAdmin: false
  },

  async onLoad() {
    let count = 0;
    while (!app.globalData.openid && count < 30) {
      await new Promise(resolve => setTimeout(resolve, 100));
      count++;
    }
    if (!app.globalData.openid) {
      try {
        const res = await wx.cloud.callFunction({ name: 'login' });
        app.globalData.openid = res.result.openid;
      } catch (e) {
        console.error(e);
        this.setData({ isChecking: false, error: true });
        return;
      }
    }
    this.checkUser();
  },

  async checkUser() {
    this.setData({ isChecking: true, error: false });
    const openid = app.globalData.openid;
    if (!openid) {
      this.setData({ isChecking: false, error: true });
      return;
    }

    try {
      const db = wx.cloud.database();
      const res = await db.collection('users').where({ _id: openid }).get();
      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        wx.setStorageSync('role', user.role);
        const greeting = this.getGreeting(user.role, user.gender);
        this.setData({ isChecking: false, needRegister: false, userInfo: user, greeting, isAdmin: user.admin === true });
      } else {
        this.setData({ isChecking: false, needRegister: true });
      }
    } catch (err) {
      console.error(err);
      this.setData({ isChecking: false, error: true });
    }
  },

  getGreeting(role, gender) {
    if (role === 'elder') {
      return gender === 'male' ? '爷爷' : '奶奶';
    } else {
      return gender === 'male' ? '先生' : '女士';
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  goRegister() {
    wx.redirectTo({ url: '/pages/register/register' });
  },

  retry() {
    this.checkUser();
  },

  //进入AIChat界面
  goAIChat() {
    wx.navigateTo({ url: '/pages/aichat/aichat' });
  },
  
  // 跳转用户协议页面
  showAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  }

});