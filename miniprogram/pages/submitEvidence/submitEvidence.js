Page({
  data: {
    taskId: '',
    note: '',
    images: [],
    errorMsg: ''
  },
  onLoad(options) {
    if (options.taskId) this.setData({ taskId: options.taskId });
  },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },
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
  async submitEvidence() {
    const { taskId, note, images } = this.data;
    if (!note.trim() && images.length === 0) {
      this.setData({ errorMsg: '请至少填写文字说明或上传一张图片' });
      return;
    }
    wx.showLoading({ title: '提交中...' });
    try {
      let cloudFileIDs = [];
      if (images.length > 0) {
        const uploadPromises = images.map(path => {
          if (path.startsWith('cloud://')) return Promise.resolve(path);
          return wx.cloud.uploadFile({
            cloudPath: `evidence/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`,
            filePath: path
          }).then(res => res.fileID);
        });
        cloudFileIDs = await Promise.all(uploadPromises);
      }
      const res = await wx.cloud.callFunction({
        name: 'submitTask',
        data: { taskId, images: cloudFileIDs, note: note.trim() }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '提交成功' });
        setTimeout(() => wx.navigateBack(), 1000);
      } else {
        this.setData({ errorMsg: res.result.msg });
      }
    } catch (e) {
      wx.hideLoading();
      this.setData({ errorMsg: '网络错误' });
    }
  }
});