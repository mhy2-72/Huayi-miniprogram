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
    _dataSource: 'local',
    userLatitude: 0,
    userLongitude: 0,
    hasLocation: false
  },

  onLoad() {
    this.loadData();
    this.getUserLocation();
  },

  onShow() {
    this.getUserLocation();
  },

  async getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          userLatitude: res.latitude,
          userLongitude: res.longitude,
          hasLocation: true
        }, () => this.refresh());
      },
      fail: () => {
        this.setData({ hasLocation: false }, () => this.refresh());
      }
    });
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
    }
  },

  applyData(categories, pois, source) {
    this._categories = categories;
    this._pois = pois;
    this._dataSource = source;
    this.setData({
      categories,
      _allPOIs: pois,
      _dataSource: source
    }, () => this.refresh());
  },

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
    const { keyword, selectedCategory, hasLocation, userLatitude, userLongitude } = this.data;
    // 使用用户位置计算距离，无位置时降级使用虹口区中心
    const center = hasLocation
      ? { latitude: userLatitude, longitude: userLongitude }
      : CENTER;

    const result = this.recommendLocal({
      text: keyword.trim(),
      category: selectedCategory || undefined,
      center: center
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
  },

  requestLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          userLatitude: res.latitude,
          userLongitude: res.longitude,
          hasLocation: true
        }, () => this.refresh());
      },
      fail: () => {
        wx.showModal({
          title: '无法获取位置',
          content: '您未授权定位权限，距离信息将基于虹口区中心计算。请在设置中开启定位权限以获得更准确的距离信息。',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  }
});
