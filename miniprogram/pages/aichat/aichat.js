// pages/aichat/aichat.js
const app = getApp();

Page({
  data: {
    messages: [],
    inputText: '',
    scrollToView: '',
    isSoundOn: true
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  // 切换声音开关
  toggleSound() {
    this.setData({ isSoundOn: !this.data.isSoundOn });
  },

  // 发送消息
  async sendMessage() {
    const text = this.data.inputText.trim();
    if (!text) return;

    this.setData({ inputText: '' });

    const userMsg = { _id: Date.now() + 'u', sender: 'user', text };
    this.data.messages.push(userMsg);
    this.setData({ messages: this.data.messages, scrollToView: 'msg-' + (this.data.messages.length - 1) });

    try {
      const res = await wx.cloud.callFunction({
        name: 'aiChatHandler',
        data: { text }
      });
      const aiText = res.result.reply || '服务出错，请稍后再试';
      const voiceFileID = res.result.voiceFileID || '';
      const actionResult = res.result.actionResult || null;
      const aiMsg = {
        _id: Date.now() + 'a',
        sender: 'ai',
        text: aiText,
        voiceFileID,
        actionResult: actionResult
      };
      this.data.messages.push(aiMsg);
      this.setData({ messages: this.data.messages, scrollToView: 'msg-' + (this.data.messages.length - 1) });

      // 根据声音状态自动播放
      if (voiceFileID && this.data.isSoundOn) {
        this.playVoice({ currentTarget: { dataset: { fileid: voiceFileID } } });
      }
    } catch (e) {
      console.error('AI处理失败', e);
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  // 播放语音
  playVoice(e) {
    const fileid = e.currentTarget.dataset.fileid;
    wx.cloud.getTempFileURL({ fileList: [fileid] }).then(res => {
      const url = res.fileList[0].tempFileURL;
      const innerAudioContext = wx.createInnerAudioContext();
      innerAudioContext.src = url;
      innerAudioContext.play();
    });
  },

  // 点击任务卡片跳转详情
  goTaskDetail(e) {
    const taskId = e.currentTarget.dataset.taskid;
    if (taskId) {
      wx.navigateTo({
        url: `/pages/taskDetail/taskDetail?id=${taskId}`
      });
    } else {
      wx.showToast({ title: '任务ID无效', icon: 'none' });
    }
  }
});