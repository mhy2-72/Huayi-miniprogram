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
      const res = await wx.cloud.callFunction({
        name: 'getNotifications'
      });
      
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
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  goToTaskDetail(e) {
    const taskId = e.currentTarget.dataset.taskid;
    const notifId = e.currentTarget.dataset.id;
    
    if (taskId) {
      this.markAsRead(notifId);
      wx.navigateTo({
        url: `/pages/taskDetail/taskDetail?id=${taskId}`
      });
    } else {
      wx.showToast({ title: '任务已删除', icon: 'none' });
    }
  },

  async markAsRead(notifId) {
    try {
      await wx.cloud.callFunction({
        name: 'markNotificationRead',
        data: { notificationId: notifId }
      });
    } catch (e) {
      console.error('标记已读失败:', e);
    }
  }
});