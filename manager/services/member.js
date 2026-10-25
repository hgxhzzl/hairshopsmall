const { request } = require('./_request');
const { normalizeText, normalizeNumber } = require('../utils/normalize');

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

/** 获取会员列表（服务端关键字搜索 + 分页） */
async function getMembers(token, options = {}) {
  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const res = await request('/members', {
    token,
    query: { page, pageSize, keyword: options.keyword || '' }
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  // 后端已过滤软删除会员，客户端不再重复过滤
  const data = rows.filter(item => item && typeof item === 'object').map(normalizeMember);
  const pagination = res.pagination || { page, pageSize, total: data.length, totalPages: 1 };
  return { data, pagination };
}

/** 获取当前店铺会员汇总（总数/性别/余额合计，不受分页与搜索影响） */
async function getMemberSummary(token) {
  const res = await request('/members/summary', { token });
  const d = res && res.data ? res.data : {};
  return {
    totalCount: normalizeNumber(d.total),
    maleCount: normalizeNumber(d.maleCount),
    femaleCount: normalizeNumber(d.femaleCount),
    totalBalance: normalizeNumber(d.totalBalance),
    totalPrepaid: normalizeNumber(d.totalPrepaid)
  };
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

/**
 * 账本 PDF 由服务端用无头浏览器逐页渲染，会员多的店铺要几十秒。
 * 默认 15s 必然先超时（用户看到“网络请求失败”，后端其实还在继续生成），
 * 这里单独放宽到 120s；nginx 的 proxy_read_timeout 已对齐到 180s。
 */
const ACCOUNT_BOOK_TIMEOUT_MS = 120000;

/** 生成账本 */
async function generateAccountBook(token) {
  const res = await request('/members/account-book/generate', {
    method: 'POST',
    token,
    timeout: ACCOUNT_BOOK_TIMEOUT_MS
  });
  const msg = normalizeText(res.message) || '账本生成成功';
  const data = res.data;
  if (data && typeof data === 'object') {
    const book = { createTime: normalizeText(data.create_time || data.createTime), bookName: normalizeText(data.book_name || data.bookName), downloadPath: normalizeText(data.download_path || data.downloadPath) };
    return { message: msg, accountBook: (book.createTime || book.bookName || book.downloadPath) ? book : null };
  }
  return { message: msg, accountBook: null };
}

module.exports = { getMembers, getMemberSummary, getMemberById, createMember, updateMember, deleteMember, getMemberServiceEntitlements, getMemberBookQrText, generateAccountBook, ACCOUNT_BOOK_TIMEOUT_MS };
