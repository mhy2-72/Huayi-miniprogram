Page({
  data: {
    logs: [],
    loading: true
  },

  onLoad() { this.loadLogs(); },
  onShow() { this.loadLogs(); },
  onPullDownRefresh() { this.loadLogs().then(() => wx.stopPullDownRefresh()); },

  async loadLogs() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'getLogs' } });
      if (res.result.code === 0) {
        const logs = res.result.data.map(l => ({
          ...l,
          createTime_str: this.formatDate(l.createTime)
        }));
        this.setData({ logs });
      }
    } catch (e) { console.error(e); }
    finally { this.setData({ loading: false }); }
  },

  formatDate(date) {
    if (!date) return '';
    let d = (typeof date === 'object' && date.$date) ? new Date(date.$date) : new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
});