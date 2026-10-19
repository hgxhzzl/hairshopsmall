const { request } = require('./_request');
const { normalizeText, normalizeNumber, isDeleted } = require('../utils/normalize');

function normalizeService(item) {
  return {
    id: normalizeText(item.id || item.service_id),
    name: normalizeText(item.item_name || item.name),
    normalPrice: normalizeNumber(item.normal_price || item.normalPrice),
    memberPrice: normalizeNumber(item.member_price || item.memberPrice),
    status: normalizeNumber(item.status)
  };
}

/** 获取服务列表（带 TTL 快照缓存） */
// 服务表低频变更：5 分钟内复用缓存，避免录入/选择/服务页每次 onShow 重拉。
// 本地新增/修改/删除及切换登录身份均会立即失效；跨设备变更最多滞后一个 TTL。
const SERVICES_TTL_MS = 5 * 60 * 1000;

async function getServices(token, options = {}) {
  const app = getApp();
  const cache = app && app.globalData ? app.globalData.servicesCache : null;
  const fresh = cache && options.force !== true &&
    !app.globalData.servicesDirty &&
    (Date.now() - cache.ts < SERVICES_TTL_MS);
  if (fresh) return cache.rows.slice();

  const res = await request('/services', { token });
  const rows = Array.isArray(res.data) ? res.data : [];
  const data = rows.filter(item => item && typeof item === 'object' && !isDeleted(item.is_deleted)).map(normalizeService).filter(item => item.id && item.name);
  if (app && app.globalData) {
    app.globalData.servicesCache = { rows: data, ts: Date.now() };
    app.globalData.servicesDirty = false;
  }
  return data;
}

/** 新增服务 */
async function createService(token, payload) {
  const res = await request('/services', { method: 'POST', token, data: payload });
  getApp()?.invalidateServicesCache?.();
  return normalizeService((res.data || {}));
}

/** 修改服务 */
async function updateService(token, serviceId, payload) {
  const res = await request(`/services/${serviceId}`, { method: 'PUT', token, data: payload });
  getApp()?.invalidateServicesCache?.();
  return normalizeService((res.data || {}));
}

/** 删除服务 */
async function deleteService(token, serviceId) {
  await request(`/services/${serviceId}`, { method: 'DELETE', token });
  getApp()?.invalidateServicesCache?.();
}

module.exports = { getServices, createService, updateService, deleteService };
