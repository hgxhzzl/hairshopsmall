const app = getApp();

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
      const apiBaseUrl = app.globalData.apiBaseUrl;
      const url = apiBaseUrl + '/members/account-book/files/' + encodeURIComponent(this.data.bookName);

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url,
          header: { Authorization: 'Bearer ' + session.token },
          responseType: 'arraybuffer',
          success: (res) => {
            if (res.statusCode === 200) resolve(res);
            else reject(new Error(String(res.statusCode)));
          },
          fail: reject
        });
      });

      // Save temp file
      const fs = wx.getFileSystemManager();
      const tempPath = wx.env.USER_DATA_PATH + '/' + this.data.bookName;
      fs.writeFileSync(tempPath, res.data, 'binary');

      // Count pages from PDF buffer
      let pageCount = 0;
      try {
        const bytes = new Uint8Array(res.data);
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
