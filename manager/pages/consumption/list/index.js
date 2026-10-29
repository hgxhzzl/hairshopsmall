const { getConsumptionOrders, deleteConsumptionOrder } = require('../../../services/consumption');
const { createOrderListPage } = require('../../../utils/order-list-page');

const TYPE_FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 1, label: '账户' },
  { key: 2, label: '服务' },
  { key: 0, label: '现金' }
];

/**
 * 消费列表。
 *
 * 日期预设、服务端分页、下拉刷新、统计口径、删除确认全部由
 * utils/order-list-page 的工厂提供（与充值列表共用一份），
 * 这里只声明差异项：数据字段名、取数/删除接口、筛选项与合计字段。
 */
Page(createOrderListPage({
  rowsKey: 'consumptions',
  filteredKey: 'filteredConsumptions',
  errorKey: 'consumptionError',
  loadingKey: 'isLoading',
  filterStateKey: 'typeFilter',
  filterOptionsKey: 'typeFilters',
  filterOptions: TYPE_FILTERS,
  filterParam: 'pay_type',
  totalField: 'pay_amount_total',
  reloadHandlerName: 'loadConsumptions',
  loadMoreHandlerName: 'loadMoreConsumptions',
  filterHandlerName: 'setTypeFilter',
  deleteHandlerName: 'onDelete',
  loadPage: getConsumptionOrders,
  deleteOrder: deleteConsumptionOrder,
  errorText: '读取消费列表失败',
  loadMoreWarnText: '加载更多消费记录失败:',
  deleteConfirmText: '确定要删除这条消费记录吗？',
  deleteFallbackText: '删除失败',
  extraMethods: {
    onDetail(e) {
      wx.navigateTo({ url: '/pages/consumption/detail/index?id=' + e.currentTarget.dataset.id });
    },

    onEdit(e) {
      wx.navigateTo({ url: '/pages/consumption/edit/index?id=' + e.currentTarget.dataset.id });
    },

    navToAdd() {
      wx.navigateTo({ url: '/pages/consumption/add/index' });
    },

    navToPayTypeSettings() {
      wx.navigateTo({ url: '/pages/me/pay-type-settings/index' });
    }
  }
}));
