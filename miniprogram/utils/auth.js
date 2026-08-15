// utils/auth.js — 登录状态判断与拦截工具
const app = getApp();

function isGuest() {
  return wx.getStorageSync('isGuest') === true;
}

function requireLogin() {
  if (!isGuest()) return true;
  wx.showModal({
    title: '提示',
    content: '您暂未登录，是否前往登录？',
    confirmText: '去登录',
    cancelText: '否',
    success: (res) => {
      if (res.confirm) {
        wx.removeStorageSync('isGuest');
        if (app && app.globalData) {
          app.globalData.isGuest = false;
        }
        wx.reLaunch({ url: '/pages/login/login' });
      }
    }
  });
  return false;
}

function enterGuestMode() {
  wx.setStorageSync('isGuest', true);
  wx.removeStorageSync('role');
  if (app && app.globalData) {
    // 保留 openid，用户返回登录时无需重新获取
    app.globalData.isGuest = true;
  }
}

function exitGuestMode() {
  wx.removeStorageSync('isGuest');
  if (app && app.globalData) {
    app.globalData.isGuest = false;
  }
}

module.exports = { isGuest, requireLogin, enterGuestMode, exitGuestMode };
