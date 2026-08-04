instructions(for app.js):
替换云环境 ID：将 '你的云环境ID' 改为你在微信云开发控制台创建的环境 ID。

部署 login 云函数：在 cloudfunctions/login 文件夹中执行 npm init -y && npm install --save wx-server-sdk，然后右键上传部署。

注册页逻辑：注册成功后，在 register.js 中会将 role 存入 wx.setStorageSync('role', res.result.role)，并调用 wx.switchTab 跳转首页。

已注册用户：下次启动时会自动跳过注册页，直接进入首页。
如果需要在其他页面使用 openid，可以这样获取（js）：
const app = getApp();
const openid = app.globalData.openid;