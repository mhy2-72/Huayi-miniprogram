Page({
  data: {
    description: '',
    images: [],
    difficulty: 2,
  },

  setDifficulty(e) {  // 空函数，设置difficulty
    const val = e.currentTarget.dataset.val;
    this.setData({
      difficulty: val
    });
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  chooseImage() {
    const remain = 3 - this.data.images.length;
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({ images: this.data.images.concat(res.tempFilePaths) });
      }
    });
  },

  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] });
  },

  async submit() {
    const { description, images, difficulty } = this.data;
    if (!description.trim()) {
      wx.showToast({ title: '请输入任务描述', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发布中...' });

    try {
      // 上传图片（如有）
      let cloudFileIDs = [];
      if (images.length > 0) {
        const uploadPromises = images.map(path => {
          if (path.startsWith('cloud://')) return Promise.resolve(path);
          return wx.cloud.uploadFile({
            cloudPath: `task/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`,
            filePath: path
          }).then(res => res.fileID);
        });
        cloudFileIDs = await Promise.all(uploadPromises);
      }

      // 调用云函数
      const res = await wx.cloud.callFunction({
        name: 'publishTask',
        data: {
          description: description.trim(),
          images: cloudFileIDs,
          difficulty: difficulty
        }
      });

      wx.hideLoading();

      if (res.result.code === 0) {
        wx.showModal({
          title: '发布成功',
          content: '任务已成功发布',
          showCancel: false,
          success: () => wx.navigateBack()
        });
      } else {
        // 显示云函数返回的错误信息
        wx.showToast({ title: res.result.msg || '发布失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('发布任务失败', err);
      // 显示具体异常信息（如“上传失败：xxx”或“云函数调用失败”）
      wx.showToast({
        title: err.errMsg || err.message || '网络错误，请重试',
        icon: 'none',
        duration: 2500
      });
    }
  }
});