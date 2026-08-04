// login.js
const app = getApp();

Page({
  data: {
    isChecking: true,
    needRegister: false,
    error: false,
    userInfo: null,
    greeting: ''    // 新增问候语
  },

  async onLoad() {
    // 等待 openid （同前）
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
        // 生成称呼
        const greeting = this.getGreeting(user.role, user.gender);
        this.setData({ isChecking: false, needRegister: false, userInfo: user, greeting });

        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 800);
      } else {
        this.setData({ isChecking: false, needRegister: true });
      }
    } catch (err) {
      console.error(err);
      this.setData({ isChecking: false, error: true });
    }
  },

  // 根据角色和性别返回称呼
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

  goRegister() {
    wx.redirectTo({ url: '/pages/register/register' });
  },

  retry() {
    this.checkUser();
  }
});