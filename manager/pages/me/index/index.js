const app = getApp();
const { generateAccountBook, ACCOUNT_BOOK_TIMEOUT_MS } = require('../../../services/member');
const { request } = require('../../../services/_request');
const { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } = require('../../../utils/constants');
const { formatDateYMD, getExpireStatus } = require('../../../utils/date');
const { showRenewDialog } = require('../../../utils/renew');

const ACCOUNT_BOOK_CACHE_PREFIX = 'account-book.cache.';

function readCachedAccountBook(shopId) {
  try {
    const raw = wx.getStorageSync(ACCOUNT_BOOK_CACHE_PREFIX + shopId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeCachedAccountBook(shopId, summary) {
  try { wx.setStorageSync(ACCOUNT_BOOK_CACHE_PREFIX + shopId, JSON.stringify(summary)); } catch {}
}

function parseBookDateRange(bookName) {
  const match = (bookName || '').match(/account_book_(\d{4})_\d+_(\d{8})\d{6}/);
  if (!match) return null;
  return match[1] + '0101 至 ' + match[2];
}

const EXPIRE_STATUS_WORD = { expired: '已到期', soon: '即将到期', normal: '正常' };

/** 生成服务状态词（正常 / 即将到期 / 已到期），拼进「服务」行展示；天数计算已收敛到 getExpireStatus */
function buildExpireHint(expireTime) {
  return EXPIRE_STATUS_WORD[getExpireStatus(expireTime)] || '';
}

/** 「服务」行文案：2027-04-28 截止，目前正常；无截止日期时只留占位，避免拼出读不通的句子 */
function buildServiceText(expireTime) {
  const formatted = formatDateYMD(expireTime);
  if (!formatted) return '暂无数据';
  const hint = buildExpireHint(formatted);
  return hint ? `${formatted} 截止，目前${hint}` : `${formatted} 截止`;
}

Page({
  data: {
    shop: null,
    accountBook: null,
    accountBookDateRange: '',
    isGenerating: false,
    isOpening: false,
    actionError: '',
    actionMessage: '',
    serviceText: '暂无数据',
    expireStatus: '',
    supportPhone: SUPPORT_PHONE_DISPLAY
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    if (!app.checkLogin()) return;

    const session = app.globalData.session;
    const shop = { ...(session.shop || {}) };
    if (shop.registerTime) {
      shop.registerTime = formatDateYMD(shop.registerTime);
    }
    if (shop.expireTime) {
      shop.expireTime = formatDateYMD(shop.expireTime);
    }
    this.setData({
      shop,
      serviceText: buildServiceText(shop.expireTime),
      expireStatus: getExpireStatus(shop.expireTime)
    });

    this.loadAccountBook();
  },

  async loadAccountBook() {
    const session = app.globalData.session;
    const shopId = (session.shop && session.shop.id) || '';
    if (!shopId) return;

    // Restore from cache only — do NOT auto-generate in background
    const cached = readCachedAccountBook(shopId);
    if (cached && cached.bookName) {
      this.setData({
        accountBook: cached,
        accountBookDateRange: parseBookDateRange(cached.bookName) || (cached.createTime || '')
      });
    }
  },

  async handleGenerateAccountBook() {
    if (this.data.isGenerating) return;
    try {
      this.setData({ isGenerating: true, actionError: '', actionMessage: '' });
      const session = app.globalData.session;
      const result = await generateAccountBook(session.token);
      if (!result.accountBook || !result.accountBook.bookName) {
        throw new Error('账本生成成功，但未返回账本文件信息');
      }
      this.setData({
        accountBook: result.accountBook,
        accountBookDateRange: parseBookDateRange(result.accountBook.bookName) || (result.accountBook.createTime || ''),
        actionMessage: result.message || '账本生成成功'
      });
      const shopId = (session.shop && session.shop.id) || '';
      if (shopId) writeCachedAccountBook(shopId, result.accountBook);
    } catch (err) {
      this.setData({ actionError: err.message || '生成账本失败，请稍后重试' });
    } finally {
      this.setData({ isGenerating: false });
    }
  },

  /** 下载账本 PDF 到本地临时文件，返回 { tempPath, fileName } */
  async downloadBookToTemp(bookName) {
    const session = app.globalData.session;
    // PDF 可达数 MB，弱网下默认 15s 会误判超时，与生成接口用同一档超时
    const buffer = await request(
      '/members/account-book/files/' + encodeURIComponent(bookName),
      { token: session.token, responseType: 'arraybuffer', timeout: ACCOUNT_BOOK_TIMEOUT_MS }
    );
    const fileName = /\.pdf$/i.test(bookName) ? bookName : bookName + '.pdf';
    const tempPath = wx.env.USER_DATA_PATH + '/' + fileName;
    wx.getFileSystemManager().writeFileSync(tempPath, buffer, 'binary');
    return { tempPath, fileName };
  },

  /** 查看账本：下载后直接拉起系统 PDF 预览，不再经过独立页面 */
  async handleViewAccountBook() {
    const { accountBook, isOpening } = this.data;
    if (!accountBook || !accountBook.bookName || isOpening) return;
    this.setData({ isOpening: true });
    wx.showLoading({ title: '正在打开账本...', mask: true });
    try {
      const { tempPath } = await this.downloadBookToTemp(accountBook.bookName);
      wx.hideLoading();
      wx.openDocument({
        filePath: tempPath,
        fileType: 'pdf',
        fail: () => { wx.showToast({ title: '预览失败，请重试', icon: 'none' }); }
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '账本加载失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ isOpening: false });
    }
  },

  /** 下载/发送账本：下载后通过微信把 PDF 发给好友/群/文件传输助手，便于保存、打印、转发 */
  async handleDownloadAccountBook() {
    const { accountBook, isOpening } = this.data;
    if (!accountBook || !accountBook.bookName || isOpening) return;
    this.setData({ isOpening: true });
    wx.showLoading({ title: '正在准备账本...', mask: true });
    try {
      const { tempPath, fileName } = await this.downloadBookToTemp(accountBook.bookName);
      wx.hideLoading();
      wx.shareFileMessage({
        filePath: tempPath,
        fileName,
        fail: () => { wx.showToast({ title: '发送已取消或失败', icon: 'none' }); }
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '账本加载失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ isOpening: false });
    }
  },

  navToShopEdit() { wx.navigateTo({ url: '/pages/me/shop-info/index' }); },
  navToPhone() { wx.navigateTo({ url: '/pages/me/phone/index' }); },
  navToPassword() { wx.navigateTo({ url: '/pages/me/password/index' }); },
  navToServiceSettings() { wx.navigateTo({ url: '/pages/me/service-settings/index' }); },
  navToPayTypeSettings() { wx.navigateTo({ url: '/pages/me/pay-type-settings/index' }); },
  navToMemberFieldSettings() { wx.navigateTo({ url: '/pages/member/field-settings/index' }); },

  /** 拨打服务人员电话 */
  handleCallSupport() {
    wx.makePhoneCall({
      phoneNumber: SUPPORT_PHONE,
      fail: () => {}
    });
  },

  /** 联系续费：弹出客服电话引导（不放收款码/价目） */
  handleRenew() {
    showRenewDialog();
  },

  /** 账号注销：应用内提交申请，运维回拨核实身份后再执行数据删除 */
  handleCancelAccount() {
    wx.navigateTo({ url: '/pages/me/cancellation/index' });
  },

  navToServiceAgreement() {
    wx.navigateTo({ url: '/pages/service-agreement/index?readonly=1' });
  },

  navToPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/privacy-policy/index?readonly=1' });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearStoredSession();
          wx.redirectTo({ url: '/pages/login/index' });
        }
      }
    });
  }
});
