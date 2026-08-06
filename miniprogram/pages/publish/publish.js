Page({
  data: {
    description: '',
    images: []
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
    const { description, images } = this.data;
    if (!description.trim()) {
      wx.showToast({ title: '请输入任务描述', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发布中...' });
    try {
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

      const res = await wx.cloud.callFunction({
        name: 'publishTask',
        data: { description: description.trim(), images: cloudFileIDs }
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
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
});