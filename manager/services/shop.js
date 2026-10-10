const { request } = require('./_request');

function normalizeText(value) { return typeof value === 'string' ? value.trim() : ''; }

function normalizeShop(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    id: String(record.id || '').trim(),
    shopName: normalizeText(record.shop_name || record.shopName),
    ownerName: normalizeText(record.owner_name || record.ownerName),
    phoneNumber: normalizeText(record.phone_number || record.phoneNumber),
    address: normalizeText(record.address),
    registerTime: normalizeText(record.register_time || record.registerTime),
    expireTime: normalizeText(record.expire_time || record.expireTime),
    status: typeof record.status === 'number' ? record.status : (record.status !== undefined ? Number(record.status) : 0)
  };
}

/** 获取店铺信息 */
async function getCurrentShopInfo(token) {
  const res = await request('/shops/info', { token });
  if (!res.data || typeof res.data !== 'object') throw new Error('店铺信息读取失败');
  return normalizeShop(res.data);
}

/** 更新店铺信息 */
async function updateShopInfo(token, payload) {
  const app = getApp();
  const shopId = (app.globalData.session && app.globalData.session.shop && app.globalData.session.shop.id) || '';
  if (!shopId) throw new Error('当前登录店铺缺少 ID');
  const res = await request(`/shops/${shopId}`, { method: 'PUT', token, data: payload });
  if (!res.data || typeof res.data !== 'object') throw new Error('店铺资料更新失败');
  return normalizeShop(res.data);
}

/** 修改密码 */
async function changeShopPassword(token, payload) {
  const app = getApp();
  const shopId = (app.globalData.session && app.globalData.session.shop && app.globalData.session.shop.id) || '';
  if (!shopId) throw new Error('当前登录店铺缺少 ID');
  await request(`/shops/${shopId}/password`, { method: 'PUT', token, data: payload });
}

/** 注销原因 code → 页面文案（与后端枚举一一对应，改文案不动数据） */
const CANCELLATION_REASONS = [
  { code: 'closed_shop', label: '店铺已停业或转让', desc: '不再经营，需要注销账号' },
  { code: 'switch_system', label: '换用了其他软件', desc: '已有别的系统在用' },
  { code: 'price', label: '费用偏高 / 不划算', desc: '价格与服务不匹配' },
  { code: 'feature_missing', label: '缺少我需要的功能', desc: '希望增加的能力目前没有' },
  { code: 'hard_to_use', label: '不会操作 / 太麻烦', desc: '上手困难，平时用不上' },
  { code: 'other', label: '其他', desc: '请在下方补充一句话说明' }
];

/** 申请状态码 → 文案 */
const CANCELLATION_STATUS_TEXT = {
  0: '待受理',
  1: '已联系核实',
  2: '已完成',
  3: '已驳回',
  4: '已撤回'
};

function normalizeCancellationRequest(record) {
  if (!record || typeof record !== 'object') return null;
  const status = typeof record.status === 'number' ? record.status : Number(record.status);
  const reason = CANCELLATION_REASONS.filter(function (item) { return item.code === record.reason_code; })[0];
  return {
    id: record.id,
    status: status,
    statusText: CANCELLATION_STATUS_TEXT[status] || '未知状态',
    isActive: status === 0 || status === 1,
    reasonCode: record.reason_code || '',
    reasonLabel: reason ? reason.label : '',
    reasonText: record.reason_text || '',
    handleNote: record.handle_note || '',
    createTime: record.create_time || '',
    contactTime: record.contact_time || '',
    doneTime: record.done_time || ''
  };
}

/** 提交账号注销申请 */
async function submitCancellationRequest(token, payload) {
  const res = await request('/shops/cancellation-request', { method: 'POST', token, data: payload });
  return normalizeCancellationRequest(res && res.data && res.data.request);
}

/** 查询当前注销申请状态 */
async function getCancellationRequest(token) {
  const res = await request('/shops/cancellation-request', { method: 'GET', token });
  return normalizeCancellationRequest(res && res.data && res.data.request);
}

/** 撤回注销申请（数据实际删除前均可撤回） */
async function withdrawCancellationRequest(token, payload) {
  const res = await request('/shops/cancellation-request/withdraw', { method: 'POST', token, data: payload });
  return normalizeCancellationRequest(res && res.data && res.data.request);
}

module.exports = {
  getCurrentShopInfo,
  updateShopInfo,
  changeShopPassword,
  CANCELLATION_REASONS,
  submitCancellationRequest,
  getCancellationRequest,
  withdrawCancellationRequest
};
