Page({
  data: {
    complaints: [],
    loading: true,
    filter: 'pending',
    filters: [
      { key: 'pending', label: '待处理' },
      { key: 'resolved', label: '已处理' },
      { key: 'all', label: '全部' }
    ],
    currentComplaint: null,
    showDetail: false
  },

  preventBubble() {},

  onLoad() {
    this.loadComplaints();
  },

  onShow() {
    this.loadComplaints();
  },

  onPullDownRefresh() {
    this.loadComplaints().then(() => wx.stopPullDownRefresh());
  },

  async loadComplaints() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: { action: 'getComplaints', filter: this.data.filter }
      });
      if (res.result.code === 0) {
        const complaints = res.result.data.map(c => ({
          ...c,
          createTime_str: this.formatDate(c.createTime),
          typeText: this.getTypeText(c.type),
          evidenceUrls: c.evidenceImages || []
        }));
        this.setData({ complaints });
      }
    } catch (e) {
      console.error('加载申诉失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  getTypeText(type) {
    const map = {
      userInfo: '用户信息变更',
      task: '任务相关',
      exchange: '兑换相关',
      livingCircle: '生活圈信息错误/补充'
    };
    return map[type] || type;
  },

  formatDate(date) {
    if (!date) return '';
    let d;
    if (typeof date === 'object' && date.$date) d = new Date(date.$date);
    else if (typeof date === 'string') d = new Date(date);
    else if (typeof date === 'number') d = new Date(date);
    else return '';
    if (isNaN(d.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  switchFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.loadComplaints());
  },

  viewComplaint(e) {
    const id = e.currentTarget.dataset.id;
    const complaint = this.data.complaints.find(c => c._id === id);
    if (complaint) {
      this.setData({ currentComplaint: complaint, showDetail: true });
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, currentComplaint: null });
  },

  previewEvidence(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({ urls, current: url });
  },

  async handleComplaint(e) {
    const id = e.currentTarget.dataset.id;
    const result = e.currentTarget.dataset.result;
    const isApproved = result === 'resolved';
    
    wx.showModal({
      title: '处理申诉',
      content: isApproved ? '确认通过此申诉？请填写回复内容' : '确认驳回此申诉？请填写回复内容',
      editable: true,
      placeholderText: '请输入对用户的回复内容',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '处理中...' });
          const complaint = this.data.complaints.find(c => c._id === id);
          const submitData = {
            action: 'handleComplaint',
            complaintId: id,
            result: result,
            adminNote: r.content || ''
          };
          if (complaint.type === 'exchange' && complaint.exchangeCode) {
            submitData.exchangeCode = complaint.exchangeCode;
          }
          const res = await wx.cloud.callFunction({ name: 'adminOperations', data: submitData });
          wx.hideLoading();
          if (res.result.code === 0) {
            wx.showToast({ title: '处理成功' });
            this.setData({ showDetail: false });
            this.loadComplaints();
          } else {
            wx.showToast({ title: res.result.msg || '处理失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  },

  goToTask(e) {
    const taskId = e.currentTarget.dataset.taskid;
    wx.navigateTo({ url: `/pages/taskDetail/taskDetail?id=${taskId}` });
  }
});