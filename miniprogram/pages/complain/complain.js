const MAX_IMAGES = 5;
const { isGuest, requireLogin } = require('../../utils/auth.js');
const CERT_TYPES = [
  { key: 'nursing', name: '护理', desc: '适用于陪护、护理相关任务' },
  { key: 'repair', name: '修理', desc: '适用于家电维修、水电维修等任务' }
];

Page({
  data: {
    pageTitle: '申诉中心',
    isGuest: false,
    types: [
      { key: 'userInfo', name: '用户信息变更申诉' },
      { key: 'task', name: '任务相关申诉' },
      { key: 'exchange', name: '兑换相关申诉' },
      { key: 'livingCircle', name: '生活圈信息错误/补充' },
      { key: 'certification', name: '资质认证申请' }
    ],
    livingCircleSubTypes: [
      { key: 'error', name: '信息有误' },
      { key: 'addition', name: '补充新地点' }
    ],
    certTypes: CERT_TYPES,
    selectedType: '',
    selectedSubType: '',
    selectedCertType: '',
    userChanges: [],
    changeKey: '',
    changeOld: '',
    changeNew: '',
    userTasks: [],
    selectedTaskId: '',
    description: '',
    images: [],
    submitting: false,
    livingCirclePOIs: [],
    livingCircleCategories: [],
    selectedPOIId: '',
    newPOI: { name: '', category: '', categoryName: '', address: '', latitude: 0, longitude: 0, rating: 4.0, desc: '' },
    categoryIndex: 0
  },

  onLoad() {
    this.setData({ isGuest: isGuest() });
    this.loadUserTasks();
    this.loadLivingCircleData();
  },

  async loadLivingCircleData() {
    if (isGuest()) return;
    try {
      const res = await wx.cloud.callFunction({ name: 'getLivingCircle' });
      if (res.result && res.result.code === 0) {
        const pois = (res.result.data.pois || []).map(p => ({ ...p, displayText: `${p.name} (${p.categoryName || p.category})` }));
        this.setData({
          livingCirclePOIs: pois,
          livingCircleCategories: res.result.data.categories || []
        });
      }
    } catch (e) { console.error(e); }
  },

  async loadUserTasks() {
    if (isGuest()) return;
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyTasks', data: {} });
      if (res.result) {
        const allTasks = [
          ...(res.result.tasks || []),
          ...(res.result.myActive || [])
        ];
        const formatted = allTasks.map(t => ({
          ...t,
          statusText: this.getStatusText(t.status)
        }));
        this.setData({ userTasks: formatted });
      }
    } catch (e) { console.error(e); }
  },

  getStatusText(status) {
    const map = { published: '待接取', accepted: '进行中', submitted: '待评价', completed: '已完成', cancelled: '已取消' };
    return map[status] || status;
  },

  selectType(e) {
    this.setData({
      selectedType: e.currentTarget.dataset.key,
      selectedSubType: '',
      selectedPOIId: '',
      selectedCertType: ''
    });
  },

  selectSubType(e) {
    this.setData({ selectedSubType: e.currentTarget.dataset.key });
  },

  selectCertType(e) {
    this.setData({ selectedCertType: e.currentTarget.dataset.key });
  },

  selectPOI(e) {
    const idx = parseInt(e.detail.value);
    const poi = this.data.livingCirclePOIs[idx];
    this.setData({ selectedPOIId: poi ? poi.id : '' });
  },

  onCategoryPickerChange(e) {
    const idx = parseInt(e.detail.value);
    const cat = this.data.livingCircleCategories[idx];
    this.setData({
      categoryIndex: idx,
      'newPOI.category': cat ? cat.key : '',
      'newPOI.categoryName': cat ? cat.name : ''
    });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'newPOI.address': res.address || res.name,
          'newPOI.latitude': res.latitude,
          'newPOI.longitude': res.longitude
        });
      },
      fail: () => {}
    });
  },

  addUserChange() {
    const { changeKey, changeOld, changeNew, userChanges } = this.data;
    if (!changeKey || !changeNew) {
      wx.showToast({ title: '请填写完整变更信息', icon: 'none' });
      return;
    }
    const newChanges = [...userChanges, { key: changeKey, old: changeOld, new: changeNew }];
    this.setData({ userChanges: newChanges, changeKey: '', changeOld: '', changeNew: '' });
  },

  removeChange(e) {
    const index = e.currentTarget.dataset.index;
    const changes = [...this.data.userChanges];
    changes.splice(index, 1);
    this.setData({ userChanges: changes });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onPOIInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newPOI.${field}`]: e.detail.value });
  },

  selectTask(e) {
    this.setData({ selectedTaskId: e.currentTarget.dataset.id });
  },

  chooseImages() {
    const remaining = MAX_IMAGES - this.data.images.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传5张图片', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({ title: '上传中...' });
        const uploaded = [];
        for (const file of res.tempFiles) {
          try {
            const uploadRes = await wx.cloud.uploadFile({
              cloudPath: `complain/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
              filePath: file.tempFilePath
            });
            uploaded.push(uploadRes.fileID);
          } catch (e) { console.error(e); }
        }
        wx.hideLoading();
        this.setData({ images: [...this.data.images, ...uploaded] });
      }
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ urls: this.data.images, current: url });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },

  async submitComplaint() {
    if (!requireLogin()) return;
    const { selectedType, userChanges, selectedTaskId, description, images, selectedSubType, selectedPOIId, newPOI, selectedCertType } = this.data;
    if (!selectedType) { wx.showToast({ title: '请选择申诉类型', icon: 'none' }); return; }
    if (!description || description.length < 10) { wx.showToast({ title: '请详细描述（至少10字）', icon: 'none' }); return; }
    if (selectedType === 'task' && !selectedTaskId) { wx.showToast({ title: '请选择相关任务', icon: 'none' }); return; }

    if (selectedType === 'livingCircle') {
      if (!selectedSubType) { wx.showToast({ title: '请选择申诉子类型', icon: 'none' }); return; }
      if (selectedSubType === 'error' && !selectedPOIId) { wx.showToast({ title: '请选择有问题的地点', icon: 'none' }); return; }
      if (selectedSubType === 'addition') {
        if (!newPOI.name) { wx.showToast({ title: '请填写地点名称', icon: 'none' }); return; }
        if (!newPOI.category) { wx.showToast({ title: '请选择分类', icon: 'none' }); return; }
        if (!newPOI.address) { wx.showToast({ title: '请填写地址', icon: 'none' }); return; }
      }
      if (images.length === 0) { wx.showToast({ title: '生活圈申诉必须提供现场照片', icon: 'none' }); return; }
    }

    if (selectedType === 'certification') {
      if (!selectedCertType) { wx.showToast({ title: '请选择资质类型', icon: 'none' }); return; }
      if (images.length === 0) { wx.showToast({ title: '资质认证必须上传证书/证件照片', icon: 'none' }); return; }
    }

    this.setData({ submitting: true });
    try {
      wx.showLoading({ title: '提交中...' });
      const submitData = {
        action: 'submitComplaint',
        type: selectedType,
        description,
        evidenceImages: images
      };
      if (selectedType === 'userInfo') submitData.userChanges = userChanges;
      if (selectedType === 'task') submitData.taskId = selectedTaskId;
      if (selectedType === 'livingCircle') {
        submitData.subType = selectedSubType;
        if (selectedSubType === 'error') submitData.targetPOIId = selectedPOIId;
        if (selectedSubType === 'addition') submitData.newPOI = newPOI;
      }
      if (selectedType === 'certification') {
        submitData.certType = selectedCertType;
      }

      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: submitData });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '提交成功' });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showToast({ title: res.result.msg || '提交失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
