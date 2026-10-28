const app = getApp();
const { generateAccountBook } = require('../../../services/member');
const { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } = require('../../../utils/constants');
const { formatDateYMD } = require('../../../utils/date');

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

/** 生成服务状态词（正常 / 即将到期 / 已到期），拼进「服务」行展示 */
function buildExpireHint(expireTime) {
  var formatted = formatDateYMD(expireTime);
  if (!formatted) return '';
  var expireDate = new Date(formatted + 'T00:00:00');
  if (isNaN(expireDate.getTime())) return '';
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var diffDays = Math.ceil((expireDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return '已到期';
  if (diffDays <= 30) return '即将到期';
  return '正常';
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
      serviceText: buildServiceText(shop.expireTime)
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

  handleViewAccountBook() {
    const { accountBook, isOpening } = this.data;
    if (!accountBook || !accountBook.bookName || isOpening) return;
    wx.navigateTo({ url: '/pages/me/account-book/index?bookName=' + encodeURIComponent(accountBook.bookName) });
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
