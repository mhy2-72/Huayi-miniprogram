const cloud = require('wx-server-sdk');
cloud.init();
const tencentcloud = require('tencentcloud-sdk-nodejs');
const TtsClient = tencentcloud.tts.v20190823.Client;

exports.main = async (event) => {
  const { text } = event;
  if (!text) return { fileID: '' };

  // 初始化客户端（SecretId/Key 需在云函数环境变量中配置）
  const clientConfig = {
    credential: {
      secretId: process.env.SECRET_ID,
      secretKey: process.env.SECRET_KEY
    },
    region: 'ap-guangzhou',
    profile: {
      httpProfile: {
        endpoint: 'tts.tencentcloudapi.com'
      }
    }
  };
  const client = new TtsClient(clientConfig);

  const params = {
    Text: text,
    SessionId: `session_${Date.now()}`,
    VoiceType: 1002,   // 亲切女声，可按需更换
    Codec: 'mp3',
    Volume: 5,
    Speed: 0
  };

  try {
    // 调用语音合成 API
    const response = await client.TextToVoice(params);
    const audioBuffer = Buffer.from(response.Audio, 'base64');

    // 上传到云存储
    const cloudPath = `tts/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`;
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: audioBuffer
    });

    return { fileID: uploadRes.fileID };
  } catch (e) {
    console.error('TTS生成失败', e);
    return { fileID: '' };
  }
};