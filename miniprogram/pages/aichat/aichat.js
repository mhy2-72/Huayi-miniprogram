// pages/aichat/aichat.js
const app = getApp();

// 云存储 fileID 列表（保持不变）
const FILE_IDS = [
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/stick.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk01.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk02.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk03.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk04.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk05.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk06.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk07.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk08.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk09.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk10.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk11.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk12.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk13.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk14.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk15.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talk16.png'
];

// 工具：下载文件并重试（最多 3 次）
function downloadFileWithRetry(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const doDownload = (attempt) => {
      wx.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath);
          } else {
            if (attempt < retries) {
              console.warn(`下载失败，状态码 ${res.statusCode}，重试第 ${attempt+1} 次`);
              doDownload(attempt + 1);
            } else {
              reject(new Error(`下载失败，状态码 ${res.statusCode}`));
            }
          }
        },
        fail: (err) => {
          if (attempt < retries) {
            console.warn(`下载失败，重试第 ${attempt+1} 次`, err);
            doDownload(attempt + 1);
          } else {
            reject(err);
          }
        }
      });
    };
    doDownload(1);
  });
}

Page({
  data: {
    messages: [],
    pageReady: false,
    inputText: '',
    scrollToView: '',
    isSoundOn: true,
    characterMoved: false,
    characterSrc: '',
    isSpeaking: false,
    frameIndex: 0,
    frameTimer: null,
    imageMap: {}   // 存储本地路径（或降级云URL）
  },

  async onLoad() {
    this.setData({ pageReady: false });

    try {
      // 1. 获取云临时 URL
      const res = await wx.cloud.getTempFileURL({ fileList: FILE_IDS });
      const urlMap = {};
      res.fileList.forEach(item => {
        const fullName = item.fileID.split('/').pop();
        const fileName = fullName.replace('.png', '');
        urlMap[fileName] = item.tempFileURL;
      });

      // 2. 并发下载所有图片，每个最多重试 3 次
      const downloadPromises = Object.keys(urlMap).map(async (key) => {
        const url = urlMap[key];
        try {
          const localPath = await downloadFileWithRetry(url, 3);
          return { key, localPath };
        } catch (err) {
          console.error(`下载 ${key} 最终失败，使用云临时 URL 降级`, err);
          return { key, localPath: url }; // 降级使用云URL（极少发生）
        }
      });

      const results = await Promise.all(downloadPromises);
      const localMap = {};
      results.forEach(({ key, localPath }) => {
        localMap[key] = localPath;
      });

      // 3. 保存映射，设置角色默认图
      this.setData({
        imageMap: localMap,
        characterSrc: localMap['stick'] || '/images/stick.png',
        pageReady: true
      });

      console.log('所有图片预加载完成（绝大部分为本地路径）');
    } catch (err) {
      console.error('预加载失败', err);
      // 完全降级
      this.setData({
        characterSrc: '/images/stick.png',
        pageReady: true,
      });
      wx.showToast({ title: '图片加载失败，使用本地资源', icon: 'none' });
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  toggleSound() {
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

      if (voiceFileID && this.data.isSoundOn) {
        this.playVoice({ currentTarget: { dataset: { fileid: voiceFileID } } });
      }
    } catch (e) {
      console.error('AI处理失败', e);
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  playVoice(e) {
    const fileid = e.currentTarget.dataset.fileid;
    if (!fileid) {
      wx.showToast({ title: '语音文件不存在', icon: 'none' });
      return;
    }

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

      innerAudioContext.onPlay(() => {
        this.startFrameAnimation();
      });

      innerAudioContext.onEnded(() => {
        this.stopFrameAnimation();
        this.audioContext = null;
      });
      innerAudioContext.onStop(() => {
        this.stopFrameAnimation();
        this.audioContext = null;
      });
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

  startFrameAnimation() {
    if (this.data.isSpeaking) return;
    this.setData({ frameIndex: 0, isSpeaking: true });
    this.updateFrameSrc(0);
    const timer = setInterval(() => {
      let next = (this.data.frameIndex + 1) % 16;
      this.setData({ frameIndex: next });
      this.updateFrameSrc(next);
    }, 100);
    this.setData({ frameTimer: timer });
  },

  stopFrameAnimation() {
    if (this.data.frameTimer) {
      clearInterval(this.data.frameTimer);
      this.setData({ frameTimer: null });
    }
    if (this.data.isSpeaking) {
      this.setData({ isSpeaking: false });
      const stickUrl = this.data.imageMap['stick'] || '/images/stick.png';
      this.setData({ characterSrc: stickUrl });
    }
  },

  updateFrameSrc(index) {
    const num = String(index + 1).padStart(2, '0');
    const key = `talk${num}`;
    const url = this.data.imageMap[key];
    if (url) {
      this.setData({ characterSrc: url });
    } else {
      // 极端降级
      this.setData({ characterSrc: `/images/talk${num}.png` });
    }
  },

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

  onUnload() {
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext.destroy();
      this.audioContext = null;
    }
    this.stopFrameAnimation();
  }
});