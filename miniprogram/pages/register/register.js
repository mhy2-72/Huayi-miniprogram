Page({
  data: {
    avatarUrl: '',
    nickName: '',
    birthday: '',
    gender: 'male',      // 默认男
    today: new Date().toISOString().slice(0, 10),
    genders: [
      { value: 'male', label: '男' },
      { value: 'female', label: '女' }
    ]
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

  async submitRegister() {
    const { nickName, birthday, avatarUrl, gender } = this.data;
    if (!birthday) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }
    if (!gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
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
        gender          // 新增
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.setStorageSync('role', res.result.role);
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
});