# 生活圈服务推荐功能 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「申出圆手」小程序里新增「生活圈服务」页：老人输入需求或点分类按钮，系统从本地假数据中按「先匹配分类、同类内按距离最近」推荐地点，点击卡片通过 `wx.openLocation` 拉起地图导航。

**Architecture:** 前端本地假数据（`data/livingCircle.js`）+ 纯函数推荐模块（`utils/livingCircle.js`，不含任何 `wx.*` 依赖，可被 node 直接测试），新页面 `pages/livingCircle` 消费这两个模块，首页「任务」tab 加入口按钮。

**Tech Stack:** 原生微信小程序 + CommonJS 模块（与项目现有约定一致）。不新增依赖、不引入云函数/云数据库、不申请定位权限。

## Global Constraints

- 中心点固定为上海市人民广场 `(121.4742, 31.2317)`，本轮**不调用** `wx.getLocation`，**不申请**定位权限
- 生活圈数据为本地假数据，存于 `miniprogram/data/livingCircle.js`，后续换成云函数时页面逻辑不变
- 纯函数模块（`utils/livingCircle.js`）不得引用 `wx.*`，保证可在 node 中直接 require 测试
- 距离展示规则：`<1000m` 显示「480m」；`≥1000m` 显示「1.2km」（一位小数）
- 导航使用 `wx.openLocation({ latitude, longitude, name, address, scale: 16 })`
- 8 个分类 key：`pharmacy/market/bank/barber/repair/canteen/supermarket/hospital`
- 不新增 npm 依赖、不新增云函数

---

### Task 1: 假数据模块与纯函数推荐模块（TDD）

**Files:**
- Create: `miniprogram/data/livingCircle.js`
- Create: `miniprogram/utils/livingCircle.js`
- Temp (跑完即删): `livingCircle.test.js`（仓库根目录）

**Interfaces:**
- Consumes: 无
- Produces:
  - `data/livingCircle.js` 导出 `{ CENTER, CATEGORIES, POIS }`
    - `CENTER = { latitude: 31.2317, longitude: 121.4742 }`
    - `CATEGORIES = [{ key, name }]`（8 项，页面渲染分类按钮用）
    - `POIS = [{ id, name, category, categoryName, address, latitude, longitude, rating, phone }]`（12 项）
  - `utils/livingCircle.js` 导出 `{ CATEGORY_KEYWORDS, matchCategory, calcDistance, recommend }`
    - `matchCategory(text: string): string | null` — 命中关键词最多的分类，并列取先遍历到；无命中返回 `null`
    - `calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number` — Haversine，返回四舍五入的**米**
    - `recommend({ text, category, center }): { list, matched, category }` — `list` 为 `[{ ...poi, distanceMeters }]` 按距离升序；`matched` 布尔；`category` 为命中分类或 `null`；`center` 缺省用 `CENTER`

- [ ] **Step 1: 写临时测试脚本**

```js
// livingCircle.test.js —— 临时脚本，跑完即删
const assert = require('assert');
const { CENTER, POIS } = require('./miniprogram/data/livingCircle.js');
const { matchCategory, calcDistance, recommend } = require('./miniprogram/utils/livingCircle.js');

// --- matchCategory：每分类至少 1 个命中 ---
assert.strictEqual(matchCategory('哪里有降压药'), 'pharmacy');
assert.strictEqual(matchCategory('我想去买菜'), 'market');
assert.strictEqual(matchCategory('附近有银行吗'), 'bank');
assert.strictEqual(matchCategory('找个地方理发'), 'barber');
assert.strictEqual(matchCategory('修一下电灯'), 'repair');
assert.strictEqual(matchCategory('社区食堂吃饭'), 'canteen');
assert.strictEqual(matchCategory('买点生活用品'), 'supermarket');
assert.strictEqual(matchCategory('去医院看病'), 'hospital');
// --- matchCategory：无命中 ---
assert.strictEqual(matchCategory('hello world'), null);
assert.strictEqual(matchCategory(''), null);

// --- calcDistance：人民广场 → (31.2335, 121.4731) 约 226m，容差 ±60 ---
const d = calcDistance(CENTER.latitude, CENTER.longitude, 31.2335, 121.4731);
assert.ok(Math.abs(d - 226) < 60, `distance=${d} 不在 226±60 内`);

// --- recommend：分类明确 → 过滤 + 升序 ---
const pharm = recommend({ category: 'pharmacy' });
assert.strictEqual(pharm.matched, true);
assert.strictEqual(pharm.category, 'pharmacy');
assert.ok(pharm.list.length >= 1, '药店应至少 1 个');
assert.ok(pharm.list.every(p => p.category === 'pharmacy'), '应只含药店');
for (let i = 1; i < pharm.list.length; i++) {
  assert.ok(pharm.list[i].distanceMeters >= pharm.list[i - 1].distanceMeters, '应按距离升序');
}
assert.ok(pharm.list[0].distanceMeters !== undefined, '每项应有 distanceMeters');

// --- recommend：文本匹配 ---
const fromText = recommend({ text: '哪里有降压药' });
assert.strictEqual(fromText.category, 'pharmacy');
assert.ok(fromText.list.length >= 1);

// --- recommend：无匹配 → 全量 fallback + matched=false ---
const noMatch = recommend({ text: '找外星人' });
assert.strictEqual(noMatch.matched, false);
assert.strictEqual(noMatch.category, null);
assert.strictEqual(noMatch.list.length, POIS.length, '无匹配应返回全量');

console.log('✅ 所有用例通过');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node livingCircle.test.js`
Expected: 报错 `Cannot find module './miniprogram/data/livingCircle.js'`（模块尚不存在）

- [ ] **Step 3: 写数据模块**

```js
// miniprogram/data/livingCircle.js —— 15分钟生活圈假数据（演示用）
// 中心点：上海市人民广场
const CENTER = { latitude: 31.2317, longitude: 121.4742 };

const CATEGORIES = [
  { key: 'pharmacy',    name: '药店' },
  { key: 'market',      name: '菜场' },
  { key: 'bank',        name: '银行' },
  { key: 'barber',      name: '理发' },
  { key: 'repair',      name: '维修' },
  { key: 'canteen',     name: '社区食堂' },
  { key: 'supermarket', name: '超市' },
  { key: 'hospital',    name: '医院' }
];

const POIS = [
  { id: 'pharmacy_001', name: '瑞金药房(人民广场店)', category: 'pharmacy', categoryName: '药店', address: '黄浦区南京西路123号', latitude: 31.2335, longitude: 121.4731, rating: 4.8, phone: '021-12345678' },
  { id: 'pharmacy_002', name: '慈济药房(大沽路店)', category: 'pharmacy', categoryName: '药店', address: '黄浦区大沽路456号', latitude: 31.2290, longitude: 121.4755, rating: 4.5, phone: '021-23456789' },
  { id: 'market_001', name: '大沽路菜市场', category: 'market', categoryName: '菜场', address: '黄浦区大沽路88号', latitude: 31.2288, longitude: 121.4740, rating: 4.2, phone: '021-34567890' },
  { id: 'market_002', name: '人民广场智慧菜场', category: 'market', categoryName: '菜场', address: '黄浦区武胜路380号', latitude: 31.2330, longitude: 121.4710, rating: 4.6, phone: '021-45678901' },
  { id: 'bank_001', name: '中国银行(人民广场支行)', category: 'bank', categoryName: '银行', address: '黄浦区南京西路150号', latitude: 31.2320, longitude: 121.4750, rating: 4.3, phone: '021-56789012' },
  { id: 'bank_002', name: '工商银行(西藏中路支行)', category: 'bank', categoryName: '银行', address: '黄浦区西藏中路500号', latitude: 31.2310, longitude: 121.4780, rating: 4.1, phone: '021-67890123' },
  { id: 'barber_001', name: '王氏理发店', category: 'barber', categoryName: '理发', address: '黄浦区汉口路220号', latitude: 31.2325, longitude: 121.4718, rating: 4.7, phone: '021-78901234' },
  { id: 'repair_001', name: '小张家电维修部', category: 'repair', categoryName: '维修', address: '黄浦区新昌路305号', latitude: 31.2302, longitude: 121.4690, rating: 4.4, phone: '021-89012345' },
  { id: 'canteen_001', name: '江阴街社区食堂', category: 'canteen', categoryName: '社区食堂', address: '黄浦区江阴街101号', latitude: 31.2280, longitude: 121.4770, rating: 4.5, phone: '021-90123456' },
  { id: 'supermarket_001', name: '联华超市(福州路店)', category: 'supermarket', categoryName: '超市', address: '黄浦区福州路567号', latitude: 31.2340, longitude: 121.4760, rating: 4.0, phone: '021-01234567' },
  { id: 'supermarket_002', name: '华联吉买盛(黄浦店)', category: 'supermarket', categoryName: '超市', address: '黄浦区云南南路77号', latitude: 31.2270, longitude: 121.4795, rating: 3.9, phone: '021-13572468' },
  { id: 'hospital_001', name: '黄浦区中心医院(门诊部)', category: 'hospital', categoryName: '医院', address: '黄浦区四川中路109号', latitude: 31.2295, longitude: 121.4810, rating: 4.6, phone: '021-24681357' }
];

module.exports = { CENTER, CATEGORIES, POIS };
```

- [ ] **Step 4: 写纯函数推荐模块**

```js
// miniprogram/utils/livingCircle.js —— 纯函数，无 wx.* 依赖，可被 node 测试
const { CENTER, POIS } = require('../data/livingCircle.js');

const CATEGORY_KEYWORDS = {
  pharmacy:    ['药', '降压', '感冒', '医保', '处方', '买药'],
  market:      ['买菜', '蔬菜', '菜', '肉', '海鲜', '水果'],
  bank:        ['银行', '取钱', '取款', '存款', '柜台', '存钱'],
  barber:      ['理发', '剪发', '烫发', '染发'],
  repair:      ['修', '维修', '家电', '电灯', '水管', '换锁', '配钥匙'],
  canteen:     ['食堂', '吃饭', '就餐', '早饭', '午饭', '晚饭'],
  supermarket: ['超市', '生活用品', '日用品', '油盐', '购物'],
  hospital:    ['医院', '看病', '挂号', '门诊', '急诊', '体检']
};

function matchCategory(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  let best = null;
  let bestCount = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const count = keywords.filter(k => t.includes(k)).length;
    if (count > bestCount) {
      bestCount = count;
      best = category;
    }
  }
  return bestCount > 0 ? best : null;
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球半径，米
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function recommend({ text, category, center }) {
  const c = center || CENTER;
  const target = category || matchCategory(text);
  const matched = Boolean(target);
  const pool = target ? POIS.filter(p => p.category === target) : POIS;
  const list = pool
    .map(p => ({ ...p, distanceMeters: calcDistance(c.latitude, c.longitude, p.latitude, p.longitude) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { list, matched, category: target };
}

module.exports = { CATEGORY_KEYWORDS, matchCategory, calcDistance, recommend };
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node livingCircle.test.js`
Expected: 输出 `✅ 所有用例通过`（若 `matchCategory('我想去买菜')` 等与 `CATEGORY_KEYWORDS` 撞词导致分类错判，调整测试用例或关键词表，保证 8 分类命中各自唯一）

- [ ] **Step 6: 删除临时测试脚本并提交**

```bash
rm livingCircle.test.js
git add miniprogram/data/livingCircle.js miniprogram/utils/livingCircle.js
git commit -m "feat: 新增生活圈假数据与匹配/推荐纯函数"
```

---

### Task 2: 生活圈服务页面

**Files:**
- Create: `miniprogram/pages/livingCircle/livingCircle.js`
- Create: `miniprogram/pages/livingCircle/livingCircle.json`
- Create: `miniprogram/pages/livingCircle/livingCircle.wxml`
- Create: `miniprogram/pages/livingCircle/livingCircle.wxss`
- Modify: `miniprogram/app.json`（pages 数组追加 `pages/livingCircle/livingCircle`）

**Interfaces:**
- Consumes: `data/livingCircle.js` 的 `{ CENTER, CATEGORIES }`；`utils/livingCircle.js` 的 `recommend({ text, category, center })` → `{ list, matched, category }`，其中 `list[i].distanceMeters` 为米
- Produces: 页面 `pages/livingCircle`，可直接在开发者工具编译模式打开验证（此时尚无首页入口，不影响）

- [ ] **Step 1: 注册页面**

在 `miniprogram/app.json` 的 `pages` 数组末尾（`"pages/agreement/agreement"` 之后）追加：

```json
"pages/livingCircle/livingCircle"
```

- [ ] **Step 2: 写页面配置文件**

```json
{
  "navigationBarTitleText": "生活圈服务"
}
```

- [ ] **Step 3: 写页面逻辑**

```js
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
```

- [ ] **Step 4: 写页面结构**

```xml
<!-- pages/livingCircle/livingCircle.wxml -->
<view class="container">
  <!-- 搜索输入框 -->
  <view class="search-bar">
    <input class="search-input" placeholder="输入需求，如：哪里有药店"
           value="{{keyword}}" bindinput="onKeywordInput" confirm-type="search"/>
  </view>

  <!-- 分类按钮（横向滚动） -->
  <scroll-view scroll-x class="category-bar" enhanced show-scrollbar="{{false}}">
    <view class="category-btn {{selectedCategory === item.key ? 'active' : ''}}"
          wx:for="{{categories}}" wx:key="key"
          bindtap="onCategoryTap" data-key="{{item.key}}">{{item.name}}</view>
  </scroll-view>

  <!-- 无匹配提示 -->
  <view wx:if="{{tip}}" class="tip">{{tip}}</view>

  <!-- 结果列表 -->
  <view class="result-list">
    <view wx:for="{{list}}" wx:key="id" class="poi-card {{index === 0 ? 'best' : ''}}"
          bindtap="openLocation" data-poi="{{item}}">
      <view class="poi-head">
        <text class="poi-name">{{item.name}}</text>
        <text wx:if="{{index === 0}}" class="best-tag">⭐最优推荐</text>
      </view>
      <view class="poi-meta">
        <text class="poi-cat">{{item.categoryName}}</text>
        <text class="poi-dist">{{item.distanceText}}</text>
      </view>
      <view class="poi-addr">{{item.address}}</view>
      <view class="poi-foot">
        <text>★ {{item.rating}}</text>
        <text class="poi-phone">{{item.phone}}</text>
        <text class="nav-hint">点击导航 ›</text>
      </view>
    </view>
    <view wx:if="{{!list.length}}" class="empty">暂无相关服务</view>
  </view>
</view>
```

- [ ] **Step 5: 写页面样式**

```css
/* pages/livingCircle/livingCircle.wxss */
.container {
  min-height: 100vh;
  background: #f6f6f6;
}
.search-bar {
  padding: 20rpx 24rpx;
  background: #fff;
}
.search-input {
  height: 72rpx;
  line-height: 72rpx;
  background: #f2f3f5;
  border-radius: 36rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
}
.category-bar {
  white-space: nowrap;
  background: #fff;
  padding: 10rpx 24rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.category-btn {
  display: inline-block;
  margin-right: 16rpx;
  padding: 12rpx 32rpx;
  background: #f2f3f5;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #333;
}
.category-btn.active {
  background: #07c160;
  color: #fff;
}
.tip {
  padding: 20rpx 24rpx;
  color: #e6a23c;
  font-size: 26rpx;
  background: #fdf6ec;
}
.result-list {
  padding: 20rpx 24rpx;
}
.poi-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.poi-card.best {
  border: 2rpx solid #07c160;
}
.poi-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.poi-name {
  font-size: 32rpx;
  font-weight: bold;
  flex: 1;
}
.best-tag {
  font-size: 22rpx;
  color: #e6a23c;
  border: 1rpx solid #e6a23c;
  border-radius: 6rpx;
  padding: 4rpx 12rpx;
}
.poi-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 26rpx;
}
.poi-cat {
  color: #07c160;
}
.poi-dist {
  color: #999;
}
.poi-addr {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #666;
}
.poi-foot {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #999;
}
.poi-phone {
  margin-left: 24rpx;
}
.nav-hint {
  margin-left: auto;
  color: #07c160;
}
.empty {
  text-align: center;
  color: #999;
  padding: 60rpx 0;
}
```

说明：WXML 根节点用 `<view class="container">`（与项目其他页面如 publish.wxml 一致）；`app.wxss` 已全局定义 `.container`，本页 wxss 顶部覆盖其背景与高度。

- [ ] **Step 6: 开发者工具手工验证页面**

在微信开发者工具中，用「编译模式」指向 `pages/livingCircle/livingCircle` 直接打开页面（尚无入口按钮）：
1. 默认打开 → 显示全部分类 12 个地点，按距离升序，第一张带「⭐最优推荐」，距离显示为「xxxm」或「x.xkm」
2. 点分类按钮「药店」→ 只剩 2 个药店、按距离升序；再点一次「药店」→ 回到全量
3. 输入「哪里有降压药」→ 列表为药店；输入「找外星人」→ 顶部出现「未找到相关服务，以下为附近全部生活圈服务」且列表为全量
4. 点任意地点卡片 → 拉起微信地图（`wx.openLocation`），标题为该地点名称
Expected: 以上 4 条全部符合预期

- [ ] **Step 7: 提交**

```bash
git add miniprogram/app.json miniprogram/pages/livingCircle/
git commit -m "feat: 新增生活圈服务页面"
```

---

### Task 3: 首页入口

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`（`<block wx:else>` 之后、`<view wx:if="{{role === 'elder'}}">` 之前插入入口块）
- Modify: `miniprogram/pages/index/index.wxss`（追加入口样式）
- Modify: `miniprogram/pages/index/index.js`（追加 `goLivingCircle` 方法）

**Interfaces:**
- Consumes: Task 2 注册的页面 `pages/livingCircle/livingCircle`
- Produces: 首页「任务」tab 顶部的「生活圈服务」入口，两个角色（elder/youth）都可见

- [ ] **Step 1: 首页插入入口**

在 `index.wxml` 的 `<block wx:else>` 之后、`<view wx:if="{{role === 'elder'}}" class="elder-panel">` 之前插入：

```xml
  <!-- 生活圈服务入口 -->
  <view class="living-circle-entry" bindtap="goLivingCircle">
    <text class="lc-icon">🏘️</text>
    <view class="lc-text">
      <text class="lc-title">生活圈服务</text>
      <text class="lc-sub">查找附近买菜、买药、银行等服务</text>
    </view>
    <text class="lc-arrow">›</text>
  </view>
```

- [ ] **Step 2: 追加入口样式**

在 `index.wxss` 末尾追加：

```css
/* ========== 生活圈服务入口 ========== */
.living-circle-entry {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.lc-icon {
  font-size: 48rpx;
  margin-right: 20rpx;
}
.lc-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.lc-title {
  font-size: 32rpx;
  font-weight: bold;
}
.lc-sub {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
}
.lc-arrow {
  font-size: 40rpx;
  color: #ccc;
}
```

- [ ] **Step 3: 追加跳转方法**

在 `index.js` 的 `goPublish()` 方法旁追加：

```js
  goLivingCircle() {
    wx.navigateTo({ url: '/pages/livingCircle/livingCircle' });
  },
```

- [ ] **Step 4: 开发者工具手工验证完整闭环**

1. 首页「任务」tab 顶部显示「生活圈服务」入口，elder 与 youth 两个角色下都可见
2. 点击入口 → 打开生活圈页；返回正常
3. 回归：原有「＋ 发布新任务」按钮、任务列表、接取、tabBar 切换均正常
Expected: 以上 3 条全部符合预期

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/index/
git commit -m "feat: 首页新增生活圈服务入口"
```

---

## Self-Review 记录

**Spec 覆盖**：入口（Task 3）、需求表达-输入框+按钮（Task 2）、匹配度优先再比距离（Task 1 recommend）、wx.openLocation 导航（Task 2）、默认全量加载（Task 2 refresh onLoad）、无匹配 fallback（Task 2 tip）、距离展示（Task 2 formatDistance）、固定中心点无定位权限（Global Constraints）、纯函数单测（Task 1）、页面手工验证与回归（Task 2/3 Step 6/4）——均覆盖。

**占位符扫描**：无 TBD/TODO；每个代码步骤含完整可粘贴代码。

**类型一致性**：`recommend` 返回 `{ list, matched, category }`，`list` 元素含 `distanceMeters`，三处（Task 1 实现、Task 1 测试、Task 2 页面）签名一致；页面额外映射 `distanceText`，wxml 引用 `item.distanceText`，一致。
