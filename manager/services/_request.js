const app = getApp();

/** 获取 API 基础地址 */
function getApiBaseUrl() {
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
 * @returns {Promise<object>}
 */
function request(pathname, options = {}) {
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
      success(res) {
        const payload = res.data;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(payload);
        } else if (res.statusCode === 401) {
          // token 失效，跳转登录
          app?.clearStoredSession();
          wx.redirectTo({ url: '/pages/login/index' });
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

/**
 * 带错误处理的 API 请求，返回 data 字段
 */
async function apiRequest(pathname, options = {}) {
  const response = await request(pathname, options);
  if (response === null || response === undefined) {
    throw new Error('接口未返回有效数据');
  }
  return response;
}

module.exports = {
  getApiBaseUrl,
  request,
  apiRequest,
  getErrorMessage
};
