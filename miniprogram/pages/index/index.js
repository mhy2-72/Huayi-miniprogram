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
    return wx.cloud.callFunction({ name: 'getMyTasks' }).then(async res => {
      const data = res.result;
      if (data.role === 'elder') {
        // 处理老人的任务列表（含附图）
        const tasks = await this.processTasks(data.tasks);
        this.setData({ myTasks: tasks });
        this.checkAutoCancelledTasks(tasks);
      } else {
        // 处理年轻人的任务列表（含附图 + 凭证图片）
        const published = await this.processTasks(data.published);
        const myActive = await this.processTasks(data.myActive);
        this.setData({ published, myActive });
        const allTasks = [...published, ...myActive];
        this.checkAutoCancelledTasks(allTasks);
      }
    }).catch(err => {
      console.error('加载任务失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      throw err;
    });
  },

  // ========== 处理任务图片（老人附图 + 凭证图片） ==========
  async processTasks(tasks) {
    if (!tasks || tasks.length === 0) return tasks;

    const processed = [];
    for (const task of tasks) {
      const newTask = { ...task };

      // 格式化时间
      const fields = ['createTime', 'acceptTime', 'deadline', 'submitTime', 'completeTime'];
      fields.forEach(f => {
        if (newTask[f]) {
          newTask[f + '_str'] = this.formatDate(newTask[f]);
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

      // 凭证图片（年轻人提交的）
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

  // ========== 格式化日期 ==========
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

  // ========== 检测自动取消的任务 ==========
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
    const roleText = this.data.role === 'elder' ? '发布' : '接取';

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
  },

  // ========== 预览图片 ==========
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls || [];
    wx.previewImage({ urls, current: url });
  }
});