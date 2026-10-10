const { request } = require('./_request');

function normalizeText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const v = Number(value); return Number.isFinite(v) ? v : 0; }
  return 0;
}

function normalizeService(item) {
  return {
    id: normalizeText(item.id || item.service_id),
    name: normalizeText(item.item_name || item.name),
    normalPrice: normalizeNumber(item.normal_price || item.normalPrice),
    memberPrice: normalizeNumber(item.member_price || item.memberPrice),
    status: normalizeNumber(item.status)
  };
}

/** 获取服务列表 */
async function getServices(token) {
  const res = await request('/services', { token });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.filter(item => item && typeof item === 'object' && item.is_deleted !== 1 && item.is_deleted !== '1').map(normalizeService).filter(item => item.id && item.name);
}

/** 新增服务 */
async function createService(token, payload) {
  const res = await request('/services', { method: 'POST', token, data: payload });
  return normalizeService((res.data || {}));
}

/** 修改服务 */
async function updateService(token, serviceId, payload) {
  const res = await request(`/services/${serviceId}`, { method: 'PUT', token, data: payload });
  return normalizeService((res.data || {}));
}

/** 删除服务 */
async function deleteService(token, serviceId) {
  await request(`/services/${serviceId}`, { method: 'DELETE', token });
}

module.exports = { getServices, createService, updateService, deleteService };
