const { request } = require('./_request');
const app = getApp();

const LOGIN_PATH = '/shops/login';
const AUTH_STORAGE_KEY = 'hairshop-manager-auth';

/** 获取缓存的登录信息 */
function getStoredSession() {
  return app?.getStoredSession?.() || null;
}

/** 清除登录信息 */
function clearStoredSession() {
  app?.clearStoredSession?.();
}

/** 持久化登录信息 */
function persistSession(session) {
  app?.setStoredSession?.(session);
}

/** 更新缓存的 session（用于修改店铺信息后） */
function updateStoredSession(session) {
  persistSession(session);
}

/** 获取 API 基础地址 */
function getApiBaseUrl() {
  return app?.globalData?.apiBaseUrl || 'https://api.hairshop.shunshunlu.cn/api';
}

/**
 * 店铺登录
 * @param {{ phone: string, password: string }} payload
 * @returns {Promise<{ token: string, phone: string, shop: object|null }>}
 */
async function loginShop(payload) {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    data: {
      phone: payload.phone.trim(),
      password: payload.password.trim()
    }
  });

  const token = typeof response.token === 'string' ? response.token.trim() : '';
  const message = typeof response.message === 'string' ? response.message.trim() : '';

  if (!token) {
    throw new Error(message || '登录成功，但接口未返回 token');
  }

  const shop = normalizeShop(response.data);

  const session = {
    token,
    phone: payload.phone.trim(),
    shop
  };

  persistSession(session);
  return session;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeShop(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload;
  return {
    id: String(record.id || '').trim(),
    shopName: normalizeText(record.shop_name || record.shopName),
    ownerName: normalizeText(record.owner_name || record.ownerName),
    phoneNumber: normalizeText(record.phone_number || record.phoneNumber),
    address: normalizeText(record.address),
    registerTime: normalizeText(record.register_time || record.registerTime),
    expireTime: normalizeText(record.expire_time || record.expireTime)
  };
}

/**
 * 店铺注册
 * @param {{ shop_name: string, owner_name: string, phone_number: string, password: string, address: string }} payload
 */
async function registerShop(payload) {
  const response = await request('/shops/register', {
    method: 'POST',
    data: {
      shop_name: payload.shop_name.trim(),
      owner_name: payload.owner_name.trim(),
      phone_number: payload.phone_number.trim(),
      password: payload.password.trim(),
      address: payload.address.trim()
    }
  });
  return response;
}

module.exports = {
  getStoredSession,
  clearStoredSession,
  updateStoredSession,
  getApiBaseUrl,
  loginShop,
  registerShop
};
