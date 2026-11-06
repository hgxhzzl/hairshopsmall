const { request } = require('./_request');
const { normalizeShop } = require('../utils/normalize');

/** 获取店铺信息 */
async function getCurrentShopInfo(token) {
  const res = await request('/shops/info', { token });
  if (!res.data || typeof res.data !== 'object') throw new Error('店铺信息读取失败');
  return normalizeShop(res.data);
}

// 「打开首页/我的页时刷新到期日」：不做时间节流，只靠同一在途请求去重，
// 避免并发重入时重复打 /shops/info；店主切页（onShow）即实时核对后端最新到期日。
let expireRefreshPromise = null;

/**
 * 从服务端拉取最新到期日并回写本地会话缓存，供「打开首页/我的页」时无需重登即可刷新到期状态。
 * 不做时间节流（保证“打开即刷新”），仅用同一在途请求去重防并发；
 * 网络异常静默兜底，页面沿用缓存到期日、不打扰店主。
 * @param {string} token
 * @returns {Promise<string|null>} 最新 expire_time（原始时间串）；失败时返回 null
 */
function refreshExpireTime(token) {
  if (expireRefreshPromise) return expireRefreshPromise;
  expireRefreshPromise = (async () => {
    try {
      const shop = await getCurrentShopInfo(token);
      const expireTime = shop ? shop.expireTime : '';
      const app = getApp();
      if (expireTime && app && app.updateSessionExpireTime) {
        app.updateSessionExpireTime(expireTime);
      }
      return expireTime || null;
    } catch {
      return null;
    } finally {
      expireRefreshPromise = null;
    }
  })();
  return expireRefreshPromise;
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

/**
 * 换号双短信发码
 * @param {string} token
 * @param {{ purpose: 'shop_phone_old' | 'shop_phone_new', phone_number: string }} payload
 */
async function sendPhoneSmsCode(token, payload) {
  const res = await request('/shops/phone-code/send', { method: 'POST', token, data: payload });
  return (res && res.data) || null;
}

/**
 * 双短信验证换绑手机号（旧码+新码都通过才生效）；服务端以 token 定位店铺，无需传店铺 id
 * @param {{ new_phone_number: string, old_code: string, new_code: string, remark?: string }} payload
 */
async function changeShopPhoneBySms(token, payload) {
  const res = await request('/shops/phone/sms-change', { method: 'PUT', token, data: payload });
  if (!res.data || typeof res.data !== 'object') throw new Error('手机号修改失败');
  return normalizeShop(res.data);
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
  refreshExpireTime,
  updateShopInfo,
  changeShopPassword,
  sendPhoneSmsCode,
  changeShopPhoneBySms,
  CANCELLATION_REASONS,
  submitCancellationRequest,
  getCancellationRequest,
  withdrawCancellationRequest
};
