// pages/notifications/notifications.js
Page({
  data: {
    notifications: [],
    loading: false
  },

  onShow() {
    this.loadNotifications();
  },

  onPullDownRefresh() {
    this.loadNotifications().finally(() => wx.stopPullDownRefresh());
  },

  async loadNotifications() {
    try {
      this.setData({ loading: true });
      const res = await wx.cloud.callFunction({ name: 'getNotifications' });
      const notifications = res.result.data || [];
      notifications.forEach(item => {
        item.createTime_str = this.formatDate(item.createTime);
      });
      this.setData({ notifications });
    } catch (e) {
      console.error('加载通知失败:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  formatDate(date) {
    if (!date) return '';
    let d;
    if (typeof date === 'object' && date.$date) d = new Date(date.$date);
    else if (typeof date === 'string') d = new Date(date);
    else if (typeof date === 'number') d = new Date(date);
    else if (date instanceof Date) d = date;
    else return '';
    if (isNaN(d.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  goToTaskDetail(e) {
    const taskId = e.currentTarget.dataset.taskid;
    const notifId = e.currentTarget.dataset.id;

    // 先标记已读并立即更新本地状态
    this.markAsRead(notifId);

    if (taskId) {
      wx.navigateTo({
        url: `/pages/taskDetail/taskDetail?id=${taskId}`
      });
    } else {
      // 无关联任务的通知，仅提示已读
      wx.showToast({ title: '已标记已读', icon: 'none' });
    }
  },

  markAsRead(notifId) {
    // 立即更新本地状态（视觉上立刻变灰）
    const updatedList = this.data.notifications.map(item => {
      if (item._id === notifId) {
        return { ...item, read: true };
      }
      return item;
    });
    this.setData({ notifications: updatedList });

    // 异步调用云函数，失败时恢复本地状态（可选）
    wx.cloud.callFunction({
      name: 'markNotificationRead',
      data: { notificationId: notifId }
    }).catch(err => {
      console.error('标记已读失败:', err);
      // 若云函数失败，可恢复未读状态（但一般不处理，避免频繁闪动）
    });
  }
});