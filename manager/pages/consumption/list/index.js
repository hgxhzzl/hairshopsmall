const app = getApp();
const { getConsumptionOrders, deleteConsumptionOrder } = require('../../../services/consumption');

const DATE_PRESETS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '三月' },
  { key: 'year', label: '今年' }
];

const TYPE_FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 0, label: '现金' },
  { key: 1, label: '账户' },
  { key: 2, label: '服务' }
];

function getDateRange(preset) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const start = new Date(end);
  switch (preset) {
    case 'today': start.setHours(0, 0, 0, 0); break;
    case 'week': { const day = start.getDay() || 7; start.setDate(start.getDate() - day + 1); start.setHours(0, 0, 0, 0); break; }
    case 'month': start.setDate(1); start.setHours(0, 0, 0, 0); break;
    case 'quarter': start.setMonth(start.getMonth() - 2, 1); start.setHours(0, 0, 0, 0); break;
    case 'year': start.setMonth(0, 1); start.setHours(0, 0, 0, 0); break;
  }
  return { start, end };
}

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

Page({
  data: {
    consumptions: [],
    consumptionError: '',
    isLoading: false,
    isLoadingMore: false,
    isDeleting: false,
    datePreset: 'month',
    typeFilter: 'ALL',
    datePresets: DATE_PRESETS,
    typeFilters: TYPE_FILTERS,
    stats: { totalCount: 0, totalAmount: 0, totalPayAmount: 0 },
    filteredConsumptions: [],
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
    if (!app.checkLogin()) return;
    this.loadConsumptions();
  },

  onPullDownRefresh() {
    this.loadConsumptions().finally(() => wx.stopPullDownRefresh());
  },

  /** 构建 API 查询参数（复用日期+类型筛选逻辑） */
  buildQuery(page) {
    var range = getDateRange(this.data.datePreset);
    var options = {
      create_time_start: range.start.toISOString(),
      create_time_end: range.end.toISOString(),
      page: page,
      pageSize: this.data.pageSize
    };
    // 服务端类型筛选：pay_type = 0(现金) / 1(账户) / 2(服务)
    if (this.data.typeFilter !== 'ALL') {
      options.pay_type = this.data.typeFilter;
    }
    return options;
  },

  async loadConsumptions() {
    try {
      this.setData({ isLoading: true, consumptionError: '', page: 1, hasMore: true });
      const session = app.globalData.session;
      var options = this.buildQuery(1);
      const result = await getConsumptionOrders(session.token, options);
      var rows = result.rows;
      this.setData({
        consumptions: rows,
        hasMore: rows.length >= this.data.pageSize,
        _serverTotal: (result.pagination && result.pagination.total) || null,
        _serverAmountTotal: (result.pagination && result.pagination.pay_amount_total != null) ? result.pagination.pay_amount_total : null
      }, function() { this.applyFilters(); }.bind(this));
    } catch (err) {
      this.setData({ consumptionError: err.message || '读取消费列表失败' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /** 滚动到底部加载下一页 */
  async loadMoreConsumptions() {
    if (!this.data.hasMore || this.data.isLoadingMore || this.data.isLoading) return;
    try {
      this.setData({ isLoadingMore: true });
      var nextPage = this.data.page + 1;
      var session = app.globalData.session;
      var result = await getConsumptionOrders(session.token, this.buildQuery(nextPage));
      var newRows = result.rows;
      var all = this.data.consumptions.concat(newRows);
      this.setData({
        consumptions: all,
        page: nextPage,
        hasMore: newRows.length >= this.data.pageSize
      }, function() { this.applyFilters(); }.bind(this));
    } catch (err) {
      console.warn('加载更多消费记录失败:', err);
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  applyFilters() {
    const { consumptions, datePreset, _serverTotal, _serverAmountTotal } = this.data;
    const { start, end } = getDateRange(datePreset);
    var formatRangeDate = function(d) { return String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); };
    var rangeText = formatRangeDate(start) + ' - ' + formatRangeDate(end);
    var datePresetLabel = DATE_PRESETS.find(function(p) { return p.key === datePreset; }).label;

    // 类型已由 API 服务端过滤（pay_type 参数），此处仅排序+格式化
    var filtered = consumptions.slice();
    filtered.sort(function(a, b) { return b.time.localeCompare(a.time); });

    // 预处理日期字段，避免 WXS 正则兼容性问题
    filtered.forEach(function(r) {
      r._dateYMD = formatDateStr(r.time);
    });

    // 统计：条数和金额优先使用服务端 pagination 返回值
    var stats = {
      totalCount: (typeof _serverTotal === 'number' && _serverTotal > 0) ? _serverTotal : filtered.length,
      totalAmount: (_serverAmountTotal != null) ? _serverAmountTotal : filtered.reduce(function(s, r) { return s + r.amount; }, 0),
      totalPayAmount: filtered.filter(function(r) { return r.payType !== 2; }).reduce(function(s, r) { return s + (r.payAmount || r.amount); }, 0)
    };
    this.setData({ filteredConsumptions: filtered, stats: stats, rangeText: rangeText, datePresetLabel: datePresetLabel });
  },

  setDatePreset(e) {
    var preset = e.currentTarget.dataset.preset;
    var label = DATE_PRESETS.find(function(p) { return p.key === preset; }).label;
    // 切换日期预设时重新请求 API，获取新范围内的数据
    this.setData({ datePreset: preset, datePresetLabel: label }, function() { this.loadConsumptions(); }.bind(this));
  },
  setTypeFilter(e) {
    var filter = e.currentTarget.dataset.filter;
    // 切换类型筛选时重置分页，重新从服务端拉取（API 传 pay_type 参数过滤）
    this.setData({ typeFilter: filter }, function() { this.loadConsumptions(); }.bind(this));
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '确定要删除这条消费记录吗？', success: r }));
    if (!res.confirm) return;
    try {
      this.setData({ isDeleting: true });
      await deleteConsumptionOrder(app.globalData.session.token, id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadConsumptions();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    } finally { this.setData({ isDeleting: false }); }
  },

  onDetail(e) { wx.navigateTo({ url: '/pages/consumption/detail/index?id=' + e.currentTarget.dataset.id }); },
  onEdit(e) { wx.navigateTo({ url: '/pages/consumption/edit/index?id=' + e.currentTarget.dataset.id }); },
  navToAdd() { wx.navigateTo({ url: '/pages/consumption/add/index' }); },

  navToPayTypeSettings() { wx.navigateTo({ url: '/pages/me/pay-type-settings/index' }); }
});
