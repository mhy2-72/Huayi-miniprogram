// pages/aichat/aichat.js
const app = getApp();

const FILE_IDS = [
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/stick.png',
  'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/animation/talkgif.gif'
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
    characterSrcA: '',    // 静态图（stick）
    characterSrcB: '',    // 动态图（gif）
    imgLayer: 'a',        // 'a' = 显示静态，'b' = 显示GIF
    isSpeaking: false,
    imageMap: {}          // 存储本地路径（或降级云URL）
  },

  async onLoad() {
    this.setData({ pageReady: false });

    try {
      // 1. 获取云临时 URL
      const res = await wx.cloud.getTempFileURL({ fileList: FILE_IDS });
      const urlMap = {};
      res.fileList.forEach(item => {
        const fullName = item.fileID.split('/').pop();
        const fileName = fullName.replace(/\.(png|gif)$/, '');
        urlMap[fileName] = item.tempFileURL;
      });

      // 2. 并发下载图片到本地（最多重试 3 次）
      const downloadPromises = Object.keys(urlMap).map(async (key) => {
        const url = urlMap[key];
        try {
          const localPath = await downloadFileWithRetry(url, 3);
          return { key, localPath };
        } catch (err) {
          console.error(`下载 ${key} 最终失败，使用云临时 URL 降级`, err);
          return { key, localPath: url };
        }
      });

      const results = await Promise.all(downloadPromises);
      const localMap = {};
      results.forEach(({ key, localPath }) => {
        localMap[key] = localPath;
      });

      // 3. 预解码所有图片（强制内存缓存）
      const preloadPromises = Object.values(localMap).map(path => {
        return new Promise((resolve) => {
          wx.getImageInfo({
            src: path,
            success: () => resolve(),
            fail: () => resolve()
          });
        });
      });
      await Promise.all(preloadPromises);

      // 4. 设置角色默认图（双层层叠，避免切换闪烁）
      const stickUrl = localMap['stick'] || '/images/stick.png';
      const gifUrl = localMap['talkgif'] || '/images/talkgif.gif';
      this.setData({
        imageMap: localMap,
        characterSrcA: stickUrl,
        characterSrcB: gifUrl,
        imgLayer: 'a',
        pageReady: true
      });

      console.log('GIF动画页面加载完成');
    } catch (err) {
      console.error('预加载失败', err);
      // 降级：使用本地资源
      this.setData({
        characterSrcA: '/images/stick.png',
        characterSrcB: '/images/talkgif.gif',
        imgLayer: 'a',
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

  // ---- GIF 动画控制 ----
  // 播放语音时切换到GIF层（B层），停止时切回静态层（A层）
  startFrameAnimation() {
    if (this.data.isSpeaking) return;
    this.setData({ isSpeaking: true, imgLayer: 'b' });
  },

  stopFrameAnimation() {
    if (this.data.isSpeaking) {
      this.setData({ isSpeaking: false, imgLayer: 'a' });
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

  openPOILocation(e) {
    const { lat, lng, name, address } = e.currentTarget.dataset;
    if (lat && lng) {
      wx.openLocation({
        latitude: lat,
        longitude: lng,
        name: name || '',
        address: address || '',
        scale: 16
      });
    }
  },

  goLivingCircle() {
    wx.navigateTo({ url: '/pages/livingCircle/livingCircle' });
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
