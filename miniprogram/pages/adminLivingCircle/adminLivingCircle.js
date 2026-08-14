Page({
  data: {
    categories: [],
    pois: [],
    filteredPOIs: [],
    selectedCategory: '',
    showAddCategory: false,
    showAddPOI: false,
    newCategoryKey: '',
    newCategoryName: '',
    categoryIndex: 0,
    editingPOI: null,
    newPOI: { name: '', category: '', address: '', latitude: 0, longitude: 0, rating: 4.0, desc: '' }
  },

  preventBubble() {},

  onLoad() {
    this.loadData();
  },

  updateFilteredPOIs() {
    const { pois, selectedCategory } = this.data;
    const filtered = selectedCategory ? pois.filter(p => p.category === selectedCategory) : pois;
    this.setData({ filteredPOIs: filtered });
  },

  async loadData() {
    try {
      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'getLivingCircle' } });
      if (res.result.code === 0) {
        this.setData({
          categories: res.result.data.categories,
          pois: res.result.data.pois
        }, () => this.updateFilteredPOIs());
      }
    } catch (e) { console.error(e); }
  },

  selectCategory(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ selectedCategory: key }, () => this.updateFilteredPOIs());
  },

  showAddCategoryForm() {
    this.setData({ showAddCategory: true, newCategoryKey: '', newCategoryName: '' });
  },
  closeAddCategory() { this.setData({ showAddCategory: false }); },

  onCategoryKeyInput(e) { this.setData({ newCategoryKey: e.detail.value }); },
  onCategoryNameInput(e) { this.setData({ newCategoryName: e.detail.value }); },

  async saveCategory() {
    const { newCategoryKey, newCategoryName } = this.data;
    if (!newCategoryKey) { wx.showToast({ title: '请输入分类索引', icon: 'none' }); return; }
    if (!newCategoryName) { wx.showToast({ title: '请输入分类名称', icon: 'none' }); return; }
    try {
      wx.showLoading({ title: '保存中...' });
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: { action: 'addLivingCircleCategory', key: newCategoryKey, name: newCategoryName }
      });
      wx.hideLoading();
      if (res.result.code === 0) { wx.showToast({ title: '添加成功' }); this.setData({ showAddCategory: false }); this.loadData(); }
      else wx.showToast({ title: res.result.msg || '添加失败', icon: 'none' });
    } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
  },

  deleteCategory(e) {
    const key = e.currentTarget.dataset.key;
    wx.showModal({
      title: '确认删除',
      content: '删除分类将不会删除该分类下的地点，确定继续？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '删除中...' });
          const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'deleteLivingCircleCategory', key } });
          wx.hideLoading();
          if (res.result.code === 0) { wx.showToast({ title: '已删除' }); this.loadData(); }
          else wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' });
        } catch (e) { wx.hideLoading(); }
      }
    });
  },

  showAddPOIForm() {
    const firstCat = this.data.categories[0];
    this.setData({
      showAddPOI: true,
      editingPOI: null,
      categoryIndex: 0,
      newPOI: { name: '', category: firstCat ? firstCat.key : '', address: '', rating: 4.0, desc: '' }
    });
  },

  onCategoryPickerChange(e) {
    const idx = parseInt(e.detail.value);
    const cat = this.data.categories[idx];
    this.setData({
      categoryIndex: idx,
      'newPOI.category': cat ? cat.key : ''
    });
  },

  onPOIInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newPOI.${field}`]: e.detail.value });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'newPOI.address': res.address || res.name,
          'newPOI.latitude': res.latitude,
          'newPOI.longitude': res.longitude
        });
        wx.showToast({ title: '位置已选', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '未选择位置', icon: 'none' });
      }
    });
  },

  async savePOI() {
    const { newPOI, editingPOI } = this.data;
    if (!newPOI.name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return; }
    if (!newPOI.category) { wx.showToast({ title: '请选择分类', icon: 'none' }); return; }
    try {
      wx.showLoading({ title: '保存中...' });
      const cat = this.data.categories.find(c => c.key === newPOI.category);
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: {
          action: editingPOI ? 'updateLivingCirclePOI' : 'addLivingCirclePOI',
          poiId: editingPOI ? editingPOI.id : null,
          name: newPOI.name,
          category: newPOI.category,
          categoryName: cat ? cat.name : newPOI.category,
          address: newPOI.address,
          latitude: newPOI.latitude,
          longitude: newPOI.longitude,
          rating: parseFloat(newPOI.rating) || 0,
          desc: newPOI.desc
        }
      });
      wx.hideLoading();
      if (res.result.code === 0) { wx.showToast({ title: '保存成功' }); this.setData({ showAddPOI: false }); this.loadData(); }
      else wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' });
    } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
  },

  editPOI(e) {
    const id = e.currentTarget.dataset.id;
    const poi = this.data.pois.find(p => p.id === id);
    if (poi) {
      const catIdx = this.data.categories.findIndex(c => c.key === poi.category);
      this.setData({
        showAddPOI: true,
        editingPOI: poi,
        categoryIndex: catIdx >= 0 ? catIdx : 0,
        newPOI: {
          name: poi.name,
          category: poi.category,
          address: poi.address,
          latitude: poi.latitude || 0,
          longitude: poi.longitude || 0,
          rating: poi.rating,
          desc: poi.desc || ''
        }
      });
    }
  },

  deletePOI(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定继续？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '删除中...' });
          const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'deleteLivingCirclePOI', poiId: id } });
          wx.hideLoading();
          if (res.result.code === 0) { wx.showToast({ title: '已删除' }); this.loadData(); }
          else wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' });
        } catch (e) { wx.hideLoading(); }
      }
    });
  },

  closeAddPOI() { this.setData({ showAddPOI: false, editingPOI: null }); }
});