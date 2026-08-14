Page({
  data: {
    users: [],
    loading: true,
    searchKey: '',
    editingUser: null,
    showEditModal: false,
    editData: { nickName: '', avatarUrl: '', gender: '', occupation: '', birthday: '' },
    certTypes: [
      { key: 'nursing', name: '护理' },
      { key: 'repair', name: '修理' }
    ],
    showCertModal: false,
    certUser: null
  },

  preventBubble() {},

  onLoad() { this.loadUsers(); },
  onShow() { this.loadUsers(); },
  onPullDownRefresh() { this.loadUsers().then(() => wx.stopPullDownRefresh()); },

  async loadUsers() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'getUsers', keyword: this.data.searchKey } });
      if (res.result.code === 0) {
        this.setData({ users: res.result.data });
      }
    } catch (e) { console.error(e); }
    finally { this.setData({ loading: false }); }
  },

  onSearchInput(e) { this.setData({ searchKey: e.detail.value }); },
  doSearch() { this.loadUsers(); },

  editUser(e) {
    const id = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u._id === id);
    if (user) {
      this.setData({
        editingUser: user,
        showEditModal: true,
        editData: { 
          nickName: user.nickName, 
          avatarUrl: user.avatarUrl, 
          gender: user.gender, 
          occupation: user.occupation,
          birthday: user.birthday || ''
        }
      });
    }
  },

  openCertModal(e) {
    const id = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u._id === id);
    if (user) {
      this.setData({ certUser: user, showCertModal: true });
    }
  },

  closeCertModal() {
    this.setData({ showCertModal: false, certUser: null });
  },

  async grantCert(e) {
    const certType = e.currentTarget.dataset.type;
    const user = this.data.certUser;
    if (!user) return;
    try {
      wx.showLoading({ title: '添加中...' });
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: { action: 'addUserCertification', userId: user._id, certType }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '已添加' });
        this.setData({ showCertModal: false, certUser: null });
        this.loadUsers();
      } else {
        wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async revokeCert(e) {
    const certType = e.currentTarget.dataset.type;
    const user = this.data.certUser;
    if (!user) return;
    wx.showModal({
      title: '移除资质',
      content: `确定移除该用户的${certType === 'nursing' ? '护理' : '修理'}资质？`,
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '移除中...' });
          const res = await wx.cloud.callFunction({
            name: 'adminOperations',
            data: { action: 'removeUserCertification', userId: user._id, certType }
          });
          wx.hideLoading();
          if (res.result.code === 0) {
            wx.showToast({ title: '已移除' });
            this.setData({ showCertModal: false, certUser: null });
            this.loadUsers();
          } else {
            wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  },

  onEditInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`editData.${field}`]: e.detail.value });
  },

  onBirthdayChange(e) {
    this.setData({ 'editData.birthday': e.detail.value });
  },

  onChangeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({ title: '上传中...' });
        try {
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
            filePath: res.tempFiles[0].tempFilePath
          });
          this.setData({ 'editData.avatarUrl': uploadRes.fileID });
          wx.hideLoading();
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      }
    });
  },

  async saveEdit() {
    const { editingUser, editData } = this.data;
    try {
      wx.showLoading({ title: '保存中...' });
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: { 
          action: 'updateUser', 
          userId: editingUser._id, 
          nickName: editData.nickName,
          avatarUrl: editData.avatarUrl,
          gender: editData.gender,
          occupation: editData.occupation,
          birthday: editData.birthday
        }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '保存成功' });
        this.setData({ showEditModal: false, editingUser: null });
        this.loadUsers();
      } else {
        wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  deleteUser(e) {
    const id = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u._id === id);
    wx.showModal({
      title: '确认删除',
      content: `确定删除用户「${user.nickName}」？此操作不可恢复！`,
      confirmColor: '#ff4d4f',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '删除中...' });
          const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'deleteUser', userId: id } });
          wx.hideLoading();
          if (res.result.code === 0) { wx.showToast({ title: '已删除' }); this.loadUsers(); }
          else wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  },

  closeModal() { this.setData({ showEditModal: false, editingUser: null }); }
});
