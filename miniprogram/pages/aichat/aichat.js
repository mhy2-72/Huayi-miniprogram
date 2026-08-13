// pages/aichat/aichat.js
const app = getApp();

Page({
  data: {
    messages: [],
    inputText: '',
    scrollToView: '',
    isSoundOn: true,
    // 角色相关
    characterMoved: false,      // 是否已移动到左上角
    characterSrc: '/images/stick.png', // 当前显示的图片
    isSpeaking: false,          // 是否正在说话动画
    frameIndex: 0,              // 当前帧索引（0-15）
    frameTimer: null            // 定时器句柄
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  toggleSound() {
    // 关闭声音时停止当前语音和动画
    if (this.data.isSoundOn && this.audioContext) {
      this.audioContext.stop();
      this.stopFrameAnimation();
    }
    this.setData({ isSoundOn: !this.data.isSoundOn });
  },

  async sendMessage() {
    const text = this.data.inputText.trim();
    if (!text) return;

    this.setData({ inputText: '' });

    // 用户发送第一条消息时，移动角色到左上角
    if (!this.data.characterMoved) {
      this.setData({ characterMoved: true });
    }

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
        actionResult
      };
      this.data.messages.push(aiMsg);
      this.setData({ messages: this.data.messages, scrollToView: 'msg-' + (this.data.messages.length - 1) });

      // 自动播放语音（仅当声音开启且有语音文件）
      if (voiceFileID && this.data.isSoundOn) {
        // 直接调用播放，传递数据
        this.playVoice({ currentTarget: { dataset: { fileid: voiceFileID } } });
      }
    } catch (e) {
      console.error('AI处理失败', e);
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  // 播放语音（手动点击或自动调用）
  playVoice(e) {
    const fileid = e.currentTarget.dataset.fileid;
    if (!fileid) {
      wx.showToast({ title: '语音文件不存在', icon: 'none' });
      return;
    }

    // 如果已有音频在播放，先停止
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext.destroy();
      this.audioContext = null;
      this.stopFrameAnimation();
    }

    wx.cloud.getTempFileURL({ fileList: [fileid] }).then(res => {
      const url = res.fileList[0].tempFileURL;
      const innerAudioContext = wx.createInnerAudioContext();
      this.audioContext = innerAudioContext;
      innerAudioContext.src = url;

      // 开始播放时启动帧动画
      innerAudioContext.onPlay(() => {
        this.startFrameAnimation();
      });

      // 播放结束或停止时停止动画并恢复stick
      innerAudioContext.onEnded(() => {
        this.stopFrameAnimation();
        this.audioContext = null;
      });
      innerAudioContext.onStop(() => {
        this.stopFrameAnimation();
        this.audioContext = null;
      });
      // 播放错误也需清理
      innerAudioContext.onError((err) => {
        console.error('音频播放错误', err);
        this.stopFrameAnimation();
        this.audioContext = null;
      });

      innerAudioContext.play();
    }).catch(err => {
      console.error('获取语音URL失败', err);
      wx.showToast({ title: '语音加载失败', icon: 'none' });
    });
  },

  // 开始帧动画（说话）
  startFrameAnimation() {
    if (this.data.isSpeaking) return; // 防止重复启动
    // 重置帧索引
    this.setData({ frameIndex: 0, isSpeaking: true });
    // 立即显示第一帧
    this.updateFrameSrc(0);
    // 启动定时器，每100ms切换一帧（16帧约1.6秒一个周期）
    const timer = setInterval(() => {
      let next = (this.data.frameIndex + 1) % 16;
      this.setData({ frameIndex: next });
      this.updateFrameSrc(next);
    }, 100);
    this.setData({ frameTimer: timer });
  },

  // 停止帧动画（闭嘴）
  stopFrameAnimation() {
    if (this.data.frameTimer) {
      clearInterval(this.data.frameTimer);
      this.setData({ frameTimer: null });
    }
    if (this.data.isSpeaking) {
      this.setData({ isSpeaking: false });
      // 恢复为stick
      this.setData({ characterSrc: '/images/stick.png' });
    }
  },

  // 更新帧图片
  updateFrameSrc(index) {
    const num = String(index + 1).padStart(2, '0');
    this.setData({ characterSrc: `/images/talk${num}.png` });
  },

  // 点击任务卡片跳转
  goTaskDetail(e) {
    const taskId = e.currentTarget.dataset.taskid;
    if (taskId) {
      wx.navigateTo({
        url: `/pages/taskDetail/taskDetail?id=${taskId}`
      });
    } else {
      wx.showToast({ title: '任务ID无效', icon: 'none' });
    }
  },

  // 页面卸载时清理资源
  onUnload() {
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext.destroy();
      this.audioContext = null;
    }
    this.stopFrameAnimation();
  }
});