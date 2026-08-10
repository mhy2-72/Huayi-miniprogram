const app = getApp();

Page({
  data: {
    task: null,
    loading: true,          // 控制加载状态
    role: '',
    myOpenid: '',
    rating: 5,
    statusText: {
      published: '待接取',
      accepted: '进行中',
      submitted: '待评价',
      completed: '已完成',
      cancelled: '已取消'
    },
    elderInfo: null,
    youthInfo: null,
    youthNickName: ''
  },

  onLoad(options) {
    this.setData({
      role: wx.getStorageSync('role'),
      myOpenid: app.globalData.openid
    });
    if (options.id) {
      this.loadTaskDetail(options.id);
    } else {
      this.setData({ loading: false });
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

  onShow() {
    this.updateUnreadBadge();
  },

  async loadTaskDetail(taskId) {
    this.setData({ loading: true });
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

      if (!task) {
        const directRes = await wx.cloud.callFunction({
          name: 'getTaskById',
          data: { taskId }
        });
        if (directRes.result.code === 0) {
          task = directRes.result.data;
        }
      }

      if (task) {
        const db = wx.cloud.database();
        const elderPromise = db.collection('users').doc(task.elderId).get();
        const youthPromise = task.youthId
          ? db.collection('users').doc(task.youthId).get()
          : Promise.resolve(null);

        const [elderRes, youthRes] = await Promise.all([elderPromise, youthPromise]);
        const elderInfo = elderRes.data;
        const youthInfo = youthRes ? youthRes.data : null;
        const youthNickName = youthInfo ? youthInfo.nickName : '年轻人';

        const processed = await this.processTask(task, youthNickName);
        this.setData({
          task: processed,
          elderInfo,
          youthInfo,
          youthNickName,
          loading: false
        });
        this.checkAutoCancelReason(processed);
      } else {
        this.setData({ task: null, loading: false });
        wx.showToast({ title: '任务不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1000);
      }
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  checkAutoCancelReason(task) {
    if (task.status !== 'cancelled' || !task.cancelReason) return;
    if (task.cancelReason.includes('8小时') || task.cancelReason.includes('未被接取')) {
      wx.showModal({
        title: '任务已自动取消',
        content: '该任务发布超过8小时未被接取，系统已自动取消。\n\n如需发布新任务，请重新创建。',
        showCancel: false,
        confirmText: '我知道了'
      });
    } else if (task.cancelReason.includes('超时') || task.cancelReason.includes('截止时间')) {
      wx.showModal({
        title: '任务超时取消',
        content: '该任务超过截止时间未完成，已被系统自动取消。',
        showCancel: false,
        confirmText: '我知道了'
      });
    }
  },

  async processTask(task, youthNickName) {
    const newTask = { ...task };
    const fields = ['createTime', 'acceptTime', 'deadline', 'submitTime', 'completeTime'];
    fields.forEach(f => {
      if (newTask[f]) {
        newTask[f + '_str'] = this.formatDate(newTask[f]);
      }
    });

    // 难度文本
    newTask.difficultyText = this.getDifficultyText(newTask.difficulty);

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

    newTask.youthNickName = youthNickName || '年轻人';
    return newTask;
  },

  getDifficultyText(difficulty) {
    if (!difficulty) return '未知';
    const stars = ['★☆☆☆☆', '★★★☆☆', '★★★★★'];
    return stars[difficulty - 1] || '未知';
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
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  setRating(e) { this.setData({ rating: e.currentTarget.dataset.val }); },

  async confirmComplete() { /* 保持不变 */ },
  cancel() { /* 保持不变 */ },
  cancelAccept() { /* 保持不变 */ },
  goSubmitEvidence() { /* 保持不变 */ },
  previewImage(e) { /* 保持不变 */ },

  async sendNotification(type) { /* 保持不变 */ },
  async updateUnreadBadge() { /* 保持不变 */ },

  handleTestSubscribe() { /* 保持不变 */ }
});