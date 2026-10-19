const app = getApp();
const { createRechargeOrder } = require('../../../services/recharge');
const { getMemberById } = require('../../../services/member');
const { getServices } = require('../../../services/service');

Page({
  data: {
    mode: 'stored',
    memberId: '',
    member: null,
    rechargeAmount: '',
    giftAmount: '',
    serviceItems: [],
    services: [],
    packageTotal: 0,
    errorMessage: '',
    isSubmitting: false,
    preSelectedMemberId: ''
  },

  onLoad(options) {
    const memberId = options.memberId || '';
    if (memberId) {
      this.setData({ preSelectedMemberId: memberId, memberId });
    }
  },

  onShow() {
    if (!app.checkLogin()) return;
    this.loadServices();
    if (this.data.memberId) {
      this.loadMember();
    }
  },

  async loadServices() {
    try {
      const session = app.globalData.session;
      const services = await getServices(session.token);
      const activeServices = services.filter(s => s.status === 0);
      this.setData({ services: activeServices });
    } catch { /* ignore */ }
  },

  async loadMember() {
    try {
      const session = app.globalData.session;
      const member = await getMemberById(session.token, this.data.memberId);
      this.setData({ member });
    } catch { /* ignore */ }
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      mode,
      rechargeAmount: mode === 'stored' ? '' : String(this.data.packageTotal),
      giftAmount: '',
      errorMessage: '',
      serviceItems: mode === 'package' ? (this.data.serviceItems.length > 0 ? this.data.serviceItems : []) : []
    });
  },

  onAmountInput(e) {
    let value = e.detail.value;
    if (/^0\d/.test(value)) value = value.replace(/^0+/, '');
    this.setData({ rechargeAmount: value, errorMessage: '' });
  },
  onGiftInput(e) {
    let value = e.detail.value;
    if (/^0\d/.test(value)) value = value.replace(/^0+/, '');
    this.setData({ giftAmount: value, errorMessage: '' });
  },

  /** 选择会员 */
  navToSelectMember() {
    wx.navigateTo({ url: '/pages/common/select-member/index' });
  },

  /** 从选会员页回调 */
  onMemberSelected(memberId, memberName) {
    this.setData({ memberId, memberName });
    this.loadMember();
  },

  /** 选择服务 */
  navToSelectService() {
    wx.navigateTo({ url: '/pages/common/select-service/index?mode=recharge' });
  },

  /** 选服务页回调 */
  onServiceSelected(serviceId, serviceName) {
    const service = this.getServiceById(serviceId);
    if (!service) return;
    if (this.data.serviceItems.some(item => item.serviceId === serviceId)) {
      wx.showToast({ title: '该服务已添加', icon: 'none' });
      return;
    }
    this.setData({
      serviceItems: [...this.data.serviceItems, {
        serviceId: service.id,
        name: service.name,
        normalPrice: service.normalPrice,
        memberPrice: service.memberPrice,
        quantity: '1'
      }]
    });
    this.computePackageTotal();
  },

  /** 移除服务项 */
  removeServiceItem(e) {
    const index = e.currentTarget.dataset.index;
    const serviceItems = [...this.data.serviceItems];
    serviceItems.splice(index, 1);
    this.setData({ serviceItems });
    this.computePackageTotal();
  },

  /** 修改数量 */
  changeQuantity(e) {
    const { index, delta } = e.currentTarget.dataset;
    const serviceItems = [...this.data.serviceItems];
    const item = serviceItems[index];
    const qty = Math.max(1, (Number(item.quantity) || 1) + Number(delta));
    serviceItems[index] = { ...item, quantity: String(qty) };
    this.setData({ serviceItems });
    this.computePackageTotal();
  },

  computePackageTotal() {
    const total = this.data.serviceItems.reduce(
      (s, i) => s + (i.memberPrice || 0) * (Number(i.quantity) || 1), 0
    );
    const update = { packageTotal: total };
    if (this.data.mode === 'package') update.rechargeAmount = String(total);
    this.setData(update);
  },

  getSelectedServiceCount() {
    return this.data.serviceItems.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
  },

  getServiceById(id) {
    return this.data.services.find(s => s.id === id) || null;
  },

  async handleSubmit() {
    const { mode, memberId, rechargeAmount, giftAmount, serviceItems } = this.data;

    if (!memberId) {
      this.setData({ errorMessage: '请选择会员' });
      return;
    }
    if (!rechargeAmount || isNaN(Number(rechargeAmount)) || Number(rechargeAmount) <= 0) {
      this.setData({ errorMessage: '请输入有效的充值金额' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, errorMessage: '' });
      const session = app.globalData.session;

      const payload = {
        member_id: Number(memberId),
        benefit_type: mode === 'stored' ? 1 : 0,
        recharge_amount: Number(rechargeAmount),
        gift_amount: mode === 'stored' ? (Number(giftAmount) || 0) : 0,
        items: mode === 'package'
          ? serviceItems.map(item => ({
              service_info_id: Number(item.serviceId),
              quantity: Number(item.quantity) || 1
            }))
          : []
      };

      await createRechargeOrder(session.token, payload);
      app.invalidateDashboardCache();
      var that = this;
      wx.showToast({ title: '充值成功', icon: 'success', duration: 1200 });
      setTimeout(function () {
        // 根据入口来源决定返回目标
        if (that.data.preSelectedMemberId) {
          // 从会员列表进入 → 返回会员管理页
          wx.switchTab({ url: '/pages/member/list/index' });
        } else {
          var pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack({ delta: 1 });
          } else {
            wx.switchTab({ url: '/pages/recharge/list/index' });
          }
        }
      }, 1500);
    } catch (err) {
      this.setData({ errorMessage: err.message || '充值失败，请稍后重试', isSubmitting: false });
    }
  }
});
