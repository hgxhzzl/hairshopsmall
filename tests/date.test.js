/**
 * 日期工具的回归测试。
 *
 * 后端返回的时间是 "YYYY-MM-DD HH:mm:ss"（无时区标注），iOS 的 JSCore 对这种
 * 格式的 new Date() 支持不一致，所以小程序侧一律先正则解析、解析不了再兜底截断。
 * 这些兜底分支最容易被「顺手清理」掉，用测试钉住。
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMonthRange,
  getPresetRange,
  formatDateStr,
  formatDateYMD,
  getExpireStatus,
} = require('../manager/utils/date');

/** 相对今天偏移 offsetDays 天的 yyyy-mm-dd（与 getExpireStatus 同用本地零点） */
function toDateStr(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${M}-${D}`;
}

test('getMonthRange：起止落在本月首日零点与末日 23:59:59.999', () => {
  const { create_time_start, create_time_end } = getMonthRange();
  const start = new Date(create_time_start);
  const end = new Date(create_time_end);
  const now = new Date();

  assert.equal(start.getFullYear(), now.getFullYear());
  assert.equal(start.getMonth(), now.getMonth());
  assert.equal(start.getDate(), 1);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);

  assert.equal(end.getFullYear(), now.getFullYear());
  assert.equal(end.getMonth(), now.getMonth());
  assert.equal(end.getDate(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.ok(start.getTime() < end.getTime());
});

test('getPresetRange：today 从今天零点到 23:59:59', () => {
  const { start, end } = getPresetRange('today');
  const now = new Date();

  assert.equal(start.getDate(), now.getDate());
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
});

test('getPresetRange：month 从 1 号开始，end 不早于 start', () => {
  const { start, end } = getPresetRange('month');

  assert.equal(start.getDate(), 1);
  assert.equal(start.getHours(), 0);
  assert.ok(start.getTime() <= end.getTime());
});

test('formatDateYMD：兼容 - 与 / 两种分隔符，并补零', () => {
  assert.equal(formatDateYMD('2026-03-05 12:00:00'), '2026-03-05');
  assert.equal(formatDateYMD('2026/3/5'), '2026-03-05');
  assert.equal(formatDateYMD('2026-3-5T00:00:00.000Z'), '2026-03-05');
});

test('formatDateYMD：空值与占位符返回空串', () => {
  assert.equal(formatDateYMD(''), '');
  assert.equal(formatDateYMD(null), '');
  assert.equal(formatDateYMD(undefined), '');
  assert.equal(formatDateYMD('yyyy-mm-dd'), '');
  assert.equal(formatDateYMD('YYYY/MM/DD'), '');
});

test('formatDateYMD：无法解析时不抛异常，兜底截取前 10 位', () => {
  assert.equal(formatDateYMD('2026-03-05 12:00:00 extra'), '2026-03-05');
  assert.equal(formatDateYMD('abc'), 'abc');
});

test('formatDateStr：合法日期归一为 yyyy-MM-dd，非法值兜底截断', () => {
  assert.equal(formatDateStr('2026-03-05 12:00:00'), '2026-03-05');
  assert.equal(formatDateStr(''), '');
  assert.equal(formatDateStr('not-a-date-value'), 'not-a-date');
});

test('getExpireStatus：过去为 expired，未来 30 天内（含今天）为 soon', () => {
  assert.equal(getExpireStatus(toDateStr(-1)), 'expired');
  assert.equal(getExpireStatus(toDateStr(-100)), 'expired');
  assert.equal(getExpireStatus(toDateStr(0)), 'soon');
  assert.equal(getExpireStatus(toDateStr(30)), 'soon');
});

test('getExpireStatus：31 天及以上为 normal', () => {
  assert.equal(getExpireStatus(toDateStr(31)), 'normal');
  assert.equal(getExpireStatus(toDateStr(60)), 'normal');
});

test('getExpireStatus：空值与非法日期返回空串', () => {
  assert.equal(getExpireStatus(''), '');
  assert.equal(getExpireStatus(null), '');
  assert.equal(getExpireStatus(undefined), '');
  assert.equal(getExpireStatus('yyyy-mm-dd'), '');
});
