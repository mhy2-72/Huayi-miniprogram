Page({
  data: {
    fileID: 'cloud://cloud1-d3gqpcznd38f2891a.636c-cloud1-d3gqpcznd38f2891a-1463354353/agreement/user_agreement.pdf' // 替换为实际 PDF 文件ID
  },

  async openAgreement() {
    wx.showLoading({ title: '加载中...' });
    try {
      // 下载云存储文件到本地临时路径
      const res = await wx.cloud.downloadFile({
        fileID: this.data.fileID
      });
      wx.hideLoading();
      // 使用系统能力打开 PDF
      wx.openDocument({
        filePath: res.tempFilePath,
        fileType: 'pdf',
        success: () => {
          console.log('打开成功');
        },
        fail: (err) => {
          console.error('打开失败', err);
          wx.showToast({ title: '打开失败，请稍后重试', icon: 'none' });
        }
      });
    } catch (e) {
      wx.hideLoading();
      console.error('下载失败', e);
      wx.showToast({ title: '加载失败，请检查网络', icon: 'none' });
    }
  }
});