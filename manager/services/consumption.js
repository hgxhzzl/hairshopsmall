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

function isDeleted(value) { return value === 1 || value === '1'; }

function getMonthRange() {
  const now = new Date();
  return {
    create_time_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    create_time_end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
  };
}

function normalizeConsumption(item) {
  return {
    id: normalizeText(item.id),
    memberId: normalizeText(item.member_id),
    memberName: normalizeText(item.member_name),
    amount: normalizeNumber(item.total_amount),
    payAmount: normalizeNumber(item.pay_amount),
    payType: Math.min(2, Math.max(0, normalizeNumber(item.pay_type))),
    time: normalizeText(item.updated_time || item.create_time),
    phone: normalizeText(item.member_info?.phone_number),
    primaryItemName: Array.isArray(item.consumption_item) && item.consumption_item[0] ? normalizeText(item.consumption_item[0].item_name) : '消费项目',
    serviceCount: Array.isArray(item.consumption_item) ? item.consumption_item.reduce((s, e) => s + Math.max(1, normalizeNumber(e.quantity || 1)), 0) : 0,
    remark: normalizeText(item.remark)
  };
}

function normalizeConsumptionItems(item) {
  const rows = Array.isArray(item.consumption_item) ? item.consumption_item : [];
  return rows.filter(e => e && typeof e === 'object').map((e, i) => {
    const name = normalizeText(e.item_name) || normalizeText(e.name) || normalizeText(e.service_info?.item_name) || normalizeText(e.service_info?.name) || '消费项目';
    const entitlementIds = Array.isArray(e.member_service_entitlement_id) ? e.member_service_entitlement_id : e.member_service_entitlement_id == null ? [] : [e.member_service_entitlement_id];
    return {
      id: normalizeText(e.id) || normalizeText(e.service_info_id) || `${name}-${i}`,
      serviceInfoId: normalizeText(e.service_info_id),
      name,
      count: Math.max(1, normalizeNumber(e.quantity || 1)),
      price: normalizeNumber(e.price || e.service_info?.price),
      amount: normalizeNumber(e.amount || e.total_amount),
      normalPrice: normalizeNumber(e.normal_price || e.normalPrice || e.service_info?.normal_price || e.service_info?.normalPrice),
      memberPrice: normalizeNumber(e.member_price || e.memberPrice || e.service_info?.member_price || e.service_info?.memberPrice),
      memberServiceEntitlementId: entitlementIds.length > 0 ? normalizeNumber(entitlementIds[0]) : null,
      memberServiceEntitlementIds: entitlementIds.map(id => normalizeNumber(id)).filter(id => Number.isInteger(id) && id > 0)
    };
  });
}

/** 获取消费列表 */
async function getConsumptionOrders(token, options = {}) {
  const query = { ...getMonthRange(), page: 1, pageSize: 100, ...options };
  const res = await request('/consumption-orders', { token, query });
  const rows = Array.isArray(res.data) ? res.data : [];
  const pagination = (res.pagination && typeof res.pagination === 'object') ? res.pagination : {};
  return {
    rows: rows.filter(item => item && typeof item === 'object' && !isDeleted(item.is_deleted)).map(normalizeConsumption),
    pagination: pagination
  };
}

/** 新增消费 */
async function createConsumptionOrder(token, payload) {
  const res = await request('/consumption-orders', { method: 'POST', token, data: payload });
  if (!res.data || typeof res.data !== 'object') throw new Error('消费创建成功，但返回数据无效');
  return normalizeConsumption(res.data);
}

/** 获取消费详情 */
async function getConsumptionOrderDetail(token, consumptionId) {
  const res = await request(`/consumption-orders/${consumptionId}`, { token });
  if (!res.data || typeof res.data !== 'object') throw new Error('未获取到消费详情');
  return { ...normalizeConsumption(res.data), items: normalizeConsumptionItems(res.data) };
}

/** 删除消费 */
async function deleteConsumptionOrder(token, consumptionId) {
  await request(`/consumption-orders/${consumptionId}`, { method: 'DELETE', token });
}

/** 修改消费 */
async function updateConsumptionOrder(token, consumptionId, payload) {
  const res = await request(`/consumption-orders/${consumptionId}`, { method: 'PUT', token, data: payload });
  const data = res.data && typeof res.data === 'object' ? (res.data.consumption_order || res.data) : null;
  if (!data || typeof data !== 'object') throw new Error('消费修改成功，但返回数据无效');
  return { ...normalizeConsumption(data), items: normalizeConsumptionItems(data) };
}

module.exports = { getConsumptionOrders, createConsumptionOrder, getConsumptionOrderDetail, deleteConsumptionOrder, updateConsumptionOrder };
