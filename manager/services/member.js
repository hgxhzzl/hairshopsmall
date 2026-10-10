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

function normalizeMember(item) {
  return {
    id: normalizeText(item.id || item.member_id),
    memberNo: normalizeText(item.member_no),
    name: normalizeText(item.member_name),
    phone: normalizeText(item.phone_number),
    gender: normalizeText(item.gender),
    registerTime: normalizeText(item.register_time),
    balance: normalizeNumber(item.account_balance),
    prepaid: normalizeNumber(item.prepaid_balance),
    totalRechargeAmount: normalizeNumber(item.total_recharge_amount),
    totalConsumptionAmount: normalizeNumber(item.total_consumption_amount)
  };
}

function normalizeMemberDetail(item) {
  return {
    ...normalizeMember(item),
    birthDate: normalizeText(item.birth_date),
    remark: normalizeText(item.remark),
    status: normalizeText(item.status),
    beginningBalance: normalizeNumber(item.beginning_account_balance),
    beginningPrepaid: normalizeNumber(item.beginning_prepaid_balance),
    lastRechargeAmount: normalizeNumber(item.last_recharge_amount),
    lastRechargeTime: normalizeText(item.last_recharge_time),
    lastConsumptionAmount: normalizeNumber(item.last_consumption_amount),
    lastConsumptionTime: normalizeText(item.last_consumption_time)
  };
}

function normalizeEntitlement(item) {
  return {
    id: normalizeText(item.id),
    memberId: normalizeText(item.member_id),
    serviceInfoId: normalizeText(item.service_info_id),
    itemName: normalizeText(item.item_name),
    price: normalizeNumber(item.price || item.member_price),
    normalPrice: normalizeNumber(item.normal_price),
    memberPrice: normalizeNumber(item.member_price),
    source: normalizeText(item.source)
  };
}

/** 获取会员列表 */
async function getMembers(token) {
  const res = await request('/members', { token, query: { page: 1, pageSize: 500 } });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.filter(item => item && typeof item === 'object' && !isDeleted(item.is_deleted)).map(normalizeMember);
}

/** 获取会员详情 */
async function getMemberById(token, memberId) {
  const res = await request(`/members/${memberId}`, { token });
  if (!res.data || typeof res.data !== 'object') throw new Error('未获取到会员详情');
  return normalizeMemberDetail(res.data);
}

/** 新增会员 */
async function createMember(token, payload) {
  const res = await request('/members', { method: 'POST', token, data: payload });
  if (!res.data || typeof res.data !== 'object') throw new Error('新增成功，但接口未返回会员信息');
  return normalizeMemberDetail(res.data);
}

/** 修改会员 */
async function updateMember(token, memberId, payload) {
  const res = await request(`/members/${memberId}`, { method: 'PUT', token, data: payload });
  if (!res.data || typeof res.data !== 'object') throw new Error('修改成功，但接口未返回会员信息');
  return normalizeMemberDetail(res.data);
}

/** 删除会员 */
async function deleteMember(token, memberId) {
  const res = await request(`/members/${memberId}`, { method: 'DELETE', token });
  return res;
}

/** 获取会员权益 */
async function getMemberServiceEntitlements(token, memberId) {
  const res = await request('/member-service-entitlements', { token, query: { member_id: memberId } });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.filter(item => item && typeof item === 'object').map(normalizeEntitlement).filter(item => item.id && item.serviceInfoId);
}

/** 解析会员预约二维码文本（对齐 RN resolveMemberBookQrText） */
function resolveMemberBookQrText(ticket) {
  if (!ticket || typeof ticket !== 'object') return '';

  var queryUrl = normalizeText(ticket.query_url);
  if (queryUrl) return queryUrl;

  var queryPath = normalizeText(ticket.query_path);
  if (!queryPath) return '';

  // 拼接 base origin（去掉 /api 后缀）
  var apiBase = (getApp().globalData.apiBaseUrl || 'https://api.hairshop.shunshunlu.cn/api');
  var origin = apiBase.replace(/\/api\/?.*$/, '');
  return origin + (queryPath.charAt(0) === '/' ? '' : '/') + queryPath;
}

/** 获取会员预约二维码文本 */
async function getMemberBookQrText(token, memberId) {
  var res = await request('/members/' + memberId + '/member-book-ticket', { method: 'POST', token: token });
  return resolveMemberBookQrText(res.data && typeof res.data === 'object' ? res.data : null);
}

/** 生成账本 */
async function generateAccountBook(token) {
  const res = await request('/members/account-book/generate', { method: 'POST', token });
  const msg = normalizeText(res.message) || '账本生成成功';
  const data = res.data;
  if (data && typeof data === 'object') {
    const book = { createTime: normalizeText(data.create_time || data.createTime), bookName: normalizeText(data.book_name || data.bookName), downloadPath: normalizeText(data.download_path || data.downloadPath) };
    return { message: msg, accountBook: (book.createTime || book.bookName || book.downloadPath) ? book : null };
  }
  return { message: msg, accountBook: null };
}

module.exports = { getMembers, getMemberById, createMember, updateMember, deleteMember, getMemberServiceEntitlements, getMemberBookQrText, generateAccountBook };
