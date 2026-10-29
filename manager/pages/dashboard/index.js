const app = getApp();
const { getDashboardSnapshot } = require('../../services/dashboard');
const { getExpireStatus } = require('../../utils/date');
const { showRenewDialog } = require('../../utils/renew');

// 首页快照 TTL：60s 内回到首页直接复用缓存，避免频繁重拉聚合接口
const DASHBOARD_TTL_MS = 60 * 1000;

Page({
  data: {
    dashboard: null,
    shop: null,
    expireStatus: '',
    dashboardError: '',
    isLoading: false,
    memberCount: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    if (!app.checkLogin()) return;

    const session = app.globalData.session;
    const shop = session.shop || {};
    this.setData({ shop, expireStatus: getExpireStatus(shop.expireTime) });

    this.loadDashboard();
  },

  onPullDownRefresh() {
    this.loadDashboard({ force: true }).finally(() => wx.stopPullDownRefresh());
  },

  async loadDashboard(options = {}) {
    const force = options.force === true;
    const cache = app.globalData.dashboardCache;
    const fresh =
      cache &&
      !app.globalData.dashboardDirty &&
      Date.now() - cache.ts < DASHBOARD_TTL_MS;
    if (!force && fresh) {
      this.setData({ dashboard: cache.data, memberCount: cache.data.totalMembers });
      return;
    }

    try {
      this.setData({ isLoading: true, dashboardError: '' });
      const session = app.globalData.session;
      const snapshot = await getDashboardSnapshot(session.token);
      app.globalData.dashboardCache = { data: snapshot, ts: Date.now() };
      app.globalData.dashboardDirty = false;
      this.setData({ dashboard: snapshot, memberCount: snapshot.totalMembers });
    } catch (err) {
      this.setData({ dashboardError: err.message || '首页数据读取失败' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /** 跳转新增会员 */
  navToAddMember() {
    wx.navigateTo({ url: '/pages/member/add/index' });
  },

  /** 跳转新增充值 */
  navToAddRecharge() {
    wx.navigateTo({ url: '/pages/recharge/add/index' });
  },

  /** 跳转新增消费 */
  navToAddConsumption() {
    wx.navigateTo({ url: '/pages/consumption/add/index' });
  },

  /** 联系续费：弹出客服电话引导（不放收款码/价目） */
  handleRenew() {
    showRenewDialog();
  }
});
