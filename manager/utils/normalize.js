/**
 * 跨 service 共享的字段规范化工具。
 *
 * normalizeText / normalizeNumber / isDeleted 原先在 member / recharge /
 * consumption / service 等多个 service 里各写了一份完全相同的实现，
 * 统一收敛到这里，避免规范化规则的修改漏改其中一处。
 */

/** 归一化为字符串：字符串 trim、有限数字转字符串，其余返回空串 */
function normalizeText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** 归一化为数字：数字原样、可解析字符串转数字，其余返回 0 */
function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const v = Number(value); return Number.isFinite(v) ? v : 0; }
  return 0;
}

/** 软删除标记：兼容数字 1 与字符串 '1' */
function isDeleted(value) { return value === 1 || value === '1'; }

/**
 * 店铺记录规范化：统一 auth.js（登录）与 shop.js（店铺信息）两处各写一份的
 * normalizeShop，字段取二者超集（含 status）。
 */
function normalizeShop(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    id: normalizeText(record.id || ''),
    shopName: normalizeText(record.shop_name || record.shopName),
    ownerName: normalizeText(record.owner_name || record.ownerName),
    phoneNumber: normalizeText(record.phone_number || record.phoneNumber),
    address: normalizeText(record.address),
    registerTime: normalizeText(record.register_time || record.registerTime),
    expireTime: normalizeText(record.expire_time || record.expireTime),
    status: typeof record.status === 'number' ? record.status : (record.status !== undefined ? Number(record.status) : 0)
  };
}

module.exports = {
  normalizeText,
  normalizeNumber,
  isDeleted,
  normalizeShop
};
