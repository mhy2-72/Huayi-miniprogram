Page({
  data: { description: '' },
  onInput(e) {
    this.setData({ description: e.detail.value });
  },
  submit() {
    const desc = this.data.description.trim();
    if (!desc) {
      wx.showToast({ title: '请输入任务描述', icon: 'none' });
      return;
    }
    wx.cloud.callFunction({
      name: 'publishTask',
      data: { description: desc }
    }).then(res => {
      if (res.result.code === 0) {
        wx.showToast({ title: '发布成功' });
        wx.navigateBack();
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    }).catch(() => {
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
});