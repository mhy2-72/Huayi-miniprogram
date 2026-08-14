Page({
  data: {
    tasks: [],
    loading: true,
    filter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'published', label: '待接取' },
      { key: 'accepted', label: '进行中' },
      { key: 'submitted', label: '待评价' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' }
    ],
    statusText: { published: '待接取', accepted: '进行中', submitted: '待评价', completed: '已完成', cancelled: '已取消' },
    statusClass: { published: 'yellow', accepted: 'gray', submitted: 'red', completed: 'blue', cancelled: 'gray' },
    showEditModal: false,
    editingTask: null,
    editStatus: '',
    editRating: 0
  },

  preventBubble() {},

  onLoad() { this.loadTasks(); },
  onShow() { this.loadTasks(); },
  onPullDownRefresh() { this.loadTasks().then(() => wx.stopPullDownRefresh()); },

  async loadTasks() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'getTasks', filter: this.data.filter } });
      if (res.result.code === 0) {
        const tasks = res.result.data.map(t => ({
          ...t,
          createTime_str: this.formatDate(t.createTime),
          statusText: this.data.statusText[t.status] || t.status
        }));
        this.setData({ tasks });
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
  },

  switchFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.loadTasks());
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/taskDetail/taskDetail?id=${id}` });
  },

  editTask(e) {
    const id = e.currentTarget.dataset.id;
    const task = this.data.tasks.find(t => t._id === id);
    if (task) {
      this.setData({ 
        showEditModal: true, 
        editingTask: task, 
        editStatus: task.status, 
        editRating: task.rating || 5 
      });
    }
  },

  async saveEdit() {
    const { editingTask, editStatus, editRating } = this.data;
    try {
      wx.showLoading({ title: '保存中...' });
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: {
          action: 'updateTask',
          taskId: editingTask._id,
          status: editStatus,
          rating: editRating
        }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '保存成功' });
        this.setData({ showEditModal: false });
        this.loadTasks();
      } else {
        wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' });
      }
    } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
  },

  deleteTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定继续？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '删除中...' });
          const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'deleteTask', taskId: id } });
          wx.hideLoading();
          if (res.result.code === 0) { wx.showToast({ title: '已删除' }); this.loadTasks(); }
          else wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' });
        } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
      }
    });
  },

  setRating(e) { this.setData({ editRating: e.currentTarget.dataset.val }); },
  selectStatus(e) { this.setData({ editStatus: e.currentTarget.dataset.key }); },
  closeModal() { this.setData({ showEditModal: false, editingTask: null }); }
});
