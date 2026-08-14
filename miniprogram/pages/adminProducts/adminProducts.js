Page({
  data: {
    products: [],
    loading: true,
    showAddModal: false,
    editingProduct: null,
    showExchangeCodes: false,
    exchangeCodes: [],
    newProduct: { name: '', points: 100, stock: 10, description: '' }
  },

  preventBubble() {},

  onLoad() { this.loadProducts(); },
  onShow() { this.loadProducts(); },
  onPullDownRefresh() { this.loadProducts().then(() => wx.stopPullDownRefresh()); },

  async loadProducts() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'getProducts' } });
      if (res.result.code === 0) {
        this.setData({ products: res.result.data });
      }
    } catch (e) { console.error(e); }
    finally { this.setData({ loading: false }); }
  },

  async loadExchangeCodes() {
    try {
      const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'getExchangeCodes' } });
      if (res.result.code === 0) {
        const codes = res.result.data.map(c => ({
          ...c,
          createTime_str: this.formatDate(c.createTime)
        }));
        this.setData({ exchangeCodes: codes, showExchangeCodes: true });
      }
    } catch (e) { console.error(e); }
  },

  formatDate(date) {
    if (!date) return '';
    let d = (typeof date === 'object' && date.$date) ? new Date(date.$date) : new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  showAddForm() { this.setData({ showAddModal: true, editingProduct: null, newProduct: { name: '', points: 100, stock: 10, description: '' } }); },
  closeModal() { this.setData({ showAddModal: false, editingProduct: null, showExchangeCodes: false }); },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newProduct.${field}`]: e.detail.value });
  },

  editProduct(e) {
    const id = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p._id === id);
    if (product) {
      this.setData({ 
        showAddModal: true, 
        editingProduct: product,
        newProduct: { name: product.name, points: product.points, stock: product.stock, description: product.description || '' }
      });
    }
  },

  async saveProduct() {
    const { newProduct, editingProduct } = this.data;
    if (!newProduct.name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return; }
    try {
      wx.showLoading({ title: '保存中...' });
      const action = editingProduct ? 'updateProduct' : 'addProduct';
      const res = await wx.cloud.callFunction({
        name: 'adminOperations',
        data: {
          action,
          productId: editingProduct ? editingProduct._id : null,
          ...newProduct,
          points: parseInt(newProduct.points) || 0,
          stock: parseInt(newProduct.stock) || 0
        }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '保存成功' });
        this.setData({ showAddModal: false });
        this.loadProducts();
      } else {
        wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' });
      }
    } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
  },

  async deleteProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定继续？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          wx.showLoading({ title: '删除中...' });
          const res = await wx.cloud.callFunction({ name: 'adminOperations', data: { action: 'deleteProduct', productId: id } });
          wx.hideLoading();
          if (res.result.code === 0) { wx.showToast({ title: '已删除' }); this.loadProducts(); }
          else wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' });
        } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
      }
    });
  },

  updateStock(e) {
    const id = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p._id === id);
    if (!product) return;
    wx.showModal({
      title: '修改库存',
      editable: true,
      placeholderText: `当前库存：${product.stock}`,
      success: async (r) => {
        if (!r.confirm || !r.content) return;
        const newStock = parseInt(r.content);
        if (isNaN(newStock)) { wx.showToast({ title: '请输入数字', icon: 'none' }); return; }
        try {
          wx.showLoading({ title: '更新中...' });
          const res = await wx.cloud.callFunction({
            name: 'adminOperations',
            data: { action: 'updateProductStock', productId: id, stock: newStock }
          });
          wx.hideLoading();
          if (res.result.code === 0) { wx.showToast({ title: '已更新' }); this.loadProducts(); }
          else wx.showToast({ title: res.result.msg || '更新失败', icon: 'none' });
        } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
      }
    });
  }
});