const { request } = require('./_request');
const { syncFeatureConfigFromServer } = require('./featureConfig');
const { normalizeText, normalizeShop } = require('../utils/normalize');

const LOGIN_PATH = '/shops/login';

/** 获取缓存的登录信息 */
function getStoredSession() {
  const app = getApp();
  return app?.getStoredSession?.() || null;
}

/** 清除登录信息 */
function clearStoredSession() {
  const app = getApp();
  app?.clearStoredSession?.();
}

/** 持久化登录信息 */
function persistSession(session) {
  const app = getApp();
  app?.setStoredSession?.(session);
}

/** 更新缓存的 session（用于修改店铺信息后） */
function updateStoredSession(session) {
  persistSession(session);
}

/** 获取 API 基础地址 */
function getApiBaseUrl() {
  const app = getApp();
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
  // 登录成功后异步回填服务端功能配置（不阻塞跳转，失败静默降级为本地缓存）
  syncFeatureConfigFromServer(token);
  return session;
}

/**
 * 店铺注册
 * @param {{ shop_name: string, owner_name: string, phone_number: string, password: string, address: string, phone_verify_ticket?: string, sms_code?: string }} payload
 */
async function registerShop(payload) {
  const data = {
    shop_name: payload.shop_name.trim(),
    owner_name: payload.owner_name.trim(),
    phone_number: payload.phone_number.trim(),
    password: payload.password.trim(),
    address: payload.address.trim()
  };

  // 手机号验证凭证：一键路径带 ticket，短信兜底路径带 code，二选一
  if (payload.phone_verify_ticket) {
    data.phone_verify_ticket = payload.phone_verify_ticket.trim();
  }
  if (payload.sms_code) {
    data.sms_code = payload.sms_code.trim();
  }

  const response = await request('/shops/register', {
    method: 'POST',
    data
  });
  return response;
}

/**
 * 微信一键获取手机号：用 getPhoneNumber 回调的 code 换回经微信验证的手机号 + verify_ticket
 * @param {string} code
 * @returns {Promise<{ phoneNumber: string, verifyTicket: string, mode: string }>}
 */
async function verifyWechatPhone(code) {
  const response = await request('/shops/register/wechat-phone', {
    method: 'POST',
    data: { code }
  });
  const record = (response && response.data) || {};
  const phoneNumber = normalizeText(record.phone_number);
  const verifyTicket = normalizeText(record.verify_ticket);
  if (!phoneNumber || !verifyTicket) {
    throw new Error('手机号验证失败，请改用其他手机号');
  }
  return { phoneNumber, verifyTicket, mode: normalizeText(record.mode) };
}

/**
 * 注册短信兜底发码（手动输入非微信绑定号时）
 * @param {string} phoneNumber
 * @returns {Promise<{ mode: string, expire_seconds: number }>}
 */
async function sendRegisterSmsCode(phoneNumber) {
  const response = await request('/shops/register/sms-code', {
    method: 'POST',
    data: { phone_number: phoneNumber.trim() }
  });
  return (response && response.data) || null;
}

module.exports = {
  getStoredSession,
  clearStoredSession,
  updateStoredSession,
  getApiBaseUrl,
  loginShop,
  registerShop,
  verifyWechatPhone,
  sendRegisterSmsCode
};
