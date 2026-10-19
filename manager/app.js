const AUTH_STORAGE_KEY = 'hairshop-manager-auth';

App({
  globalData: {
    session: null,
    apiBaseUrl: 'https://api.hairshop.shunshunlu.cn/api',
    // 首页快照缓存：{ data, ts }，配合 dashboardDirty 实现 onShow TTL 复用
    dashboardCache: null,
    dashboardDirty: false,
    // 服务项目快照缓存：{ rows, ts }，低频变更的小表，避免录入/选择/服务页每次 onShow 重拉
    servicesCache: null,
    servicesDirty: false
  },

  onLaunch() {
    // 恢复登录态
    const session = this.getStoredSession();
    if (session) {
      this.globalData.session = session;
      // 冷启动已登录时同步一次服务端功能配置
      const { syncFeatureConfigFromServer } = require('./services/featureConfig');
      syncFeatureConfigFromServer(session.token);
    }
  },

  /** 读取本地存储的登录信息 */
  getStoredSession() {
    try {
      const raw = wx.getStorageSync(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.token && parsed.phone) return parsed;
      return null;
    } catch {
      return null;
    }
  },

  /** 持久化登录信息 */
  setStoredSession(session) {
    wx.setStorageSync(AUTH_STORAGE_KEY, JSON.stringify(session));
    this.globalData.session = session;
    // 切换登录身份时丢弃上一个店铺首页与服务缓存
    this.invalidateDashboardCache();
    this.invalidateServicesCache();
  },

  /** 清除登录信息 */
  clearStoredSession() {
    wx.removeStorageSync(AUTH_STORAGE_KEY);
    this.globalData.session = null;
    this.globalData.dashboardCache = null;
    this.globalData.dashboardDirty = false;
    this.globalData.servicesCache = null;
    this.globalData.servicesDirty = false;
  },

  /** 标记首页数据已变更，下次 onShow 需强制刷新 */
  invalidateDashboardCache() {
    this.globalData.dashboardCache = null;
    this.globalData.dashboardDirty = true;
  },

  /** 标记服务项目已变更（新增/修改/删除后），下次 getServices 需重拉 */
  invalidateServicesCache() {
    this.globalData.servicesCache = null;
    this.globalData.servicesDirty = true;
  },

  /** 检查登录态，未登录则跳转登录页 */
  checkLogin() {
    if (!this.globalData.session) {
      wx.redirectTo({ url: '/pages/login/index' });
      return false;
    }
    return true;
  }
});
