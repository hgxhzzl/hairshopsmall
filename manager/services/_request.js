// 登录态失效时的跳转去重标志：并发请求同时返回 401 时只跳转登录页一次
let isRedirectingToLogin = false;

/** 获取 API 基础地址 */
function getApiBaseUrl() {
  const app = getApp();
  return app?.globalData?.apiBaseUrl || 'https://api.hairshop.shunshunlu.cn/api';
}

/** 构建完整请求 URL */
function buildUrl(pathname, query) {
  const base = getApiBaseUrl();
  let url = base + pathname;
  if (query) {
    const params = [];
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.push(`${key}=${encodeURIComponent(value)}`);
      }
    });
    if (params.length > 0) url += '?' + params.join('&');
  }
  return url;
}

/** 提取错误消息 */
function getErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback;
  const msg = payload.message || payload.msg;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : fallback;
}

/**
 * 通用请求封装
 * @param {string} pathname - API 路径，如 '/members'
 * @param {object} options
 * @param {string} options.method - GET/POST/PUT/DELETE
 * @param {object} options.data - 请求体
 * @param {string} options.token - Bearer token
 * @param {object} options.query - URL 查询参数
 * @param {string} options.responseType - 'text'（默认）或 'arraybuffer'（文件/二进制下载）
 * @returns {Promise<object>}
 */
function request(pathname, options = {}) {
  const app = getApp();
  const token = options.token || app?.globalData?.session?.token;
  const header = {
    'Content-Type': 'application/json'
  };
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(pathname, options.query),
      method: options.method || 'GET',
      header,
      data: options.data,
      timeout: options.timeout || 15000,
      responseType: options.responseType || 'text',
      success(res) {
        const payload = res.data;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(payload);
        } else if (res.statusCode === 401) {
          // token 失效：清会话并跳转登录，并发 401 只跳一次
          if (!isRedirectingToLogin) {
            isRedirectingToLogin = true;
            app?.clearStoredSession();
            wx.redirectTo({
              url: '/pages/login/index',
              complete() { isRedirectingToLogin = false; }
            });
          }
          reject(new Error('登录已过期，请重新登录'));
        } else {
          reject(new Error(getErrorMessage(payload, '请求失败，请稍后重试')));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

module.exports = {
  getApiBaseUrl,
  request,
  getErrorMessage
};
