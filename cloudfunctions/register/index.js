const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

function parseAge(birthdayStr) {
  const birth = new Date(birthdayStr.replace(/-/g, '/'));
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { nickName, avatarUrl, birthday, gender, occupation } = event;

  const existing = await db.collection('users').doc(openid).get().catch(() => null);
  if (existing && existing.data) return { code: -1, msg: '您已注册，请勿重复操作' };

  if (!birthday) return { code: -1, msg: '请选择出生日期' };
  if (!occupation) return { code: -1, msg: '请选择职业' };

  const age = parseAge(birthday);
  if (age < 0 || age > 150) return { code: -1, msg: '出生日期不合法' };

  const role='';
  if ( age >= 12 && age <= 17 ) role = 'teen';
  else if ( age >= 18 && age <= 35 ) role = 'young';
  else if ( age >= 36 && age <= 59 ) role = 'middle';
  else if ( age >=60 ) role = 'elder';

  await db.collection('users').add({
    data: {
      _id: openid,
      openid,
      role,
      nickName: nickName || '微信用户',
      avatarUrl: avatarUrl || '',
      birthday,
      age,
      gender,
      occupation,    // 新增职业字段
      points: 0,
      createTime: new Date()
    }
  });

  return { code: 0, role, msg: '注册成功' };
};