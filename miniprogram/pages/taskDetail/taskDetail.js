// pages/taskDetail/taskDetail.js
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
      submitted: '待评价',
      completed: '已完成', 
      cancelled: '已取消'
    }
  },

  onLoad(options) {
    this.setData({ 
      role: wx.getStorageSync('role'), 
      myOpenid: app.globalData.openid 
    });
    if (options.id) {
      this.loadTaskDetail(options.id);
    }
  },

  onPullDownRefresh() {
    const taskId = this.data.task?._id;
    if (!taskId) { 
      wx.stopPullDownRefresh(); 
      return; 
    }
    this.loadTaskDetail(taskId).finally(() => wx.stopPullDownRefresh());
  },

  async loadTaskDetail(taskId) {
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyTasks' });
      const data = res.result;
      let task = null;
      
      if (data.role === 'elder') {
        task = data.tasks.find(t => t._id === taskId);
      } else {
        task = data.published.find(t => t._id === taskId) || 
               data.myActive.find(t => t._id === taskId);
      }
      
      if (task) {
        const processed = await this.processTask(task);
        this.setData({ task: processed });
        // 检测自动取消原因并弹窗
        this.checkAutoCancelReason(processed);
      } else {
        wx.showToast({ title: '任务不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1000);
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 检测自动取消原因并弹窗
  checkAutoCancelReason(task) {
    if (task.status !== 'cancelled') return;
    if (!task.cancelReason) return;
    
    if (task.cancelReason.includes('8小时') || task.cancelReason.includes('未被接取')) {
      wx.showModal({
        title: '任务已自动取消',
        content: `该任务发布超过8小时未被接取，系统已自动取消。\n\n如需发布新任务，请重新创建。`,
        showCancel: false,
        confirmText: '我知道了'
      });
    } else if (task.cancelReason.includes('超时') || task.cancelReason.includes('截止时间')) {
      wx.showModal({
        title: '任务超时取消',
        content: `该任务超过截止时间未完成，已被系统自动取消。`,
        showCancel: false,
        confirmText: '我知道了'
      });
    }
  },

  async processTask(task) {
    const newTask = { ...task };
    const fields = ['createTime','acceptTime','deadline','submitTime','completeTime'];
    fields.forEach(f => { 
      if (newTask[f]) {
        newTask[f+'_str'] = this.formatDate(newTask[f]); 
      }
    });
    
    // 老人附图
    if (newTask.images?.length) {
      try {
        const r = await wx.cloud.getTempFileURL({ fileList: newTask.images });
        newTask.imageUrls = r.fileList.map(i => i.tempFileURL);
      } catch (e) { 
        newTask.imageUrls = []; 
      }
    } else {
      newTask.imageUrls = [];
    }
    
    // 凭证图片
    if (newTask.evidenceImages?.length) {
      try {
        const r = await wx.cloud.getTempFileURL({ fileList: newTask.evidenceImages });
        newTask.evidenceImageUrls = r.fileList.map(i => i.tempFileURL);
      } catch (e) { 
        newTask.evidenceImageUrls = []; 
      }
    } else {
      newTask.evidenceImageUrls = [];
    }
    
    return newTask;
  },

  formatDate(date) {
    if (!date) return '';
    let d;
    if (typeof date === 'object' && date.$date) d = new Date(date.$date);
    else if (typeof date === 'string') d = new Date(date);
    else if (typeof date === 'number') d = new Date(date);
    else if (date instanceof Date) d = date;
    else return '格式错误';
    if (isNaN(d.getTime())) return '解析失败';
    const pad = n => n.toString().padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  setRating(e) { 
    this.setData({ rating: e.currentTarget.dataset.val }); 
  },

  async confirmComplete() {
    const { task, rating } = this.data;
    wx.showModal({
      title: '确认完成', 
      content: `给予 ${rating} 分评价？`,
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await wx.cloud.callFunction({ 
            name: 'confirmTask', 
            data: { taskId: task._id, rating } 
          });
          if (res.result.code === 0) { 
            wx.showToast({ title: '评价成功' }); 
            this.loadTaskDetail(task._id); 
          } else {
            wx.showToast({ title: res.result.msg, icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  cancel() {
    wx.showModal({
      title: '取消任务', 
      content: '确定取消此任务？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await wx.cloud.callFunction({ 
            name: 'cancelTask', 
            data: { 
              taskId: this.data.task._id,
              cancelReason: '用户主动取消'
            } 
          });
          if (res.result.code === 0) { 
            wx.showToast({ title: '已取消' }); 
            this.loadTaskDetail(this.data.task._id); 
          } else {
            wx.showToast({ title: res.result.msg, icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '取消失败', icon: 'none' });
        }
      }
    });
  },

  cancelAccept() {
    wx.showModal({
      title: '取消接取', 
      content: '确定放弃此任务？截止时间将延长3小时。',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await wx.cloud.callFunction({ 
            name: 'cancelTask', 
            data: { 
              taskId: this.data.task._id,
              cancelReason: '年轻人主动放弃接取'
            } 
          });
          if (res.result.code === 0) { 
            wx.showToast({ title: '已取消接取' }); 
            this.loadTaskDetail(this.data.task._id); 
          } else {
            wx.showToast({ title: res.result.msg, icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  goSubmitEvidence() {
    wx.navigateTo({ 
      url: `/pages/submitEvidence/submitEvidence?taskId=${this.data.task._id}` 
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.task.imageUrls || [];
    wx.previewImage({ urls, current: url });
  }
});