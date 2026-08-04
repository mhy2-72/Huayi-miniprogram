Page({
  data: {
    role: '',
    myTasks: [],
    published: [],
    myActive: [],
    statusText: {
      published: '待接取',
      accepted: '进行中',
      submitted: '待确认',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    this.setData({ role: wx.getStorageSync('role') });
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    wx.cloud.callFunction({ name: 'getMyTasks' }).then(res => {
      const data = res.result;
      if (data.role === 'elder') {
        this.setData({ myTasks: data.tasks });
      } else {
        this.setData({ published: data.published, myActive: data.myActive });
      }
    }).catch(err => {
      console.error('加载任务失败', err);
    });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/taskDetail/taskDetail?id=${id}` });
  },

  accept(e) {
    const taskId = e.currentTarget.dataset.id;
    wx.cloud.callFunction({ name: 'acceptTask', data: { taskId } }).then(res => {
      if (res.result.code === 0) {
        wx.showToast({ title: '已接取' });
        this.loadData();
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    });
  }
});