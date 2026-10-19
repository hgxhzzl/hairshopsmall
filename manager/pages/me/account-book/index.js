const app = getApp();
const { request } = require('../../../services/_request');

Page({
  data: {
    bookName: '',
    isLoading: true,
    loadError: false,
    pdfPath: '',
    pageCount: 0
  },

  onLoad(options) {
    const bookName = decodeURIComponent(options.bookName || '');
    this.setData({ bookName });
    if (bookName) {
      this.downloadAndPreview();
    } else {
      this.setData({ isLoading: false, loadError: true });
    }
  },

  async downloadAndPreview() {
    try {
      const session = app.globalData.session;
      // 统一走 _request 封装（自动带 baseURL / Authorization，并处理 401）
      const buffer = await request(
        '/members/account-book/files/' + encodeURIComponent(this.data.bookName),
        { token: session.token, responseType: 'arraybuffer' }
      );

      // Save temp file
      const fs = wx.getFileSystemManager();
      const tempPath = wx.env.USER_DATA_PATH + '/' + this.data.bookName;
      fs.writeFileSync(tempPath, buffer, 'binary');

      // Count pages from PDF buffer
      let pageCount = 0;
      try {
        const bytes = new Uint8Array(buffer);
        const text = new TextDecoder('latin1').decode(bytes);
        const countMatch = text.match(/\/Count\s+(\d+)/);
        if (countMatch) {
          pageCount = parseInt(countMatch[1], 10);
        } else {
          const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
          if (pageMatches) pageCount = pageMatches.length;
        }
      } catch {}

      this.setData({ isLoading: false, pdfPath: tempPath, pageCount });

      // Open preview
      wx.openDocument({
        filePath: tempPath,
        fileType: 'pdf',
        success: () => {},
        fail: () => {
          wx.showToast({ title: '预览失败，请尝试下载', icon: 'none' });
        }
      });
    } catch (err) {
      this.setData({ isLoading: false, loadError: true });
    }
  },

  handleOpenAgain() {
    if (this.data.pdfPath) {
      wx.openDocument({
        filePath: this.data.pdfPath,
        fileType: 'pdf',
        fail: () => {
          wx.showToast({ title: '打开失败', icon: 'none' });
        }
      });
    }
  },

  handleBack() {
    wx.navigateBack();
  }
});
