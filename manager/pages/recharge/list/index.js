const app = getApp();
const { getRechargeOrders, deleteRechargeOrder } = require('../../../services/recharge');
const { getPresetRange: getDateRange, formatDateStr } = require('../../../utils/date');

const DATE_PRESETS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '三月' },
  { key: 'year', label: '今年' }
];

const BENEFIT_FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 1, label: '储值赠送' },
  { key: 0, label: '服务套餐' }
];

Page({
  data: {
    recharges: [],
    rechargeError: '',
    isRechargeLoading: false,
    isLoadingMore: false,
    isDeleting: false,
    datePreset: 'month',
    benefitFilter: 'ALL',
    datePresets: DATE_PRESETS,
    benefitFilters: BENEFIT_FILTERS,
    stats: { totalCount: 0, totalAmount: 0 },
    filteredRecharges: [],
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
    this.loadRecharges();
  },

  onPullDownRefresh() {
    this.loadRecharges().finally(() => wx.stopPullDownRefresh());
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
    // 服务端类型筛选：benefit_type = 1(储值赠送) / 0(服务套餐)
    if (this.data.benefitFilter !== 'ALL') {
      options.benefit_type = this.data.benefitFilter;
    }
    return options;
  },

  async loadRecharges() {
    try {
      this.setData({ isRechargeLoading: true, rechargeError: '', page: 1, hasMore: true });
      const session = app.globalData.session;
      var options = this.buildQuery(1);
      const result = await getRechargeOrders(session.token, options);
      var rows = result.rows;
      this.setData({
        recharges: rows,
        hasMore: rows.length >= this.data.pageSize,
        _serverTotal: (result.pagination && result.pagination.total) || null,
        _serverAmountTotal: (result.pagination && result.pagination.recharge_amount_total != null) ? result.pagination.recharge_amount_total : null
      }, function() { this.applyFilters(); }.bind(this));
    } catch (err) {
      this.setData({ rechargeError: err.message || '读取充值列表失败' });
    } finally {
      this.setData({ isRechargeLoading: false });
    }
  },

  /** 滚动到底部加载下一页 */
  async loadMoreRecharges() {
    if (!this.data.hasMore || this.data.isLoadingMore || this.data.isRechargeLoading) return;
    try {
      this.setData({ isLoadingMore: true });
      var nextPage = this.data.page + 1;
      var session = app.globalData.session;
      var result = await getRechargeOrders(session.token, this.buildQuery(nextPage));
      var newRows = result.rows;
      var all = this.data.recharges.concat(newRows);
      this.setData({
        recharges: all,
        page: nextPage,
        hasMore: newRows.length >= this.data.pageSize
      }, function() { this.applyFilters(); }.bind(this));
    } catch (err) {
      console.warn('加载更多充值记录失败:', err);
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  applyFilters() {
    const { recharges, datePreset, _serverTotal, _serverAmountTotal } = this.data;
    const { start, end } = getDateRange(datePreset);

    var formatRangeDate = function(d) {
      return String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    };
    var rangeText = formatRangeDate(start) + ' - ' + formatRangeDate(end);
    var datePresetLabel = DATE_PRESETS.find(function(p) { return p.key === datePreset; }).label;

    // 类型已由 API 服务端过滤（benefit_type 参数），此处仅排序+格式化
    var filtered = recharges.slice();
    filtered.sort(function(a, b) { return b.time.localeCompare(a.time); });

    // 预处理日期字段，避免 WXS 正则兼容性问题
    filtered.forEach(function(r) {
      r._dateYMD = formatDateStr(r.time);
    });

    // 统计：条数和金额优先使用服务端 pagination 返回值
    var stats = {
      totalCount: (typeof _serverTotal === 'number' && _serverTotal > 0) ? _serverTotal : filtered.length,
      totalAmount: (_serverAmountTotal != null) ? _serverAmountTotal : filtered.reduce(function(s, r) { return s + r.amount; }, 0)
    };

    this.setData({ filteredRecharges: filtered, stats: stats, rangeText: rangeText, datePresetLabel: datePresetLabel });
  },

  setDatePreset(e) {
    const preset = e.currentTarget.dataset.preset;
    const datePresetLabel = DATE_PRESETS.find(p => p.key === preset).label;
    // 切换日期预设时重新请求 API，获取新范围内的数据
    this.setData({ datePreset: preset, datePresetLabel }, function() { this.loadRecharges(); }.bind(this));
  },

  setBenefitFilter(e) {
    var filter = e.currentTarget.dataset.filter;
    // 切换类型筛选时重置分页，重新从服务端拉取（API 传 benefit_type 参数过滤）
    this.setData({ benefitFilter: filter }, function() { this.loadRecharges(); }.bind(this));
  },

  async onDeleteRecharge(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这条充值记录吗？删除后不可恢复。',
        success: resolve
      });
    });
    if (!res.confirm) return;

    try {
      this.setData({ isDeleting: true });
      const session = app.globalData.session;
      await deleteRechargeOrder(session.token, id);
      app.invalidateDashboardCache();
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadRecharges();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    } finally {
      this.setData({ isDeleting: false });
    }
  },

  onOpenDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/recharge/detail/index?id=' + id });
  },

  onOpenEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/recharge/edit/index?id=' + id });
  },

  navToAdd() {
    wx.navigateTo({ url: '/pages/recharge/add/index' });
  }
});
