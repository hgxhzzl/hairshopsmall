const app = getApp();
const { createConsumptionOrder } = require('../../../services/consumption');
const { getMemberById, getMemberServiceEntitlements } = require('../../../services/member');
const { getServices } = require('../../../services/service');
const { getStoredConsumptionPayTypeSettings } = require('../../../services/consumptionPayTypeConfig');

Page({
  data: {
    payType: '0',
    showCash: true,
    showAccount: true,
    showService: true,
    memberId: '',
    member: null,
    entitlements: [],
    payAmount: '',
    remark: '',
    serviceItems: [],
    services: [],
    packageTotal: 0,
    totalUsageCount: 0,
    totalDiscount: 0,
    balanceExceeded: false,
    error: '',
    isSubmitting: false
  },
  onLoad(opts) {
    if (opts.memberId) this.setData({ memberId: opts.memberId });
  },
  onShow() {
    if (!app.checkLogin()) return;
    this.loadPayTypeSettings();
    this.loadServices();
    if (this.data.memberId) this.loadMember();
  },
  loadPayTypeSettings() {
    const settings = getStoredConsumptionPayTypeSettings();
    const showCash = settings.visibility['现金'];
    const showAccount = settings.visibility['账户'];
    const showService = settings.visibility['服务'];
    const nextPayType = this.resolveDefaultPayType(showCash, showAccount, showService);
    this.setData({ showCash, showAccount, showService, payType: nextPayType });
  },
  resolveDefaultPayType(showCash, showAccount, showService) {
    const currentPayType = this.data.payType;
    const visibleMap = { '0': showCash, '1': showAccount, '2': showService };
    if (visibleMap[currentPayType]) return currentPayType;
    if (showCash) return '0';
    if (showAccount) return '1';
    if (showService) return '2';
    return '0';
  },
  async loadServices() {
    try { const s = await getServices(app.globalData.session.token); this.setData({ services: s.filter(x => x.status === 0) }); } catch (err) { wx.showToast({ title: err.message || '服务项目加载失败', icon: 'none' }); }
  },
  async loadMember() {
    try {
      const m = await getMemberById(app.globalData.session.token, this.data.memberId);
      this.setData({ member: m });
      await this.loadEntitlements();
    } catch (err) { wx.showToast({ title: err.message || '会员信息加载失败', icon: 'none' }); }
  },
  async loadEntitlements() {
    try {
      const entitlements = await getMemberServiceEntitlements(app.globalData.session.token, this.data.memberId);
      this.setData({ entitlements });
      if (this.data.payType === '2' && this.data.serviceItems.length === 0) {
        this.populateFromEntitlements();
      }
    } catch (err) { this.setData({ error: err.message || '会员套餐权益加载失败' }); }
  },
  buildItemsFromEntitlements() {
    const grouped = {};
    (this.data.entitlements || []).forEach(e => {
      const sid = e.serviceInfoId;
      if (!grouped[sid]) {
        grouped[sid] = { name: e.itemName, memberPrice: e.memberPrice || 0, normalPrice: e.normalPrice || 0, count: 0, entitlementIds: [] };
      }
      grouped[sid].count++;
      grouped[sid].entitlementIds.push(e.id);
    });
    return Object.keys(grouped).map(serviceId => ({
      serviceId,
      name: grouped[serviceId].name,
      memberPrice: grouped[serviceId].memberPrice,
      normalPrice: grouped[serviceId].normalPrice,
      entitlementCount: grouped[serviceId].count,
      entitlementIds: grouped[serviceId].entitlementIds,
      quantity: '1'
    }));
  },
  populateFromEntitlements() {
    const items = this.buildItemsFromEntitlements();
    this.setData({ serviceItems: items });
    this.computePackageTotal();
  },
  switchPayType(e) {
    const type = e.currentTarget.dataset.type;
    const data = { payType: type, payAmount: '', packageTotal: 0, totalUsageCount: 0, totalDiscount: 0, balanceExceeded: false };
    if (type === '2' && (this.data.entitlements || []).length > 0) {
      data.serviceItems = this.buildItemsFromEntitlements();
    } else {
      data.serviceItems = [];
    }
    this.setData(data);
    if (type === '2' && (this.data.entitlements || []).length > 0) this.computePackageTotal();
  },
  navToSelectMember() { wx.navigateTo({ url: '/pages/common/select-member/index' }); },
  onMemberSelected(memberId, memberName) {
    this.setData({ memberId });
    this.loadMember();
  },
  navToSelectService() { wx.navigateTo({ url: '/pages/common/select-service/index' }); },
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
    const items = this.data.serviceItems;
    const total = items.reduce(
      (s, i) => s + (i.memberPrice || 0) * (Number(i.quantity) || 1), 0
    );
    const totalUsageCount = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    const update = { packageTotal: total, totalUsageCount };
    if (this.data.payType === '2') {
      update.payAmount = String(total);
      update.totalDiscount = items.reduce(
        (s, i) => s + ((i.normalPrice || 0) - (i.memberPrice || 0)) * (Number(i.quantity) || 1), 0
      );
    } else if (this.data.payType === '1') {
      update.payAmount = String(total);
    }
    this.setData(update);
    if (this.data.payType === '1') this.checkBalanceLimit(total);
  },
  checkBalanceLimit(amount) {
    if (this.data.payType !== '1' || !this.data.member) {
      if (this.data.balanceExceeded) this.setData({ balanceExceeded: false });
      return;
    }
    const amt = amount !== undefined ? Number(amount) || 0 : Number(this.data.payAmount) || 0;
    const balance = this.data.member.balance || 0;
    this.setData({ balanceExceeded: amt > balance });
  },
  onAmountInput(e) {
    let value = e.detail.value;
    if (/^0\d/.test(value)) value = value.replace(/^0+/, '');
    this.setData({ payAmount: value, error: '' });
    this.checkBalanceLimit(value);
  },
  onRemarkInput(e) { this.setData({ remark: e.detail.value, error: '' }); },
  removeService(e) { const i = e.currentTarget.dataset.index; const arr = [...this.data.serviceItems]; arr.splice(i, 1); this.setData({ serviceItems: arr }); this.computePackageTotal(); },
  changeQty(e) {
    const { index, delta } = e.currentTarget.dataset;
    const arr = [...this.data.serviceItems];
    const item = arr[index];
    const maxQty = this.data.payType === '2' ? (item.entitlementCount || 1) : 999;
    const qty = Math.max(1, Math.min(maxQty, (Number(item.quantity) || 1) + Number(delta)));
    arr[index] = { ...item, quantity: String(qty) };
    this.setData({ serviceItems: arr });
    this.computePackageTotal();
  },
  async handleSubmit() {
    const { payType, memberId, payAmount, remark, serviceItems } = this.data;
    if (!memberId) { this.setData({ error: '请选择会员' }); return; }
    if (payType === '2' && serviceItems.length === 0) {
      this.setData({ error: '请添加服务项目' }); return;
    }
    if (payType !== '2' && (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0)) {
      this.setData({ error: '请输入有效的消费金额' }); return;
    }
    try {
      this.setData({ isSubmitting: true, error: '' });
      const payload = {
        member_id: Number(memberId),
        pay_type: Number(payType),
        remark: remark.trim() || undefined
      };
      if (payType !== '2') {
        payload.amount = Number(payAmount);
        payload.pay_amount = Number(payAmount);
      }
      if (serviceItems.length > 0) {
        if (payType === '2') {
          payload.items = serviceItems.flatMap(i => {
            const eids = (i.entitlementIds || []).slice(0, Number(i.quantity) || 1);
            return eids.map(eid => ({
              service_info_id: Number(i.serviceId),
              member_service_entitlement_id: Number(eid),
              quantity: 1
            }));
          });
          payload.pay_amount = serviceItems.reduce((s, i) => s + (i.memberPrice || 0) * (Number(i.quantity) || 1), 0);
        } else {
          payload.items = serviceItems.map(i => ({
            service_info_id: Number(i.serviceId),
            quantity: Number(i.quantity) || 1
          }));
        }
      }
      await createConsumptionOrder(app.globalData.session.token, payload);
      app.invalidateDashboardCache();
      var that = this;
      wx.showToast({ title: '消费成功', icon: 'success', duration: 1200 });
      setTimeout(function () {
        if (that.data.memberId) {
          wx.switchTab({ url: '/pages/member/list/index' });
        } else {
          var pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack({ delta: 1 });
          } else {
            wx.switchTab({ url: '/pages/consumption/list/index' });
          }
        }
      }, 1500);
    } catch (err) { this.setData({ error: err.message || '消费失败', isSubmitting: false }); }
  }
});
