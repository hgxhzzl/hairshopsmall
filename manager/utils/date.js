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

module.exports = {
  getMonthRange,
  getPresetRange,
  formatDateStr,
  formatDateYMD
};
