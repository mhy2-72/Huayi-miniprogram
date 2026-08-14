// miniprogram/data/livingCircle.js
// 15分钟生活圈数据 —— 虹口区限定范围
// 中心点：上海市虹口区
const CENTER = { latitude: 31.2620, longitude: 121.4880 };

// 虹口区限定半径（米）
const RANGE_RADIUS = 5000;

const CATEGORIES = [
  { key: 'canteen',     name: '食堂' },
  { key: 'barber',      name: '理发' },
  { key: 'course',      name: '课程' },
  { key: 'entertainment', name: '娱乐' },
  { key: 'counseling',  name: '心理咨询' }
];

const POIS = [
  // ========== 食堂 ==========
  { id: 'canteen_001', name: '煌泰泰·新市北社邻食堂', category: 'canteen', categoryName: '食堂', address: '新市北路1517、1519号', latitude: 31.2950, longitude: 121.4480, rating: 4.3, phone: '', inRange: true, desc: '家常菜为主，菜品丰富，新开店铺' },
  { id: 'canteen_002', name: '凉城新村街道社区长者食堂', category: 'canteen', categoryName: '食堂', address: '广灵四路268号', latitude: 31.2800, longitude: 121.4630, rating: 4.2, phone: '', inRange: true, desc: '面向长者打造社区配套，价格亲民' },
  { id: 'canteen_003', name: '宜德饭堂(江杨店)', category: 'canteen', categoryName: '食堂', address: '江杨南路232号', latitude: 31.2900, longitude: 121.4550, rating: 4.1, phone: '', inRange: true, desc: '商务餐性价比突出' },
  { id: 'canteen_004', name: '泰润饭堂(虹湾路店)', category: 'canteen', categoryName: '食堂', address: '虹湾路266号', latitude: 31.2860, longitude: 121.4580, rating: 4.4, phone: '', inRange: true, desc: '菜品种类多、口味佳，经济实惠' },
  { id: 'canteen_005', name: '江湾社区食堂(彩虹湾金枫里店)', category: 'canteen', categoryName: '食堂', address: '彩虹湾金枫里北门旁', latitude: 31.2920, longitude: 121.4600, rating: 4.3, phone: '', inRange: true, desc: '适合老年人，菜式丰富' },
  { id: 'canteen_006', name: '广中路街道花园社区长者食堂', category: 'canteen', categoryName: '食堂', address: '八字桥居委会水电路120号B幢1楼', latitude: 31.2730, longitude: 121.4720, rating: 4.2, phone: '', inRange: true, desc: '经济实惠' },
  { id: 'canteen_007', name: '四川北路街道虹德社区长者食堂', category: 'canteen', categoryName: '食堂', address: '中州路居委会衡水路363号1楼', latitude: 31.2780, longitude: 121.4760, rating: 4.1, phone: '', inRange: true, desc: '经济实惠' },
  { id: 'canteen_008', name: '北外滩街道滨芬食光熊猫食堂', category: 'canteen', categoryName: '食堂', address: '北外滩街道海宁居委会百官街18号', latitude: 31.2550, longitude: 121.4850, rating: 4.0, phone: '', inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_009', name: '曲阳路街道第三市民驿站长者食堂', category: 'canteen', categoryName: '食堂', address: '东体育会路705号2楼', latitude: 31.2760, longitude: 121.4800, rating: 4.2, phone: '', inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_010', name: '嘉兴路街道第五市民驿站长者食堂', category: 'canteen', categoryName: '食堂', address: '香烟桥路87号', latitude: 31.2710, longitude: 121.4840, rating: 4.5, phone: '', inRange: true, desc: '嘉兴路街道社区食堂' },
  { id: 'canteen_011', name: '江湾镇街道第一市民驿站长者食堂', category: 'canteen', categoryName: '食堂', address: '虹湾路59号', latitude: 31.2900, longitude: 121.4550, rating: 4.1, phone: '', inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_012', name: '曲阳路街道市民驿站赤二延伸点长者食堂', category: 'canteen', categoryName: '食堂', address: '曲阳路610弄13号1楼', latitude: 31.2780, longitude: 121.4780, rating: 4.2, phone: '', inRange: true, desc: '社区长者食堂' },
  { id: 'canteen_013', name: '杨浦区睦邻社区长者食堂', category: 'canteen', categoryName: '食堂', address: '打虎山路26号', latitude: 31.2750, longitude: 121.4720, rating: 4.3, phone: '', inRange: true, desc: '临近地铁站，从早到晚不断档' },
  { id: 'canteen_014', name: '欧阳路街道社区食堂', category: 'canteen', categoryName: '食堂', address: '天宝西路248弄7号', latitude: 31.2680, longitude: 121.4920, rating: 4.4, phone: '', inRange: true, desc: '高性价比，食材新鲜，环境整洁' },
  { id: 'canteen_015', name: '泰丰饭堂·社邻餐厅', category: 'canteen', categoryName: '食堂', address: '西江湾路103号', latitude: 31.2740, longitude: 121.4730, rating: 4.2, phone: '', inRange: true, desc: '味道不错，不可吸烟，打烊晚' },
  { id: 'canteen_016', name: '荟心食坊', category: 'canteen', categoryName: '食堂', address: '横浜路256号党群服务中心', latitude: 31.2730, longitude: 121.4820, rating: 4.5, phone: '', inRange: true, desc: '硬件新，少糖少盐少油，适合老年人' },
  { id: 'canteen_017', name: '联寓社区食堂', category: 'canteen', categoryName: '食堂', address: '陈家宅路20号', latitude: 31.2760, longitude: 121.4870, rating: 4.3, phone: '', inRange: true, desc: '店面宽敞，不用排队' },
  { id: 'canteen_018', name: '祥德市集', category: 'canteen', categoryName: '食堂', address: '祥德路95号底楼', latitude: 31.2850, longitude: 121.4680, rating: 4.2, phone: '', inRange: true, desc: '熟食铺火爆，鲜肉草头三拼锅贴，山阴路网红包子' },
  { id: 'canteen_019', name: '川北好食光', category: 'canteen', categoryName: '食堂', address: '溧阳路1155号', latitude: 31.2780, longitude: 121.4780, rating: 4.1, phone: '', inRange: true, desc: '社区食堂' },
  { id: 'canteen_020', name: '永昌盛邻里饭堂', category: 'canteen', categoryName: '食堂', address: '芷江西路134号', latitude: 31.2880, longitude: 121.4620, rating: 4.0, phone: '', inRange: true, desc: '清洁卫生，称重自选店' },
  { id: 'canteen_021', name: '百乐汇社区食堂', category: 'canteen', categoryName: '食堂', address: '芷江西路98号', latitude: 31.2880, longitude: 121.4630, rating: 4.1, phone: '', inRange: true, desc: '比隔壁方便' },
  { id: 'canteen_022', name: '鸿昌兴大食堂', category: 'canteen', categoryName: '食堂', address: '广纪路91号', latitude: 31.2950, longitude: 121.4550, rating: 4.2, phone: '', inRange: true, desc: '适合本地人口味' },
  { id: 'canteen_023', name: '老鸿兴社区饭堂', category: 'canteen', categoryName: '食堂', address: '打虎山路80号', latitude: 31.2750, longitude: 121.4750, rating: 4.3, phone: '', inRange: true, desc: '性价比高，包子好吃' },
  { id: 'canteen_024', name: '虹口区市民驿站(曲阳路街道)', category: 'canteen', categoryName: '食堂', address: '东体育会路1130号', latitude: 31.2760, longitude: 121.4810, rating: 4.1, phone: '', inRange: true, desc: '市民驿站配套' },

  // ========== 理发 ==========
  { id: 'barber_001', name: '舒雨 Salon·Beauty', category: 'barber', categoryName: '理发', address: '江湾店', latitude: 31.2900, longitude: 121.4550, rating: 4.5, phone: '', inRange: true, desc: '服务耐心，剪发造型手艺出色' },
  { id: 'barber_002', name: '贤剪', category: 'barber', categoryName: '理发', address: '凉城路店', latitude: 31.2800, longitude: 121.4600, rating: 4.4, phone: '', inRange: true, desc: '全程无推销，性价比很高' },
  { id: 'barber_003', name: '东方麒麟·潘多拉SALON', category: 'barber', categoryName: '理发', address: '盛邻MALL店', latitude: 31.2820, longitude: 121.4650, rating: 4.3, phone: '', inRange: true, desc: '技术稳定靠谱，店内环境优质' },
  { id: 'barber_004', name: 'PE SALON', category: 'barber', categoryName: '理发', address: '水电路店', latitude: 31.2730, longitude: 121.4720, rating: 4.2, phone: '', inRange: true, desc: '地理位置方便，性价比优异' },
  { id: 'barber_005', name: '7FAM 美发沙龙烫·染(天宝路店)', category: 'barber', categoryName: '理发', address: '天宝路飘鹰世纪大厦12层02室', latitude: 31.2680, longitude: 121.4920, rating: 4.4, phone: '', inRange: true, desc: '主打烫染护理，适合想染发做造型的人' },
  { id: 'barber_006', name: '米娜造型(天宝路店)', category: 'barber', categoryName: '理发', address: '天宝路578号飘鹰大厦1201室', latitude: 31.2680, longitude: 121.4910, rating: 4.2, phone: '', inRange: true, desc: '预算友好，适合基础日常造型' },
  { id: 'barber_007', name: 'PE SALON(四平路店)', category: 'barber', categoryName: '理发', address: '四平路719号', latitude: 31.2770, longitude: 121.4990, rating: 4.3, phone: '', inRange: true, desc: '理发师沟通耐心，服务多样' },

  // ========== 课程 ==========
  { id: 'course_001', name: '嘉兴路街道社区文化活动中心', category: 'course', categoryName: '课程', address: '瑞虹路400号', latitude: 31.2740, longitude: 121.4850, rating: 4.6, phone: '', inRange: true, desc: '有丰富的老年活动课程，开放时间8:30～17:00' },
  { id: 'course_002', name: '上海四平老年大学', category: 'course', categoryName: '课程', address: '抚顺路鞍山三村57号', latitude: 31.2800, longitude: 121.4980, rating: 4.3, phone: '', inRange: true, desc: '老年大学，距离相对较远（1.4km）' },

  // ========== 娱乐 ==========
  { id: 'entertainment_001', name: '龙小主24H麻将棋牌室(骏丰大厦店)', category: 'entertainment', categoryName: '娱乐', address: '大连路1619号504室', latitude: 31.2580, longitude: 121.5050, rating: 4.3, phone: '', inRange: true, desc: '老板人好，有免费茶水' },
  { id: 'entertainment_002', name: '品雀阁棋牌(新港路店)', category: 'entertainment', categoryName: '娱乐', address: '新港路333号4L', latitude: 31.2680, longitude: 121.5050, rating: 4.4, phone: '', inRange: true, desc: '环境好，有免费零食' },
  { id: 'entertainment_003', name: '和平公园', category: 'entertainment', categoryName: '娱乐', address: '天宝路891号', latitude: 31.2680, longitude: 121.4900, rating: 4.7, phone: '', inRange: true, desc: '无需门票，晚上有广场舞' },
  { id: 'entertainment_004', name: '四平电影院', category: 'entertainment', categoryName: '娱乐', address: '四平路901号', latitude: 31.2770, longitude: 121.5000, rating: 4.3, phone: '', inRange: true, desc: '宽敞舒适，观影体验好' },

  // ========== 心理咨询 ==========
  { id: 'counseling_001', name: '森恬心理', category: 'counseling', categoryName: '心理咨询', address: '嘉兴路街道高阳路669弄2304室', latitude: 31.2710, longitude: 121.4870, rating: 4.6, phone: '', inRange: true, desc: '咨询师温柔，善于沟通' },
  { id: 'counseling_002', name: '壹点灵·心理咨询中心(虹口龙之梦店)', category: 'counseling', categoryName: '心理咨询', address: '凯德商业中心东北门', latitude: 31.2650, longitude: 121.5050, rating: 4.5, phone: '', inRange: true, desc: '环境好，咨询师专业耐心，价格普遍较高' }
];

module.exports = { CENTER, RANGE_RADIUS, CATEGORIES, POIS };