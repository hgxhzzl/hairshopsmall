/**
 * 跨页面 / service 共享的日期工具。
 *
 * getMonthRange 原先在 recharge / consumption 两个 service 各写一份；
 * getPresetRange（今日/本周/本月/三月/今年的预设区间）与 formatDateStr
 * 在 recharge/list、consumption/list 两个列表页各写一份且完全相同，
 * 统一收敛到这里。
 */

/** 当月时间范围（ISO 字符串），用于列表默认查询参数 */
function getMonthRange() {
  const now = new Date();
  return {
    create_time_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    create_time_end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
  };
}

/** 预设日期范围：today / week / month / quarter / year，返回 { start, end } Date 对象 */
function getPresetRange(preset) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const start = new Date(end);
  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 2, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}

/** 归一化为 yyyy-MM-dd；非法日期兜底截取前 10 位 */
function formatDateStr(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d.getTime())) {
    var s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  var M = d.getMonth() + 1;
  var D = d.getDate();
  return d.getFullYear() + '-' + (M < 10 ? '0' + M : M) + '-' + (D < 10 ? '0' + D : D);
}

/**
 * 将后端返回的日期字符串统一格式化为 yyyy-mm-dd。
 * 兼容 yyyy-mm-dd / yyyy/mm/dd 前缀，过滤占位符（含 yyyy/YYYY），
 * 无法解析时兜底截取前 10 位；空值返回空串。
 * 收敛自 me/index 与 member/detail 两处各自实现的 formatDateYMD。
 */
function formatDateYMD(value) {
  if (!value) return '';
  var s = String(value).trim();
  if (s.indexOf('yyyy') >= 0 || s.indexOf('YYYY') >= 0) return '';
  var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    return m[1] + '-' + (m[2].length === 1 ? '0' + m[2] : m[2]) + '-' + (m[3].length === 1 ? '0' + m[3] : m[3]);
  }
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

/**
 * 店铺服务到期状态：'expired'（已到期）/ 'soon'（7 天内到期）/ 'normal'（正常）/ ''（无法判定）。
 * 阈值取 7 天而不是 30 天：试用只有 30 天，30 天阈值会让店主从注册那天起
 * 就挂着橙色“即将到期”，提醒成了常态噪音；7 天够打续费电话、走线下转账，又保住“临近”的含义。
 * 与后端 isShopServiceExpired 保持一致：到期当天仍算可用（diffDays === 0 走 soon）。
 * 入参兼容原始时间串与已格式化的 yyyy-mm-dd；me 页与首页横幅共用，避免各写一份天数计算。
 */
function getExpireStatus(expireTime) {
  // 天数算法只留 getExpireDaysLeft 一份，避免横幅上的天数与状态词各算一套、互相对不上
  var diffDays = getExpireDaysLeft(expireTime);
  if (diffDays === null) return '';
  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'soon';
  return 'normal';
}

/**
 * 距到期还剩几个自然日：到期当天为 0，已过期为负数，无法判定时返回 null。
 * 首页“即将到期”横幅要报具体天数（“还差 3 天”比“快到期了”更能推动打电话），
 * 与 getExpireStatus 共用同一套天数算法，避免两处算出不一样的结果。
 */
function getExpireDaysLeft(expireTime) {
  var formatted = formatDateYMD(expireTime);
  if (!formatted) return null;
  var expireDate = new Date(formatted + 'T00:00:00');
  if (isNaN(expireDate.getTime())) return null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((expireDate.getTime() - today.getTime()) / 86400000);
}

module.exports = {
  getMonthRange,
  getPresetRange,
  formatDateStr,
  formatDateYMD,
  getExpireStatus,
  getExpireDaysLeft
};
