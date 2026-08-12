// pages/livingCircle/livingCircle.js
const { CENTER, CATEGORIES } = require('../../data/livingCircle.js');
const { recommend } = require('../../utils/livingCircle.js');

Page({
  data: {
    categories: CATEGORIES,
    keyword: '',
    selectedCategory: '',
    list: [],
    tip: ''
  },

  onLoad() {
    this.refresh();
  },

  // 统一推荐入口：按当前 keyword + selectedCategory 重新计算
  refresh() {
    const { keyword, selectedCategory } = this.data;
    const result = recommend({
      text: keyword.trim(),
      category: selectedCategory || undefined,
      center: CENTER
    });
    let tip = '';
    if (keyword.trim() && !result.matched) {
      tip = '未找到相关服务，以下为附近全部生活圈服务';
    }
    const list = result.list.map(p => ({
      ...p,
      distanceText: this.formatDistance(p.distanceMeters)
    }));
    this.setData({ list, tip });
  },

  // 输入框 300ms 防抖
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.refresh(), 300);
  },

  // 分类按钮：点选/取消选中
  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    const next = this.data.selectedCategory === key ? '' : key;
    this.setData({ selectedCategory: next, keyword: '' }, () => this.refresh());
  },

  formatDistance(meters) {
    if (meters < 1000) return meters + 'm';
    return (meters / 1000).toFixed(1) + 'km';
  },

  // 地图导航
  openLocation(e) {
    const poi = e.currentTarget.dataset.poi;
    wx.openLocation({
      latitude: poi.latitude,
      longitude: poi.longitude,
      name: poi.name,
      address: poi.address,
      scale: 16
    });
  }
});
