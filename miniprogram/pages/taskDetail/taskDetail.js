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

  onShow() {
    this.updateUnreadBadge();
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
        const processed = await this.processTask(task);
        this.setData({ task: processed });
        this.checkAutoCancelReason(processed);
      } else {
        wx.showToast({ title: '任务不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1000);
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

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
    
    // 难度文本转换
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
    
    return newTask;
  },

  // 将难度数值转换为文本显示
  getDifficultyText(difficulty) {
    if (!difficulty) return '未知';
    const stars = ['★☆☆☆☆', '★★☆☆☆', '★★★☆☆'];
    // 假设 difficulty 为 1,2,3
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
            await this.sendNotification('completed');
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
            await this.sendNotification('cancelled');
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
            await this.sendNotification('youth_cancelled');
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
    const imageUrls = this.data.task.imageUrls || [];
    const evidenceUrls = this.data.task.evidenceImageUrls || [];
    const allUrls = [...imageUrls, ...evidenceUrls];
    wx.previewImage({ 
      urls: allUrls, 
      current: url 
    });
  },

  handleTestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['5-rezkv5Ou5ph7UMnVjUX2gVZAg4VFgW-5_c137PrX0'], 
      success(res) { 
        console.log('用户允许了订阅', res);
      },
      fail(err) { 
        console.log('用户拒绝了或报错', err);
      }
    })
  },

  async sendNotification(type) {
    try {
      const task = this.data.task;
      if (!task) return;
    
      await wx.cloud.callFunction({
       name: 'sendTaskNotification',
       data: {
          taskId: task._id,
          type: type,
          taskData: {
            _id: task._id,
            description: task.description,
            elderId: task.elderId,
            youthId: task.youthId,
            status: task.status,
            cancelReason: task.cancelReason,
            youthPoints: task.youthPoints || 0
          }
        }
      });
      console.log('通知发送成功');
    } catch (e) {
      console.error('发送通知失败:', e);
    }
  },

  async updateUnreadBadge() {
   try {
      const res = await wx.cloud.callFunction({ name: 'getUnreadCount' });
      const count = res.result.count || 0;
      const NOTIF_TAB_INDEX = 2;
    
      if (count > 0) {
        wx.setTabBarBadge({
          index: NOTIF_TAB_INDEX,
          text: count > 99 ? '99+' : count.toString()
        });
      } else {
        wx.removeTabBarBadge({
          index: NOTIF_TAB_INDEX
        });
      }
    } catch (e) {
      console.error('更新未读角标失败:', e);
    }
  }
});