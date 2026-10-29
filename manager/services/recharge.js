const { request } = require('./_request');
const { normalizeText, normalizeNumber, isDeleted } = require('../utils/normalize');
const { getMonthRange } = require('../utils/date');

function normalizeRecharge(item) {
  return {
    id: normalizeText(item.id),
    memberId: normalizeText(item.member_id),
    memberName: normalizeText(item.member_name),
    amount: normalizeNumber(item.recharge_amount),
    giftAmount: normalizeNumber(item.gift_amount),
    benefitType: normalizeNumber(item.benefit_type) === 0 ? 0 : 1,
    payMethod: normalizeText(item.pay_method),
    time: normalizeText(item.created_time),
    phone: normalizeText(item.member_info?.phone_number),
    serviceItemCount: normalizeNumber(item._count?.recharge_order_item),
    entitlementCount: normalizeNumber(item._count?.member_service_entitlement),
    entitlementUsedCount: normalizeNumber(item._count?.usecount)
  };
}

function normalizeRechargeItems(item) {
  const rows = Array.isArray(item.recharge_order_item) ? item.recharge_order_item : [];
  return rows.filter(e => e && typeof e === 'object').map((e, i) => ({
    id: normalizeText(e.id) || normalizeText(e.service_info_id) || `item-${i}`,
    serviceInfoId: normalizeText(e.service_info_id),
    rechargeOrderItemId: Number.isInteger(normalizeNumber(e.id)) ? normalizeNumber(e.id) : undefined,
    name: normalizeText(e.item_name) || normalizeText(e.name) || normalizeText(e.service_info?.item_name) || normalizeText(e.service_info?.name) || '服务项目',
    count: Math.max(1, normalizeNumber(e.quantity || e.count || 1)),
    normalPrice: normalizeNumber(e.normal_price || e.normalPrice || e.service_info?.normal_price || e.service_info?.normalPrice),
    memberPrice: normalizeNumber(e.member_price || e.memberPrice || e.service_info?.member_price || e.service_info?.memberPrice)
  }));
}

/** 获取充值列表 */
async function getRechargeOrders(token, options = {}) {
  const query = { ...getMonthRange(), page: 1, pageSize: 20, ...options };
  const res = await request('/recharge-orders', { token, query });
  const rows = Array.isArray(res.data) ? res.data : [];
  const pagination = (res.pagination && typeof res.pagination === 'object') ? res.pagination : {};
  return {
    rows: rows.filter(item => item && typeof item === 'object' && !isDeleted(item.is_deleted)).map(normalizeRecharge),
    pagination: pagination
  };
}

/** 新增充值 */
async function createRechargeOrder(token, payload) {
  const res = await request('/recharge-orders', { method: 'POST', token, data: payload });
  if (!res.data || typeof res.data !== 'object') throw new Error('充值创建成功，但返回数据无效');
  return normalizeRecharge(res.data);
}

/** 获取充值详情 */
async function getRechargeOrderDetail(token, rechargeId) {
  const res = await request(`/recharge-orders/${rechargeId}`, { token });
  if (!res.data || typeof res.data !== 'object') throw new Error('未获取到充值详情');
  return { ...normalizeRecharge(res.data), items: normalizeRechargeItems(res.data) };
}

/** 删除充值 */
async function deleteRechargeOrder(token, rechargeId) {
  await request(`/recharge-orders/${rechargeId}`, { method: 'DELETE', token });
}

/** 修改充值 */
async function updateRechargeOrder(token, rechargeId, payload) {
  const res = await request(`/recharge-orders/${rechargeId}`, { method: 'PUT', token, data: payload });
  const data = res.data && typeof res.data === 'object' ? (res.data.recharge_order || res.data) : null;
  if (!data || typeof data !== 'object') throw new Error('充值修改成功，但返回数据无效');
  return { ...normalizeRecharge(data), items: normalizeRechargeItems(data) };
}

module.exports = { getRechargeOrders, createRechargeOrder, getRechargeOrderDetail, deleteRechargeOrder, updateRechargeOrder };
