Page({
  data: {
    avatarUrl: '',
    nickName: '',
    birthday: '',
    gender: 'male',
    occupationIndex: 0,
    occupations: ['退休', '教师', '医护人员', '工人', '公务员', '自由职业', '其他'],
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

  onOccupationChange(e) {
    this.setData({ occupationIndex: e.detail.value });
  },

  async submitRegister() {
    const { nickName, birthday, avatarUrl, gender, occupations, occupationIndex } = this.data;
    const occupation = occupations[occupationIndex];

    if (!birthday) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }
    if (!occupation) {
      wx.showToast({ title: '请选择职业', icon: 'none' });
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
        occupation       // 新增职业字段
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