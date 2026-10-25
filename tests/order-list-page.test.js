/**
 * 订单列表页工厂的回归测试。
 *
 * 充值列表 / 消费列表已合并到 manager/utils/order-list-page.js，
 * 这里用一个假的 page 对象（只实现 setData）驱动工厂产出的方法，
 * 把「查询参数、分页判断、统计口径」这三处最容易改坏的地方钉住。
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { createOrderListPage } = require('../manager/utils/order-list-page');

function createHarness({ rows = [], pagination = null, filterValue } = {}) {
  const calls = [];
  const loadPage = async (token, options) => {
    calls.push({ token, options });
    return { rows, pagination };
  };

  const page = createOrderListPage({
    rowsKey: 'recharges',
    filteredKey: 'filteredRecharges',
    errorKey: 'rechargeError',
    loadingKey: 'isRechargeLoading',
    filterStateKey: 'benefitFilter',
    filterOptionsKey: 'benefitFilters',
    filterOptions: [
      { key: 'ALL', label: '全部' },
      { key: 1, label: '储值赠送' },
    ],
    filterParam: 'benefit_type',
    totalField: 'recharge_amount_total',
    reloadHandlerName: 'loadRecharges',
    loadMoreHandlerName: 'loadMoreRecharges',
    filterHandlerName: 'setBenefitFilter',
    deleteHandlerName: 'onDeleteRecharge',
    loadPage,
    deleteOrder: async () => {},
    errorText: '读取充值列表失败',
    loadMoreWarnText: '加载更多充值记录失败:',
    deleteConfirmText: '确定要删除这条充值记录吗？',
    deleteFallbackText: '删除失败',
  });

  page.setData = function setData(patch, callback) {
    Object.assign(this.data, patch);
    if (typeof callback === 'function') callback.call(this);
  };

  global.getApp = () => ({
    globalData: { session: { token: 't' }, dashboardCache: null, dashboardDirty: false },
    checkLogin: () => true,
    invalidateDashboardCache() {},
  });

  if (filterValue !== undefined) {
    page.data.benefitFilter = filterValue;
  }

  return { page, calls };
}

test('工厂产出的 data 字段名与既有 wxml 对齐', () => {
  const { page } = createHarness();

  assert.deepEqual(page.data.recharges, []);
  assert.deepEqual(page.data.filteredRecharges, []);
  assert.deepEqual(page.data.benefitFilters.map((item) => item.key), ['ALL', 1]);
  assert.equal(page.data.benefitFilter, 'ALL');
  assert.equal(page.data.datePreset, 'month');
  assert.equal(page.data.pageSize, 20);
  assert.equal(typeof page.loadRecharges, 'function');
  assert.equal(typeof page.loadMoreRecharges, 'function');
  assert.equal(typeof page.setBenefitFilter, 'function');
  assert.equal(typeof page.onDeleteRecharge, 'function');
});

test('首屏加载：带上日期区间与分页，不筛选时不传类型参数', async () => {
  const { page, calls } = createHarness({
    rows: [{ id: '1', time: '2026-03-05 10:00:00', amount: 100 }],
    pagination: { total: 1, totalPages: 1, recharge_amount_total: 100 },
  });

  await page.loadRecharges.call(page);

  const { options } = calls[0];
  assert.equal(options.page, 1);
  assert.equal(options.pageSize, 20);
  assert.ok(options.create_time_start);
  assert.ok(options.create_time_end);
  assert.equal(options.benefit_type, undefined);
  assert.equal(page.data.hasMore, false);
  assert.equal(page.data.stats.totalCount, 1);
  assert.equal(page.data.stats.totalAmount, 100);
  assert.equal(page.data.filteredRecharges[0]._dateYMD, '2026-03-05');
});

test('筛选非 ALL 时把条件下推到服务端', async () => {
  const { page, calls } = createHarness({ pagination: { totalPages: 1 }, filterValue: 1 });

  await page.loadRecharges.call(page);

  assert.equal(calls[0].options.benefit_type, 1);
});

test('hasMore 用后端 totalPages 判断，统计优先用服务端合计', async () => {
  const rows = [{ id: '1', time: '2026-03-05 10:00:00', amount: 10 }];
  const { page } = createHarness({
    rows,
    pagination: { total: 45, totalPages: 3, recharge_amount_total: 880.5 },
  });

  await page.loadRecharges.call(page);

  assert.equal(page.data.hasMore, true);
  assert.equal(page.data.stats.totalCount, 45);
  assert.equal(page.data.stats.totalAmount, 880.5);
});

test('加载更多：页码递增并追加数据，到最后一页后 hasMore 变 false', async () => {
  const { page, calls } = createHarness({
    rows: [{ id: '2', time: '2026-03-06 10:00:00', amount: 5 }],
    pagination: { total: 21, totalPages: 2 },
  });

  page.data.recharges = [{ id: '1', time: '2026-03-05 10:00:00', amount: 10 }];
  page.data.page = 1;
  page.data.hasMore = true;

  await page.loadMoreRecharges.call(page);

  assert.equal(calls[0].options.page, 2);
  assert.equal(page.data.page, 2);
  assert.equal(page.data.recharges.length, 2);
  assert.equal(page.data.hasMore, false);
});

test('首屏 loading 与错误文案写回各自字段', async () => {
  const failingPage = createOrderListPage({
    rowsKey: 'consumptions',
    filteredKey: 'filteredConsumptions',
    errorKey: 'consumptionError',
    loadingKey: 'isLoading',
    filterStateKey: 'typeFilter',
    filterOptionsKey: 'typeFilters',
    filterOptions: [{ key: 'ALL', label: '全部' }],
    filterParam: 'pay_type',
    totalField: 'pay_amount_total',
    reloadHandlerName: 'loadConsumptions',
    loadMoreHandlerName: 'loadMoreConsumptions',
    filterHandlerName: 'setTypeFilter',
    deleteHandlerName: 'onDelete',
    loadPage: async () => {
      throw new Error('网络请求失败');
    },
    deleteOrder: async () => {},
    errorText: '读取消费列表失败',
    loadMoreWarnText: '加载更多消费记录失败:',
    deleteConfirmText: '确定要删除这条消费记录吗？',
    deleteFallbackText: '删除失败',
  });
  failingPage.setData = function setData(patch, callback) {
    Object.assign(this.data, patch);
    if (typeof callback === 'function') callback.call(this);
  };
  global.getApp = () => ({ globalData: { session: { token: 't' } }, checkLogin: () => true });

  await failingPage.loadConsumptions.call(failingPage);

  assert.equal(failingPage.data.consumptionError, '网络请求失败');
  assert.equal(failingPage.data.isLoading, false);
  assert.equal(failingPage.data.hasMore, true);
});
