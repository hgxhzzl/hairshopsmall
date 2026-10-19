const app = getApp();
const { getRechargeOrderDetail, updateRechargeOrder } = require('../../../services/recharge');
const { getServices } = require('../../../services/service');
const { getMemberById } = require('../../../services/member');

Page({
  data: {
    rechargeId: '',
    mode: 'stored',
    memberId: '',
    rechargeAmount: '',
    giftAmount: '',
    serviceItems: [],
    services: [],
    member: null,
    detail: null,
    packageTotal: 0,
    errorMessage: '',
    isLoading: true,
    isSubmitting: false
  },

  onLoad(options) {
    this.setData({ rechargeId: options.id || '' });
  },

  onShow() {
    if (!app.checkLogin()) return;
    if (this.data.rechargeId && this.data.isLoading) {
      this.loadData();
    }
  },

  async loadData() {
    try {
      this.setData({ isLoading: true, errorMessage: '' });
      const session = app.globalData.session;

      const [detail, services] = await Promise.all([
        getRechargeOrderDetail(session.token, this.data.rechargeId),
        getServices(session.token).catch(() => [])
      ]);

      const isStoredMode = detail.benefitType !== 0;
      const activeServices = services.filter(s => s.status === 0);
      const serviceItems = (detail.items || []).map(item => ({
        serviceId: item.serviceInfoId || item.id || '',
        name: item.itemName || item.name || '',
        memberPrice: item.memberPrice || 0,
        normalPrice: item.normalPrice || 0,
        quantity: String(item.count || 1)
      }));

      this.setData({
        detail,
        mode: isStoredMode ? 'stored' : 'package',
        memberId: detail.memberId || '',
        rechargeAmount: String(detail.amount || ''),
        giftAmount: String(detail.giftAmount || '0'),
        serviceItems,
        services: activeServices
      });
      this.computePackageTotal();

      // 加载完整会员信息
      if (detail.memberId) {
        try {
          const member = await getMemberById(session.token, detail.memberId);
          this.setData({ member });
        } catch { /* 会员信息加载失败不影响主流程 */ }
      }
    } catch (err) {
      this.setData({ errorMessage: err.message || '加载充值信息失败' });
    } finally {
      this.setData({ isLoading: false });
    }
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

  navToSelectService() {
    wx.navigateTo({ url: '/pages/common/select-service/index?mode=recharge' });
  },

  onServiceSelected(serviceId, serviceName) {
    const service = this.data.services.find(s => s.id === serviceId);
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

  computePackageTotal() {
    const total = this.data.serviceItems.reduce(
      (s, i) => s + (i.memberPrice || 0) * (Number(i.quantity) || 1), 0
    );
    const update = { packageTotal: total };
    if (this.data.mode === 'package') update.rechargeAmount = String(total);
    this.setData(update);
  },

  removeServiceItem(e) {
    const index = e.currentTarget.dataset.index;
    const serviceItems = [...this.data.serviceItems];
    serviceItems.splice(index, 1);
    this.setData({ serviceItems });
    this.computePackageTotal();
  },

  changeQuantity(e) {
    const { index, delta } = e.currentTarget.dataset;
    const serviceItems = [...this.data.serviceItems];
    const item = serviceItems[index];
    const qty = Math.max(1, (Number(item.quantity) || 1) + Number(delta));
    serviceItems[index] = { ...item, quantity: String(qty) };
    this.setData({ serviceItems });
    this.computePackageTotal();
  },

  async handleSubmit() {
    const { rechargeId, memberId, rechargeAmount, giftAmount, serviceItems, mode } = this.data;

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

      await updateRechargeOrder(session.token, rechargeId, payload);
      app.invalidateDashboardCache();
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      this.setData({ errorMessage: err.message || '修改充值失败' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
