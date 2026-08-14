Page({
  data: {
    qualifications: [],
    loading: true,
    filter: 'pending',
    filters: [
      { key: 'pending', label: '待审核' },
      { key: 'resolved', label: '已审核' },
      { key: 'all', label: '全部' }
    ],
    currentItem: null,
    showDetail: false,
    adminNote: ''
  },

  preventBubble() {},

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: { action: 'getQualifications', filter: this.data.filter }
      });
      if (res.result.code === 0) {
        const list = res.result.data.map(c => ({
          ...c,
          createTime_str: this.formatDate(c.createTime),
          statusText: this.getStatusText(c.status),
          evidenceUrls: c.evidenceImages || []
        }));
        this.setData({ qualifications: list });
      }
    } catch (e) {
      console.error('加载资质失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  getStatusText(status) {
    const map = { pending: '待审核', resolved: '已通过', rejected: '已驳回' };
    return map[status] || status;
  },

  switchFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => {
      this.loadData();
    });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.qualifications.find(q => q._id === id);
    if (item) {
      this.setData({ currentItem: item, showDetail: true, adminNote: '' });
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, currentItem: null, adminNote: '' });
  },

  onNoteInput(e) {
    this.setData({ adminNote: e.detail.value });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.currentItem.evidenceUrls || [];
    wx.previewImage({ urls, current: url });
  },

  async handleResult(e) {
    const result = e.currentTarget.dataset.result;
    const item = this.data.currentItem;
    if (!item) return;

    wx.showModal({
      title: result === 'resolved' ? '确认通过' : '确认驳回',
      content: result === 'resolved'
        ? `确定通过用户「${item.userName}」的${item.certTypeName}资质认证？通过后用户将可以接取需要该资质的任务。`
        : `确定驳回用户「${item.userName}」的${item.certTypeName}资质认证？`,
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '处理中...' });
          const res = await wx.cloud.callFunction({
            name: 'adminOperations',
            data: { action: 'handleComplaint', complaintId: item._id, result, adminNote: this.data.adminNote }
          });
          wx.hideLoading();
          if (res.result.code === 0) {
            wx.showToast({ title: result === 'resolved' ? '已通过' : '已驳回' });
            this.setData({ showDetail: false, currentItem: null });
            this.loadData();
          } else {
            wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  }
});
