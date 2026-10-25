/**
 * 订单列表页（充值 / 消费）的公共页面工厂。
 *
 * 这两个页面的 wxml、交互、分页、统计口径完全一致，唯一差别是：
 *   - 取数接口与删除接口不同；
 *   - 类型筛选项与查询参数名不同（benefit_type / pay_type）；
 *   - 服务端返回的合计字段不同（recharge_amount_total / pay_amount_total）；
 *   - 每页各自的数据字段名不同（recharges / consumptions）。
 * 之前是两份逐行复制的实现，改一个分页 bug 要改两处、还容易漏。
 *
 * 这里把「日期预设 + 服务端分页 + 下拉刷新 + 统计 + 删除确认」收敛成一份，
 * 页面文件只声明差异项。字段名保持与既有 wxml 一致，避免动模板。
 */

const { getPresetRange, formatDateStr } = require('./date');
const { resolveHasMore } = require('./pagination');

const DATE_PRESETS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '三月' },
  { key: 'year', label: '今年' }
];

function formatRangeDate(date) {
  return (
    String(date.getMonth() + 1).padStart(2, '0') +
    '.' +
    String(date.getDate()).padStart(2, '0')
  );
}

function findPresetLabel(preset) {
  const matched = DATE_PRESETS.find((item) => item.key === preset);
  return matched ? matched.label : '';
}

/**
 * @param {object} config
 * @param {string} config.rowsKey 原始行数据字段名（recharges / consumptions）
 * @param {string} config.filteredKey 渲染用字段名（filteredRecharges / filteredConsumptions）
 * @param {string} config.errorKey 错误文案字段名
 * @param {string} config.loadingKey 首屏 loading 字段名
 * @param {string} config.filterStateKey 当前选中筛选项的字段名
 * @param {string} config.filterOptionsKey 筛选项列表字段名
 * @param {Array} config.filterOptions 筛选项
 * @param {string} config.filterParam 该筛选对应的查询参数名
 * @param {string} config.totalField 服务端合计字段名
 * @param {string} config.reloadHandlerName 重新加载方法名（wxml 里可能直接绑定）
 * @param {string} config.loadMoreHandlerName 加载更多方法名
 * @param {string} config.filterHandlerName 切换筛选项方法名
 * @param {string} config.deleteHandlerName 删除方法名
 * @param {Function} config.loadPage (token, options) => { rows, pagination }
 * @param {Function} config.deleteOrder (token, id) => Promise
 * @param {string} config.errorText 列表读取失败文案
 * @param {string} config.loadMoreWarnText 加载更多失败的 console 前缀
 * @param {string} config.deleteConfirmText 删除确认弹窗正文
 * @param {string} config.deleteFallbackText 删除失败兜底文案
 * @param {object} [config.extraMethods] 页面独有方法
 */
function createOrderListPage(config) {
  const {
    rowsKey,
    filteredKey,
    errorKey,
    loadingKey,
    filterStateKey,
    filterOptionsKey,
    filterOptions,
    filterParam,
    totalField,
    reloadHandlerName,
    loadMoreHandlerName,
    filterHandlerName,
    deleteHandlerName,
    loadPage,
    deleteOrder,
    errorText,
    loadMoreWarnText,
    deleteConfirmText,
    deleteFallbackText,
    extraMethods = {}
  } = config;

  /** 构建 API 查询参数：日期区间 + 类型筛选 + 分页 */
  function buildQuery(page) {
    const range = getPresetRange(this.data.datePreset);
    const options = {
      create_time_start: range.start.toISOString(),
      create_time_end: range.end.toISOString(),
      page: page,
      pageSize: this.data.pageSize
    };

    const filterValue = this.data[filterStateKey];
    if (filterValue !== 'ALL') {
      options[filterParam] = filterValue;
    }

    return options;
  }

  /** 首屏 / 刷新：重置到第 1 页 */
  async function reload() {
    const app = getApp();

    try {
      this.setData({ [loadingKey]: true, [errorKey]: '', page: 1, hasMore: true });
      const session = app.globalData.session;
      const result = await loadPage(session.token, buildQuery.call(this, 1));
      const rows = (result && result.rows) || [];
      const pagination = (result && result.pagination) || null;

      this.setData(
        {
          [rowsKey]: rows,
          hasMore: resolveHasMore(pagination, 1, rows.length, this.data.pageSize),
          _serverTotal: (pagination && pagination.total) || null,
          _serverAmountTotal:
            pagination && pagination[totalField] != null ? pagination[totalField] : null
        },
        () => this.applyFilters()
      );
    } catch (err) {
      this.setData({ [errorKey]: (err && err.message) || errorText });
    } finally {
      this.setData({ [loadingKey]: false });
    }
  }

  /** 滚动到底部加载下一页 */
  async function loadMore() {
    if (!this.data.hasMore || this.data.isLoadingMore || this.data[loadingKey]) return;

    try {
      this.setData({ isLoadingMore: true });
      const nextPage = this.data.page + 1;
      const session = getApp().globalData.session;
      const result = await loadPage(session.token, buildQuery.call(this, nextPage));
      const newRows = (result && result.rows) || [];
      const all = this.data[rowsKey].concat(newRows);

      this.setData(
        {
          [rowsKey]: all,
          page: nextPage,
          hasMore: resolveHasMore(
            result && result.pagination,
            nextPage,
            newRows.length,
            this.data.pageSize
          )
        },
        () => this.applyFilters()
      );
    } catch (err) {
      // 加载更多失败不打断已有列表，只留痕
      console.warn(loadMoreWarnText, err);
    } finally {
      this.setData({ isLoadingMore: false });
    }
  }

  /** 渲染层过滤：排序 + 预格式化日期 + 统计（条数/金额优先用服务端合计） */
  function applyFilters() {
    const rows = this.data[rowsKey] || [];
    const serverTotal = this.data._serverTotal;
    const serverAmountTotal = this.data._serverAmountTotal;
    const { start, end } = getPresetRange(this.data.datePreset);

    const filtered = rows.slice();
    filtered.sort((a, b) => b.time.localeCompare(a.time));
    // 预处理日期字段，避免 WXS 正则兼容性问题
    filtered.forEach((row) => {
      row._dateYMD = formatDateStr(row.time);
    });

    const stats = {
      totalCount:
        typeof serverTotal === 'number' && serverTotal > 0 ? serverTotal : filtered.length,
      totalAmount:
        serverAmountTotal != null
          ? serverAmountTotal
          : filtered.reduce((sum, row) => sum + row.amount, 0)
    };

    this.setData({
      [filteredKey]: filtered,
      stats: stats,
      rangeText: formatRangeDate(start) + ' - ' + formatRangeDate(end),
      datePresetLabel: findPresetLabel(this.data.datePreset)
    });
  }

  /** 切换日期预设：范围内数据变了，必须重新请求服务端 */
  function setDatePreset(e) {
    const preset = e.currentTarget.dataset.preset;
    this.setData(
      { datePreset: preset, datePresetLabel: findPresetLabel(preset) },
      () => this[reloadHandlerName]()
    );
  }

  /** 切换类型筛选：筛选已下推到服务端，重置分页重新拉取 */
  function setFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ [filterStateKey]: filter }, () => this[reloadHandlerName]());
  }

  /** 删除单条记录（带确认弹窗） */
  async function removeRow(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise((resolve) => {
      wx.showModal({ title: '确认删除', content: deleteConfirmText, success: resolve });
    });

    if (!res || !res.confirm) return;

    try {
      this.setData({ isDeleting: true });
      const app = getApp();
      await deleteOrder(app.globalData.session.token, id);
      app.invalidateDashboardCache();
      wx.showToast({ title: '已删除', icon: 'success' });
      this[reloadHandlerName]();
    } catch (err) {
      wx.showToast({ title: (err && err.message) || deleteFallbackText, icon: 'none' });
    } finally {
      this.setData({ isDeleting: false });
    }
  }

  const page = {
    data: {
      [rowsKey]: [],
      [errorKey]: '',
      [loadingKey]: false,
      isLoadingMore: false,
      isDeleting: false,
      datePreset: 'month',
      [filterStateKey]: 'ALL',
      datePresets: DATE_PRESETS,
      [filterOptionsKey]: filterOptions,
      stats: { totalCount: 0, totalAmount: 0 },
      [filteredKey]: [],
      rangeText: '',
      datePresetLabel: '本月',
      page: 1,
      pageSize: 20,
      hasMore: true,
      _serverTotal: null,
      _serverAmountTotal: null
    },

    onShow() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().init();
      }
      if (!getApp().checkLogin()) return;
      this[reloadHandlerName]();
    },

    onPullDownRefresh() {
      this[reloadHandlerName]().finally(() => wx.stopPullDownRefresh());
    },

    buildQuery: buildQuery,
    applyFilters: applyFilters,
    setDatePreset: setDatePreset
  };

  page[reloadHandlerName] = reload;
  page[loadMoreHandlerName] = loadMore;
  page[filterHandlerName] = setFilter;
  page[deleteHandlerName] = removeRow;

  return Object.assign(page, extraMethods);
}

module.exports = {
  createOrderListPage,
  DATE_PRESETS,
  formatRangeDate
};
