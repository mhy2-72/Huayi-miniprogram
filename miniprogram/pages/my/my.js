//miniprogram\pages\my\my.js
const app = getApp();
const { isGuest, exitGuestMode } = require('../../utils/auth.js');

Page({
  data: {
    userInfo: {},
    roleText: '',
    unreadCount: 0,
    isGuest: false
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
    this.loadUnreadCount();
  },

  loadUserInfo() {
    const guest = isGuest();
    this.setData({ isGuest: guest });

    if (guest) {
      this.setData({
        userInfo: { nickName: '暂未登录', avatarUrl: '' },
        roleText: ''
      });
      return;
    }

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
    } else if (role === 'young' || role === 'middle') {
      return gender === 'male' ? '先生' : '女士';
    } else if (role === 'teen') {
      return gender === 'male' ? '少年' : '少女';
    }
  },

  async loadUnreadCount() {
    if (isGuest()) return;
    try {
      const res = await wx.cloud.callFunction({ name: 'getUnreadCount' });
      const count = res.result.count || 0;
      this.setData({ unreadCount: count });
    } catch (e) {
      console.error('获取未读数量失败', e);
    }
  },

  goLogin() {
    wx.reLaunch({ url: '/pages/login/login' });
  },

  goNotifications() {
    if (isGuest()) {
      wx.showModal({
        title: '提示',
        content: '您暂未登录，是否前往登录？',
        confirmText: '去登录',
        cancelText: '否',
        success: (res) => {
          if (res.confirm) {
            wx.reLaunch({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  goPointHistory() {
    if (isGuest()) {
      wx.showModal({
        title: '提示',
        content: '您暂未登录，是否前往登录？',
        confirmText: '去登录',
        cancelText: '否',
        success: (res) => {
          if (res.confirm) {
            wx.reLaunch({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }
    wx.navigateTo({ url: '/pages/pointHistory/pointHistory' });
  },

  goAbout() {
    wx.showModal({
      title: '关于申出圆手',
      content: '申出圆手互助平台，让邻里互助更温暖。',
      showCancel: false
    });
  },

  goComplain() {
    wx.navigateTo({ url: '/pages/complain/complain' });
  },

  goAIChat() {
    wx.navigateTo({ url: '/pages/aichat/aichat' });
  },

  Subscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['5-rezkv5Ou5ph7UMnVjUX2gVZAg4VFgW-5_c137PrX0'],
      success(res) {
        console.log('用户允许了订阅', res);
      },
      fail(err) {
        console.log('用户拒绝了或报错', err);
      }
    })
  },

  deleteAccount() {
    if (isGuest()) {
      wx.showModal({
        title: '提示',
        content: '您暂未登录，是否前往登录？',
        confirmText: '去登录',
        cancelText: '否',
        success: (res) => {
          if (res.confirm) {
            wx.reLaunch({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }
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
            wx.removeStorageSync('role');
            app.globalData.userInfo = null;
            wx.reLaunch({ url: '/pages/login/login' });
          } else if (result.result.code === -2) {
            // 有未完成任务，禁止注销
            let content = result.result.msg;
            if (result.result.details && result.result.details.length > 0) {
              content += '\n\n未完成任务：\n' + result.result.details.slice(0, 5).join('\n');
              if (result.result.details.length > 5) {
                content += `\n... 等共${result.result.unfinishedCount}个`;
              }
            }
            wx.showModal({
              title: '无法注销',
              content: content,
              showCancel: false,
              confirmText: '知道了'
            });
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
