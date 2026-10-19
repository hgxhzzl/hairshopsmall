const app = getApp();
const { getServices } = require('../../../services/service');

Page({
  data: {
    services: [],
    serviceError: '',
    isServiceLoading: false,
    searchText: '',
    filteredServices: [],
    selectedServiceIds: []
  },

  onLoad(options) {
    const mode = options.mode || 'single';
    this._mode = mode;
  },

  onShow() {
    if (!app.checkLogin()) return;
    this.loadServices();
  },

  async loadServices() {
    try {
      this.setData({ isServiceLoading: true, serviceError: '' });
      const session = app.globalData.session;
      const services = await getServices(session.token);
      const activeServices = services.filter(s => s.status === 0);
      this.setData({ services: activeServices, isServiceLoading: false });
      this.applySearchFilter();
    } catch (err) {
      this.setData({ serviceError: err.message || '服务列表加载失败', isServiceLoading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value });
    this.applySearchFilter();
  },

  clearSearch() {
    this.setData({ searchText: '' });
    this.applySearchFilter();
  },

  applySearchFilter() {
    const { services, searchText } = this.data;
    const normalizedSearch = searchText.trim().toLowerCase();
    let filtered = services;

    if (normalizedSearch) {
      filtered = services.filter(s => (s.name || '').toLowerCase().includes(normalizedSearch));
    }

    this.setData({ filteredServices: filtered });
  },

  onSelectService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const serviceName = e.currentTarget.dataset.name || '';
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];

    if (prevPage && typeof prevPage.onServiceSelected === 'function') {
      prevPage.onServiceSelected(serviceId, serviceName);
    }
    wx.navigateBack();
  }
});
