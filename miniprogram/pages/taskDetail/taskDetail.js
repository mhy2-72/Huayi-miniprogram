const app = getApp();

Page({
  data: {
    task: null,
    role: '',
    myOpenid: '',
    rating: 5,
    statusText: {
      published: '待接取',
      accepted: '进行中',
      submitted: '待确认',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad(options) {
    this.setData({
      role: wx.getStorageSync('role'),
      myOpenid: app.globalData.openid
    });
    this.loadTaskDetail(options.id);
  },

  async loadTaskDetail(taskId) {
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyTasks' });
      const data = res.result;
      let task = null;
      if (data.role === 'elder') {
        task = data.tasks.find(t => t._id === taskId);
      } else {
        task = data.published.find(t => t._id === taskId) || data.myActive.find(t => t._id === taskId);
      }
      if (task) this.setData({ task });
      else wx.showToast({ title: '任务不存在', icon: 'none' });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  setRating(e) {
    this.setData({ rating: e.currentTarget.dataset.val });
  },

  async confirmComplete() {
    const { task, rating } = this.data;
    wx.showModal({
      title: '确认完成',
      content: `确认任务已完成并给予 ${rating} 分评价？`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        const res = await wx.cloud.callFunction({
          name: 'confirmTask',
          data: { taskId: task._id, rating }
        });
        if (res.result.code === 0) {
          wx.showToast({ title: '任务完成，积分已发放' });
          this.loadTaskDetail(task._id);
        } else {
          wx.showToast({ title: res.result.msg, icon: 'none' });
        }
      }
    });
  },

  cancel() {
    wx.showModal({
      title: '取消任务',
      content: '确定要取消此任务吗？',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        const res = await wx.cloud.callFunction({
          name: 'cancelTask',
          data: { taskId: this.data.task._id }
        });
        if (res.result.code === 0) {
          wx.showToast({ title: '已取消' });
          this.loadTaskDetail(this.data.task._id);
        } else {
          wx.showToast({ title: res.result.msg, icon: 'none' });
        }
      }
    });
  },

  chooseEvidence() {
    wx.chooseImage({
      count: 3,
      sizeType: ['compressed'],
      success: (res) => {
        this.uploadAndSubmit(res.tempFilePaths);
      }
    });
  },

  async uploadAndSubmit(tempFilePaths) {
    wx.showLoading({ title: '上传中...' });
    try {
      const uploadPromises = tempFilePaths.map(path =>
        wx.cloud.uploadFile({
          cloudPath: `task/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
          filePath: path
        })
      );
      const uploadRes = await Promise.all(uploadPromises);
      const fileIDs = uploadRes.map(f => f.fileID);

      const res = await wx.cloud.callFunction({
        name: 'submitTask',
        data: { taskId: this.data.task._id, images: fileIDs }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '已提交，等待确认' });
        this.loadTaskDetail(this.data.task._id);
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ urls: [url] });
  },

  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
});