const { request } = require('./_request');

function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const v = Number(value); return Number.isFinite(v) ? v : 0; }
  return 0;
}

function normalizeDate(value) { return typeof value === 'string' ? value.trim() : ''; }
function isNotDeleted(v) { return v.is_deleted !== 1; }

function getDateRangePreset(preset) {
  const now = new Date();
  if (preset === 'today') {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    const e = new Date(now); e.setHours(23, 59, 59, 999);
    return { start: s.toISOString(), end: e.toISOString() };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
  };
}

function getRecentSevenDaysRange() {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
  return { start: start.toISOString(), end: end.toISOString() };
}

function pad(n) { return String(n).padStart(2, '0'); }
function formatDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function formatTrendLabel(d) { return `${pad(d.getMonth()+1)}.${pad(d.getDate())}`; }

function buildRevenueTrend(consumptions) {
  const map = {};
  const base = new Date();
  consumptions.forEach(item => {
    const date = normalizeDate(item.create_time);
    if (!date) return;
    const key = date.slice(0, 10);
    map[key] = (map[key] || 0) + normalizeNumber(item.total_amount || item.recharge_amount);
  });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() - (6 - i));
    const key = formatDateKey(d);
    return { key, label: formatTrendLabel(d), amount: map[key] || 0 };
  });
}

async function fetchAllPages(pathname, token, query) {
  const first = await request(pathname, { token, query: { ...query, page: 1, pageSize: 100 } });
  const totalPages = Math.max((first.pagination && first.pagination.totalPages) || 1, 1);
  const rows = [...(first.data || [])];
  for (let p = 2; p <= totalPages; p++) {
    const next = await request(pathname, { token, query: { ...query, page: p, pageSize: (first.pagination && first.pagination.pageSize) || 100 } });
    rows.push(...(next.data || []));
  }
  return rows;
}

function isSameMonth(dateText) {
  if (!dateText) return false;
  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** 获取仪表盘快照 */
async function getDashboardSnapshot(token) {
  const todayRange = getDateRangePreset('today');
  const monthRange = getDateRangePreset('month');
  const recentRange = getRecentSevenDaysRange();

  const [members, todayConsumptions, monthConsumptions, recentConsumptions, todayRecharges, monthRecharges] = await Promise.all([
    fetchAllPages('/members', token, {}),
    fetchAllPages('/consumption-orders', token, { create_time_start: todayRange.start, create_time_end: todayRange.end }),
    fetchAllPages('/consumption-orders', token, { create_time_start: monthRange.start, create_time_end: monthRange.end }),
    fetchAllPages('/consumption-orders', token, { create_time_start: recentRange.start, create_time_end: recentRange.end }),
    fetchAllPages('/recharge-orders', token, { create_time_start: todayRange.start, create_time_end: todayRange.end }),
    fetchAllPages('/recharge-orders', token, { create_time_start: monthRange.start, create_time_end: monthRange.end })
  ]);

  const activeMembers = members.filter(isNotDeleted);
  const todayCons = todayConsumptions.filter(isNotDeleted);
  const monthCons = monthConsumptions.filter(isNotDeleted);
  const todayRec = todayRecharges.filter(isNotDeleted);
  const monthRec = monthRecharges.filter(isNotDeleted);

  const todayRevenue = todayCons.reduce((s, i) => s + normalizeNumber(i.total_amount), 0);
  const todayRecharge = todayRec.reduce((s, i) => s + normalizeNumber(i.recharge_amount), 0);
  const monthRevenue = monthCons.reduce((s, i) => s + normalizeNumber(i.total_amount), 0);
  const monthRecharge = monthRec.reduce((s, i) => s + normalizeNumber(i.recharge_amount), 0);

  // 今日细分指标
  const todayAccountConsumption = todayCons.filter(i => normalizeNumber(i.pay_type) === 1).reduce((s, i) => s + normalizeNumber(i.total_amount), 0);
  const todayServiceConsumption = todayCons.filter(i => normalizeNumber(i.pay_type) === 2).reduce((s, i) => s + normalizeNumber(i.total_amount), 0);
  const todayStorageRecharge = todayRec.filter(i => normalizeNumber(i.benefit_type) === 1).reduce((s, i) => s + normalizeNumber(i.recharge_amount), 0);
  const todayPackageRecharge = todayRec.filter(i => normalizeNumber(i.benefit_type) === 0).reduce((s, i) => s + normalizeNumber(i.recharge_amount), 0);

  // 本月细分指标
  const monthAccountConsumption = monthCons.filter(i => normalizeNumber(i.pay_type) === 1).reduce((s, i) => s + normalizeNumber(i.total_amount), 0);
  const monthServiceConsumption = monthCons.filter(i => normalizeNumber(i.pay_type) === 2).reduce((s, i) => s + normalizeNumber(i.total_amount), 0);
  const monthStorageRecharge = monthRec.filter(i => normalizeNumber(i.benefit_type) === 1).reduce((s, i) => s + normalizeNumber(i.recharge_amount), 0);
  const monthPackageRecharge = monthRec.filter(i => normalizeNumber(i.benefit_type) === 0).reduce((s, i) => s + normalizeNumber(i.recharge_amount), 0);

  const todayCustomerCount = new Set(todayCons.map(i => String(i.member_id || ''))).size;
  const monthActiveMembers = new Set([...monthCons.map(i => String(i.member_id || '')), ...monthRec.map(i => String(i.member_id || ''))]).size;
  const monthNewMembers = activeMembers.filter(i => isSameMonth(normalizeDate(i.register_time || i.registerDate))).length;

  return {
    todayRevenue, todayRecharge, todayCustomerCount,
    todayConsumptionCount: todayCons.length,
    todayRechargeCount: todayRec.length,
    todayAverageTicket: todayCustomerCount > 0 ? todayRevenue / todayCustomerCount : 0,
    todayAccountConsumption, todayServiceConsumption,
    todayStorageRecharge, todayPackageRecharge,
    monthRevenue, monthRecharge, monthNewMembers, monthActiveMembers,
    monthAccountConsumption, monthServiceConsumption,
    monthStorageRecharge, monthPackageRecharge,
    monthConsumptionCount: monthCons.length,
    monthRechargeCount: monthRec.length,
    totalMembers: activeMembers.length,
    revenueTrend: buildRevenueTrend(recentConsumptions.filter(isNotDeleted))
  };
}

module.exports = { getDashboardSnapshot };
