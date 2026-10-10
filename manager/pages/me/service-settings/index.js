const app = getApp();
const { getServices, deleteService } = require('../../../services/service');

Page({
  data: {
    services: [],
    serviceError: '',
    isServiceLoading: false,
    searchText: '',
    filteredServices: [],
    actionError: '',
    actionMessage: '',
    availableCount: 0,
    disabledCount: 0,
    isDeletingId: '',
    pendingDelete: null
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
      services.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'));
      this.setData({ services, isServiceLoading: false });
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
    const keyword = searchText.trim().toLowerCase();
    const filtered = (keyword ? services.filter(s => (s.name || '').toLowerCase().includes(keyword)) : [...services])
      .map(s => ({
        ...s,
        _normalPrice: (s.normalPrice || 0).toFixed(2),
        _memberPrice: (s.memberPrice || 0).toFixed(2),
        _savePrice: ((s.normalPrice || 0) - (s.memberPrice || 0)).toFixed(2)
      }));
    const availableCount = services.filter(s => s.status === 0).length;
    const disabledCount = services.length - availableCount;
    this.setData({ filteredServices: filtered, availableCount, disabledCount });
  },

  navToAddService() {
    wx.navigateTo({ url: '/pages/me/service-add/index' });
  },

  navToEditService(e) {
    const service = e.currentTarget.dataset.service;
    app.globalData._pendingEditService = service;
    wx.navigateTo({ url: '/pages/me/service-edit/index?serviceId=' + service.id });
  },

  showDeleteConfirm(e) {
    const service = e.currentTarget.dataset.service;
    this.setData({
      pendingDelete: {
        ...service,
        _normalPrice: (service.normalPrice || 0).toFixed(2),
        _memberPrice: (service.memberPrice || 0).toFixed(2)
      }
    });
  },

  hideDeleteConfirm() {
    this.setData({ pendingDelete: null });
  },

  async handleDeleteService() {
    const service = this.data.pendingDelete;
    if (!service) return;
    try {
      this.setData({ isDeletingId: service.id, actionError: '', actionMessage: '' });
      const session = app.globalData.session;
      await deleteService(session.token, service.id);
      const services = this.data.services.filter(s => s.id !== service.id);
      const availableCount = services.filter(s => s.status === 0).length;
      const disabledCount = services.length - availableCount;
      this.setData({ services, availableCount, disabledCount, pendingDelete: null, isDeletingId: '', actionMessage: '服务项目已删除' });
      this.applySearchFilter();
    } catch (err) {
      this.setData({ actionError: err.message || '删除失败', isDeletingId: '' });
    }
  }
});
