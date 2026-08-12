# 生活圈服务推荐功能 — 设计文档

日期：2026-08-11
状态：已批准（用户逐节确认）

## 背景与目标

互助养老小程序「申出圆手」面向老年用户。目标是新增「生活圈服务」功能：老人输入需求（或点分类按钮），系统从「15 分钟生活圈」数据中检索匹配的地点，按「同类内距离最近」推荐最优地点，并一键调用地图导航。

本轮为演示阶段：

- 地点默认固定在**上海市人民广场**（中心点 121.4742, 31.2317），不申请定位权限
- 生活圈数据为**前端本地假数据**，后续可替换为真实数据源（云函数 / 腾讯位置服务）

## 需求要点

1. **入口**：首页「任务」tab 顶部新增「生活圈服务」入口按钮，`navigateTo` 打开独立页面
2. **需求表达**：输入框（自由文本）+ 预设分类按钮（两者都用）
3. **推荐标准**：先按匹配分类过滤，同类内按距中心点距离升序排序；第一名为「最优推荐」
4. **导航**：点击地点卡片 → `wx.openLocation` 打开地图选导航应用

## 架构选择：方案 A（前端本地假数据 + 纯函数）

- 数据存于 `data/livingCircle.js`（本地 JS 数组），匹配 / 距离 / 排序为纯函数模块 `utils/livingCircle.js`
- 优点：零部署、开发者工具内立即可测；推荐逻辑与页面解耦，将来可整体搬到云函数
- 迁移路径：把 `data/livingCircle.js` 的导出换成云函数调用即可，页面与纯函数逻辑不变

## 文件结构

```
miniprogram/
├── data/
│   └── livingCircle.js            # 假地点数据 + 中心点常量
├── utils/
│   └── livingCircle.js            # 纯函数：matchCategory / calcDistance / recommend
├── pages/
│   ├── index/                     # 首页加「生活圈服务」入口按钮
│   │   ├── index.js
│   │   ├── index.wxml
│   │   └── index.wxss
│   └── livingCircle/              # 新页面
│       ├── livingCircle.js
│       ├── livingCircle.json
│       ├── livingCircle.wxml
│       └── livingCircle.wxss
└── app.json                       # 注册 livingCircle 页面
```

## 数据模型（假数据）

每个地点对象：

```js
{
  id: 'pharmacy_001',
  name: '瑞金药房(人民广场店)',
  category: 'pharmacy',       // 分类 key
  categoryName: '药店',        // 分类中文名
  address: '黄浦区南京西路123号',
  latitude: 31.2335,
  longitude: 121.4731,
  rating: 4.8,                // 0~5
  phone: '021-12345678'
}
```

- 8 个分类：`pharmacy 药店`、`market 菜场`、`bank 银行`、`barber 理发`、`repair 维修`、`canteen 社区食堂`、`supermarket 超市`、`hospital 医院`
- 约 12 个地点，坐标围绕中心点 `(121.4742, 31.2317)` 散布（每类 1~2 个），保证距离排序有意义

## 匹配与推荐逻辑（纯函数）

**`matchCategory(text): string | null`**

`CATEGORY_KEYWORDS` 分类→关键词表（本轮完整表）：

| 分类 | 关键词 |
|------|--------|
| pharmacy | 药、降压、感冒、医保、处方、买药 |
| market | 买菜、蔬菜、肉、海鲜、水果 |
| bank | 银行、取钱、取款、存款、柜台 |
| barber | 理发、剪发、烫发、染发 |
| repair | 修、维修、家电、电灯、水管、换锁、配钥匙 |
| canteen | 食堂、吃饭、就餐、早饭、晚饭 |
| supermarket | 超市、生活用品、日用品、油盐 |
| hospital | 医院、看病、挂号、门诊、急诊、体检 |

匹配规则：遍历每个分类的关键词，统计该分类命中关键词个数，取命中数最多的分类；命中数并列时取先遍历到的分类；无任何命中返回 `null`。

**`calcDistance(lat1, lng1, lat2, lng2): number`**

Haversine 公式，返回米。

**`recommend({ text, category, center }): { list, matched }`**

1. `category` 明确 → 直接使用；否则用 `matchCategory(text)` 推断（`matched` 标记是否匹配成功）
2. 按分类过滤数据
3. 用 `calcDistance` 对每条计算距 `center` 的距离，升序排序
4. 返回 `{ list: [{ ...poi, distanceMeters }], matched }`；list 第一项为最优推荐

**无匹配分类**：`matched=false`，页面提示「未找到相关服务」，fallback 展示全部分类按距离排序。

## 页面设计

### 首页入口

首页「任务」tab 顶部（标题区下方）加「生活圈服务」按钮，点击 `navigateTo` 到 `/pages/livingCircle/livingCircle`。

### livingCircle 页面

```
┌─────────────────────────────┐
│  生活圈服务        ←返回      │
├─────────────────────────────┤
│  [ 🔍 输入需求：哪里有药店  ]  │  输入即匹配（debounce）
│  买菜 买药 银行 理发 修家电 →  │  分类按钮，横向滚动
│  食堂 超市 医院              │
├─────────────────────────────┤
│  ⭐ 最优推荐                 │  第一张卡片
│  瑞金药房(人民广场店)  480m   │
│  药店 · 黄浦区南京西路123号  │
│  ★4.8 · 021-12345678        │
├─────────────────────────────┤
│  慈济药房(大沽路店)    620m   │  其余按距离升序
│  ...                        │
└─────────────────────────────┘
```

- `onLoad`：默认调用 `recommend({ category: null, center })` 展示全量按距离排序
- 输入框 `bindinput`（300ms debounce）→ `recommend({ text })`
- 点分类按钮 → `recommend({ category })`；再次点同一按钮取消选中回到全量
- 结果卡片 `bindtap` → `openLocation(poi)`

### 导航

```js
wx.openLocation({ latitude, longitude, name, address, scale: 16 })
```

- 距离展示：`<1000m` 显示「480m」；`≥1000m` 显示「1.2km」（一位小数）

## 边界与异常处理

- 中心点硬编码，不调用 `wx.getLocation`，**无需定位权限配置**，不受定位拒绝影响
- 输入为空 / 文本无匹配：兜底为全量推荐，并给出提示文案
- 纯本地数据，无网络依赖；不涉及云函数，无部署步骤

## 测试计划

1. **纯函数单测**（临时 node 脚本，跑完即删）：`matchCategory` 每分类至少 1 个命中 + 1 个无命中用例；`calcDistance` 手算核对一个已知距离；`recommend` 验证过滤与升序
2. **页面手工验证**（微信开发者工具）：
   - 路径 A：点分类按钮 → 列表为该分类按距离排序
   - 路径 B：输入文字（如「哪里有降压药」）→ 匹配到药店
   - 路径 C：默认打开 → 全量按距离排序
   - 每条路径点一个地点，确认 `wx.openLocation` 拉起地图
3. **回归**：首页入口按钮、tabBar 切换正常，不影响现有任务功能

## 后续演进（不在本轮范围）

- 把 `data/livingCircle.js` 换成云函数 + 云数据库（`livingCircle` 集合）
- 接入 `wx.getLocation` 真实定位作为 center
- 接入真实生活圈数据源 / 腾讯位置服务检索
