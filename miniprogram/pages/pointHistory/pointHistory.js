const app = getApp();

Page({
  data: {
    logs: [],
    loading: true
  },

  onShow() {
    this.loadLogs();
  },

  async loadLogs() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPointHistory'
      });
      const logs = res.result.data || [];
      logs.forEach(item => {
        item.createTime_str = this.formatDate(item.createTime);
      });
      this.setData({ logs, loading: false });
    } catch (e) {
      console.error('加载积分记录失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
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
  }
});