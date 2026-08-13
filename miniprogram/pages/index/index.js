// pages/index/index.js
Page({
  data: {
    role: '',
    myTasks: [],
    published: [],
    myActive: [],
    loading: true,
    statusText: {
      published: '待接取',
      accepted: '进行中',
      submitted: '待评价',
      completed: '已完成',
      cancelled: '已取消'
    },
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

  async getUnreadCount(){
    try{
      const res = await wx.cloud.callFunction({name:'getUnreadCount'});
      const count = res.result.count || 0;
    }catch(e){
      console.error('获取未读数量失败:',e);
    }
  },

  showNotificationPopup(count) {
    wx.showModal({
      title: '📨 新消息提醒',
      content: `您有 ${count} 条新的任务通知，快去看看吧！`,
      confirmText: '去查看',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/notifications/notifications'
          });
        }
      }
    });
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
    this.setData({ loading: true });
    return wx.cloud.callFunction({ name: 'getMyTasks' }).then(async res => {
      const data = res.result;
      // 非 teen 用户作为发布者，显示自己发布的任务
      if (data.role !== 'teen') {
        const tasks = await this.processTasks(data.tasks);
        this.setData({ myTasks: tasks, loading: false });
        this.checkAutoCancelledTasks(tasks);
      } else {
        // teen 用户作为接取者，显示可接任务和自己接取的任务
        const published = await this.processTasks(data.published);
        const myActive = await this.processTasks(data.myActive);
        this.setData({ published, myActive, loading: false });
        const allTasks = [...published, ...myActive];
        this.checkAutoCancelledTasks(allTasks);
      }
    }).catch(err => {
      console.error('加载任务失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
      throw err;
    });
  },

  async processTasks(tasks) {
    if (!tasks || tasks.length === 0) return tasks;
    const processed = [];
    for (const task of tasks) {
      const newTask = { ...task };
      const fields = ['createTime', 'acceptTime', 'deadline', 'submitTime', 'completeTime'];
      fields.forEach(f => {
        if (newTask[f]) {
          newTask[f + '_str'] = this.formatDate(newTask[f]);
        }
      });
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
      processed.push(newTask);
    }
    return processed;
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
  
  checkAutoCancelledTasks(tasks) {
    if (!tasks || tasks.length === 0) return;
    const autoCancelled = tasks.filter(t =>
      t.status === 'cancelled' &&
      t.cancelReason &&
      (t.cancelReason.includes('8小时') || t.cancelReason.includes('未被接取'))
    );
    if (autoCancelled.length === 0) return;
    const promptedIds = wx.getStorageSync('autoCancelPrompted') || [];
    const newCancelled = autoCancelled.filter(t => !promptedIds.includes(t._id));
    if (newCancelled.length === 0) return;
    const task = newCancelled[0];
    const taskName = task.title || task.description?.substring(0, 15) || '未命名任务';
    const roleText = this.data.role === 'teen' ? '接取' : '发布';
    wx.showModal({
      title: '任务已自动取消',
      content: `您${roleText}的任务 "${taskName}" 超过8小时未被接取，已被系统自动取消。`,
      showCancel: false,
      confirmText: '我知道了',
      success: () => {
        const newPromptedIds = [...promptedIds, ...newCancelled.map(t => t._id)];
        wx.setStorageSync('autoCancelPrompted', newPromptedIds);
      }
    });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  },

  goLivingCircle() {
    wx.navigateTo({ url: '/pages/livingCircle/livingCircle' });
  },
  
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/taskDetail/taskDetail?id=${id}` });
  },

  async accept(e) {
    const taskId = e.currentTarget.dataset.id;
    try {
      const res = await wx.cloud.callFunction({
        name:'acceptTask',
        data: { taskId }
      });
      if (res.result.code === 0){
        await this.sendNotification(taskId,'accepted');
        wx.showToast({title:'已接取'});
        this.loadData();
      }else{
        wx.showToast({title:res.result.msg,icon:'none)'});
      }
    }catch(e){
      wx.showToast({title:'操作失败',icon:'none'});
    }
  },

  async sendNotification(taskId,type) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMyTasks'
      });
      const data = res.result;
      let task = null;
      if (data.role !== 'teen') {
        task = data.tasks.find(t => t._id === taskId);
      } else {
        task = data.published.find(t => t._id === taskId) || 
               data.myActive.find(t => t._id === taskId);
      }
      if (!task) return;
      await wx.cloud.callFunction({
        name: 'sendTaskNotification',
        data: {
          taskId: taskId,
          type: type,
          taskData: {
            _id: task._id,
            description: task.description,
            elderId: task.elderId,
            youthId: task.youthId
          }
        }
      });
    } catch (e) {
      console.error('发送通知失败:', e);
    }
  },  

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls || [];
    wx.previewImage({ urls, current: url });
  }
});