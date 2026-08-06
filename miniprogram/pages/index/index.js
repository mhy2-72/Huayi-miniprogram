Page({
  data: {
    role: '',
    myTasks: [],
    published: [],
    myActive: [],
    statusText: {
      published: '待接取',
      accepted: '进行中',
      submitted: '待评价',
      completed: '已完成',
      cancelled: '已取消'
    },
    // 状态对应的 CSS 类名
    statusClass: {
      published: 'status-yellow',
      accepted: 'status-gray',
      submitted: 'status-red',
      completed: 'status-blue',
      cancelled: 'status-gray'
    }
  },

  onLoad() {
    this.setData({ role: wx.getStorageSync('role') });
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadData() {
    return wx.cloud.callFunction({ name: 'getMyTasks' }).then(res => {
      const data = res.result;
      if (data.role === 'elder') {
        this.setData({ myTasks: data.tasks });
      } else {
        this.setData({ published: data.published, myActive: data.myActive });
      }
    }).catch(err => {
      console.error('加载任务失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      throw err;
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