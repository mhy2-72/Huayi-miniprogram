// pages/livingCircle/livingCircle.js
// 云端优先 + 本地降级的数据加载策略
const localData = require('../../data/livingCircle.js');
const { matchCategory, calcDistance } = require('../../utils/livingCircle.js');

const CENTER = localData.CENTER;
const RANGE_RADIUS = localData.RANGE_RADIUS;

Page({
  data: {
    categories: [],
    keyword: '',
    selectedCategory: '',
    list: [],
    tip: '',
    rangeNotice: '',
    showRangeNotice: true,
    _allPOIs: [],
    _dataSource: 'local'
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    // 先使用本地数据，确保快速响应
    this.applyData(localData.CATEGORIES, localData.POIS, 'local');

    // 尝试从云端加载最新数据
    try {
      const res = await wx.cloud.callFunction({
        name: 'getLivingCircle',
        data: {}
      });
      if (res.result && res.result.code === 0 && res.result.data && res.result.data.pois && res.result.data.pois.length > 0) {
        this.applyData(res.result.data.categories, res.result.data.pois, 'cloud');
      }
    } catch (e) {
      console.warn('云端加载失败，使用本地数据', e);
      // 本地数据已经在上面设置好了，不需要额外处理
    }
  },

  applyData(categories, pois, source) {
    // 更新 recommend 函数使用的 POIS 数据源
    // 由于 utils/livingCircle.js 是模块级缓存，我们直接在页面内进行计算
    this._categories = categories;
    this._pois = pois;
    this._dataSource = source;
    this.setData({
      categories,
      _allPOIs: pois,
      _dataSource: source
    }, () => this.refresh());
  },

  // 本地实现的 recommend，使用当前数据源
  recommendLocal({ text, category, center, onlyInRange }) {
    const c = center || CENTER;
    const target = category || matchCategory(text);
    const matched = Boolean(target);
    const pool = target ? this._pois.filter(p => p.category === target) : this._pois;

    const filtered = onlyInRange ? pool.filter(p => p.inRange) : pool;

    const list = filtered
      .map(p => ({
        ...p,
        distanceMeters: (p.latitude && p.longitude)
          ? calcDistance(c.latitude, c.longitude, p.latitude, p.longitude)
          : 0
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return { list, matched, category: target };
  },

  refresh() {
    const { keyword, selectedCategory } = this.data;
    const result = this.recommendLocal({
      text: keyword.trim(),
      category: selectedCategory || undefined,
      center: CENTER
    });

    let rangeNotice = '';
    const list = result.list.map(p => ({
      ...p,
      distanceText: this.formatDistance(p.distanceMeters),
      inRangeText: p.inRange ? '虹口区范围内' : '范围外(测试中)',
      inRangeClass: p.inRange ? 'in-range' : 'out-range'
    }));

    if (keyword.trim()) {
      if (!result.matched) {
        rangeNotice = '未找到完全匹配的分类，以下为附近所有相关服务';
      }
      const outOfRangeCount = list.filter(p => !p.inRange).length;
      const inRangeCount = list.filter(p => p.inRange).length;
      if (outOfRangeCount > 0 && inRangeCount === 0) {
        rangeNotice = '⚠️ 所有匹配结果均在虹口区范围外，此功能还在测试中，剩余功能待开发';
      } else if (outOfRangeCount > 0) {
        rangeNotice = '以下为虹口区范围内的服务，超出范围的功能还在测试中';
      }
    } else if (selectedCategory) {
      const outOfRangeCount = list.filter(p => !p.inRange).length;
      const inRangeCount = list.filter(p => p.inRange).length;
      if (outOfRangeCount > 0 && inRangeCount === 0) {
        rangeNotice = '⚠️ 该分类在虹口区范围内暂无服务，此功能还在测试中';
      }
    }

    this.setData({ list, rangeNotice, tip: '' });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.refresh(), 300);
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    const next = this.data.selectedCategory === key ? '' : key;
    this.setData({ selectedCategory: next, keyword: '' }, () => this.refresh());
  },

  formatDistance(meters) {
    if (meters < 1000) return meters + 'm';
    return (meters / 1000).toFixed(1) + 'km';
  },

  openLocation(e) {
    const poi = e.currentTarget.dataset.poi;
    if (poi.latitude && poi.longitude) {
      wx.openLocation({
        latitude: poi.latitude,
        longitude: poi.longitude,
        name: poi.name,
        address: poi.address,
        scale: 16
      });
    } else {
      wx.showModal({
        title: poi.name,
        content: `地址：${poi.address || '暂无地址信息'}\n\n该地点暂无坐标信息，请手动在地图上搜索。`,
        showCancel: false
      });
    }
  },

  dismissNotice() {
    this.setData({ showRangeNotice: false });
  }
});
