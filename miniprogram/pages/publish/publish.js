// pages/publish/publish.js
Page({
  data: {
    description: '',
    images: [],
    difficulty: 2,
    userAge: null,
    ageGroup: '',
    canPublish: false,
    publishTip: '',
    // ✅ 新增：资质认证相关
    showCertModal: false,           // 是否显示资质认证弹窗
    certRequired: false,            // 是否需要资质认证
    certTypes: [],                  // 需要的资质类型
    certificationImages: [],        // 资质证明图片
    isSubmitting: false            // 防止重复提交
  },

  onLoad() {
    this.checkPublishPermission();
  },

  // ========== 检查发布权限 ==========
  async checkPublishPermission() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const db = wx.cloud.database();
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        const loginRes = await wx.cloud.callFunction({ name: 'login' });
        openid = loginRes.result.openid;
        wx.setStorageSync('openid', openid);
      }
      
      let user = null;
      let age = null;
      
      try {
        const res = await db.collection('users').doc(openid).get();
        if (res.data) {
          user = res.data;
          age = user.age;
        }
      } catch (err) {}
      
      if (!user) {
        try {
          const res = await db.collection('users').where({ openid: openid }).get();
          if (res.data.length > 0) {
            user = res.data[0];
            age = user.age;
          }
        } catch (err) {}
      }
      
      if (!user) {
        try {
          const res = await db.collection('users').where({ _openid: openid }).get();
          if (res.data.length > 0) {
            user = res.data[0];
            age = user.age;
          }
        } catch (err) {}
      }
      
      wx.hideLoading();
      
      if (!user) {
        this.setData({
          canPublish: false,
          publishTip: '请先完成注册'
        });
        this.showPermissionError();
        return;
      }
      
      if (!age) {
        this.setData({
          canPublish: false,
          publishTip: '请先完善个人信息中的年龄'
        });
        this.showPermissionError();
        return;
      }
      
      let canPublish = false;
      let tip = '';
      let ageGroup = '';
      
      if (age >= 12 && age <= 17) {
        canPublish = false;
        ageGroup = '少年组';
        tip = '少年组（12-17岁）不可发布任务';
      } else if (age >= 18 && age <= 35) {
        canPublish = true;
        ageGroup = '青年组';
        tip = '青年组（18-35岁）可发布全类别任务';
      } else if (age >= 36 && age <= 59) {
        canPublish = true;
        ageGroup = '中年组';
        tip = '中年组（36-59岁）可发布全类别任务';
      } else if (age >= 60) {
        canPublish = true;
        ageGroup = '银发组';
        tip = '银发组（60岁及以上）可发布全类别任务';
      } else {
        canPublish = false;
        tip = '年龄不在有效范围内';
      }
      
      this.setData({
        canPublish: canPublish,
        publishTip: tip,
        userAge: age,
        ageGroup: ageGroup
      });
      
      if (!canPublish) {
        this.showPermissionError();
      }
    } catch (error) {
      wx.hideLoading();
      console.error('检查权限失败:', error);
      this.setData({
        canPublish: false,
        publishTip: '获取用户信息失败，请重试'
      });
      this.showPermissionError();
    }
  },

  showPermissionError() {
    wx.showModal({
      title: '无法发布任务',
      content: this.data.publishTip || '您没有发布任务的权限',
      showCancel: false,
      confirmText: '我知道了',
      success: () => {
        wx.navigateBack();
      }
    });
  },

  // ========== 资质认证相关方法 ==========
  
  // 上传资质证明图片
  chooseCertImage() {
    const remain = 3 - this.data.certificationImages.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传3张', icon: 'none' });
      return;
    }
    
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({
          certificationImages: this.data.certificationImages.concat(res.tempFilePaths)
        });
      }
    });
  },

  // 预览资质图片
  previewCertImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: this.data.certificationImages,
      current: url
    });
  },

  // 删除资质图片
  deleteCertImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.certificationImages;
    images.splice(index, 1);
    this.setData({ certificationImages: images });
  },

  // 关闭资质认证弹窗
  closeCertModal() {
    this.setData({ showCertModal: false });
  },

  // 确认提交资质
  confirmCert() {
    if (this.data.certificationImages.length === 0) {
      wx.showToast({ title: '请上传资质证明图片', icon: 'none' });
      return;
    }
    this.setData({ showCertModal: false });
    // 继续发布
    this.doPublish();
  },

  // ========== 原有方法 ==========
  
  setDifficulty(e) {
    const val = e.currentTarget.dataset.val;
    this.setData({ difficulty: val });
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  chooseImage() {
    const remain = 3 - this.data.images.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传3张', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({ images: this.data.images.concat(res.tempFilePaths) });
      }
    });
  },

  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] });
  },

  // ========== 提交发布 ==========
  async submit() {
    if (this.data.isSubmitting) return;
    
    if (!this.data.canPublish) {
      wx.showModal({
        title: '无法发布',
        content: this.data.publishTip || '您没有发布权限',
        showCancel: false
      });
      return;
    }

    const { description, images } = this.data;
    if (!description.trim()) {
      wx.showToast({ title: '请输入任务描述', icon: 'none' });
      return;
    }

    if (description.trim().length < 5) {
      wx.showToast({ title: '任务描述至少5个字', icon: 'none' });
      return;
    }

    // ✅ 先调用云函数检测是否需要资质
    wx.showLoading({ title: '检测任务类型...' });
    
    try {
      // 先上传任务图片（如果有）
      let cloudFileIDs = [];
      if (images.length > 0) {
        const uploadPromises = images.map(path => {
          if (path.startsWith('cloud://')) return Promise.resolve(path);
          return wx.cloud.uploadFile({
            cloudPath: `task/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`,
            filePath: path
          }).then(res => res.fileID);
        });
        cloudFileIDs = await Promise.all(uploadPromises);
      }

      // 第一次调用：检测是否需要资质
      const checkRes = await wx.cloud.callFunction({
        name: 'publishTask',
        data: {
          description: description.trim(),
          images: cloudFileIDs,
          certificationImages: [] // 先不传资质图片
        }
      });

      wx.hideLoading();

      // ✅ 如果需要资质认证，弹出认证窗口
      if (checkRes.result.code === -2 && checkRes.result.certRequired) {
        this.setData({
          showCertModal: true,
          certRequired: true,
          certTypes: checkRes.result.certTypes || [],
          certTypeNames: checkRes.result.certTypeNames || [],
          _tempImages: cloudFileIDs,
          _description: description.trim()
        });
        return;
      }

      // 如果不需要资质，但发布失败
      if (checkRes.result.code !== 0) {
        wx.showModal({
          title: '发布失败',
          content: checkRes.result.msg || '未知错误',
          showCancel: false
        });
        return;
      }

      // 发布成功
      wx.showModal({
        title: '✅ 发布成功',
        content: `任务已成功发布\n难度：${'⭐'.repeat(checkRes.result.difficulty || 1)}`,
        showCancel: false,
        success: () => wx.navigateBack()
      });

    } catch (err) {
      wx.hideLoading();
      console.error('发布任务失败:', err);
      wx.showToast({
        title: err.errMsg || err.message || '网络错误，请重试',
        icon: 'none',
        duration: 2500
      });
    }
  },

  // ========== 真正的发布（含资质图片） ==========
  async doPublish() {
    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '发布中...' });

    try {
      const description = this.data._description || this.data.description;
      
      // 上传资质图片
      let certFileIDs = [];
      if (this.data.certificationImages.length > 0) {
        const uploadPromises = this.data.certificationImages.map(path => {
          if (path.startsWith('cloud://')) return Promise.resolve(path);
          return wx.cloud.uploadFile({
            cloudPath: `cert/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`,
            filePath: path
          }).then(res => res.fileID);
        });
        certFileIDs = await Promise.all(uploadPromises);
      }

      // 最终发布
      const res = await wx.cloud.callFunction({
        name: 'publishTask',
        data: {
          description: description,
          images: this.data._tempImages || this.data.images || [],
          certificationImages: certFileIDs
        }
      });

      wx.hideLoading();
      this.setData({ isSubmitting: false });

      if (res.result.code === 0) {
        wx.showModal({
          title: '✅ 发布成功',
          content: `任务已成功发布\n难度：${'⭐'.repeat(res.result.difficulty || 1)}`,
          showCancel: false,
          success: () => wx.navigateBack()
        });
      } else {
        wx.showModal({
          title: '发布失败',
          content: res.result.msg || '未知错误',
          showCancel: false
        });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      console.error('发布失败:', err);
      wx.showToast({
        title: err.errMsg || err.message || '网络错误，请重试',
        icon: 'none',
        duration: 2500
      });
    }
  }
});