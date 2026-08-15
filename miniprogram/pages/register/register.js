//miniprogram\pages\register\register.js
const { exitGuestMode } = require('../../utils/auth.js');

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    birthday: '',
    gender: 'male',
    occupationIndex: 0,
    occupations: ['退休', '教师', '医护人员', '工人', '公务员', '自由职业','工程师','心理咨询师','律师','记者','消防员','社区工作者','学生', '其他'],
    today: new Date().toISOString().slice(0, 10),
    genders: [
      { value: 'male', label: '男' },
      { value: 'female', label: '女' }
    ],
    agreed: false    // 用户协议复选框状态
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl });
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onBirthdayChange(e) {
    this.setData({ birthday: e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ gender: e.detail.value });
  },

  onOccupationChange(e) {
    this.setData({ occupationIndex: e.detail.value });
  },

  // 复选框事件
  onAgreeChange() {
    this.setData({ agreed: !this.data.agreed });
  },

  async submitRegister() {
    const { nickName, birthday, avatarUrl, gender, occupations, occupationIndex, agreed } = this.data;
    const occupation = occupations[occupationIndex];

    if (!birthday) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }
    if (!occupation) {
      wx.showToast({ title: '请选择职业', icon: 'none' });
      return;
    }
    if (!agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '注册中...' });

    let cloudAvatarUrl = '';
    if (avatarUrl) {
      try {
        const res = await wx.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`,
          filePath: avatarUrl
        });
        cloudAvatarUrl = res.fileID;
      } catch (err) {
        console.error('头像上传失败', err);
      }
    }

    wx.cloud.callFunction({
      name: 'register',
      data: {
        nickName: nickName.trim() || '微信用户',
        avatarUrl: cloudAvatarUrl,
        birthday,
        gender,
        occupation
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result.code === 0) {
        // 注册成功，退出体验模式，恢复正常用户身份
        exitGuestMode();
        wx.setStorageSync('role', res.result.role);
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // 跳转到用户协议页面（如需，可自行实现）
  showAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  }
});