const app = getApp();
const { getDashboardSnapshot } = require('../../services/dashboard');

Page({
  data: {
    dashboard: null,
    shop: null,
    dashboardError: '',
    isLoading: false,
    refreshKey: 0,
    memberCount: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    if (!app.checkLogin()) return;

    const session = app.globalData.session;
    this.setData({ shop: session.shop || {} });

    this.loadDashboard();
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh());
  },

  async loadDashboard() {
    try {
      this.setData({ isLoading: true, dashboardError: '' });
      const session = app.globalData.session;
      const snapshot = await getDashboardSnapshot(session.token);
      this.setData({ dashboard: snapshot, memberCount: snapshot.totalMembers });
    } catch (err) {
      this.setData({ dashboardError: err.message || '首页数据读取失败' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /** 格式化金额 */
  formatMoney(value) {
    return '¥' + (value || 0).toFixed(2);
  },

  /** 格式化人数 */
  formatCount(value) {
    return (value || 0) + '人';
  },

  /** 格式化日期 */
  formatDate(value) {
    if (!value) return '未记录';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  }
});
