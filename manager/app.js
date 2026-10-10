const AUTH_STORAGE_KEY = 'hairshop-manager-auth';

App({
  globalData: {
    session: null,
    apiBaseUrl: 'https://api.hairshop.shunshunlu.cn/api'
  },

  onLaunch() {
    // 恢复登录态
    const session = this.getStoredSession();
    if (session) {
      this.globalData.session = session;
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
  },

  /** 清除登录信息 */
  clearStoredSession() {
    wx.removeStorageSync(AUTH_STORAGE_KEY);
    this.globalData.session = null;
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
