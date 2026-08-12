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
