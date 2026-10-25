const { getRechargeOrders, deleteRechargeOrder } = require('../../../services/recharge');
const { createOrderListPage } = require('../../../utils/order-list-page');

const BENEFIT_FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 1, label: '储值赠送' },
  { key: 0, label: '服务套餐' }
];

/**
 * 充值列表。
 *
 * 日期预设、服务端分页、下拉刷新、统计口径、删除确认全部由
 * utils/order-list-page 的工厂提供（与消费列表共用一份），
 * 这里只声明差异项：数据字段名、取数/删除接口、筛选项与合计字段。
 */
Page(createOrderListPage({
  rowsKey: 'recharges',
  filteredKey: 'filteredRecharges',
  errorKey: 'rechargeError',
  loadingKey: 'isRechargeLoading',
  filterStateKey: 'benefitFilter',
  filterOptionsKey: 'benefitFilters',
  filterOptions: BENEFIT_FILTERS,
  filterParam: 'benefit_type',
  totalField: 'recharge_amount_total',
  reloadHandlerName: 'loadRecharges',
  loadMoreHandlerName: 'loadMoreRecharges',
  filterHandlerName: 'setBenefitFilter',
  deleteHandlerName: 'onDeleteRecharge',
  loadPage: getRechargeOrders,
  deleteOrder: deleteRechargeOrder,
  errorText: '读取充值列表失败',
  loadMoreWarnText: '加载更多充值记录失败:',
  deleteConfirmText: '确定要删除这条充值记录吗？删除后不可恢复。',
  deleteFallbackText: '删除失败',
  extraMethods: {
    onOpenDetail(e) {
      wx.navigateTo({ url: '/pages/recharge/detail/index?id=' + e.currentTarget.dataset.id });
    },

    onOpenEdit(e) {
      wx.navigateTo({ url: '/pages/recharge/edit/index?id=' + e.currentTarget.dataset.id });
    },

    navToAdd() {
      wx.navigateTo({ url: '/pages/recharge/add/index' });
    }
  }
}));
