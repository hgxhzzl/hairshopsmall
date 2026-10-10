const app = getApp();
const { getConsumptionOrderDetail, updateConsumptionOrder } = require('../../../services/consumption');
const { getServices } = require('../../../services/service');
const { getMemberById } = require('../../../services/member');

Page({
  data: { id: '', detail: null, member: null, payType: '0', payAmount: '', remark: '', serviceItems: [], services: [], packageTotal: 0, error: '', isLoading: true, isSubmitting: false },
  onLoad(opts) { this.setData({ id: opts.id || '' }); },
  onShow() { if (!app.checkLogin()) return; if (this.data.id && this.data.isLoading) this.load(); },
  async load() {
    try {
      this.setData({ isLoading: true, error: '' });
      const [detail, services] = await Promise.all([
        getConsumptionOrderDetail(app.globalData.session.token, this.data.id),
        getServices(app.globalData.session.token).catch(() => [])
      ]);
      const items = (detail.items || []).map(i => ({ serviceId: i.serviceInfoId || i.id, name: i.itemName || i.name || '', memberPrice: i.memberPrice || 0, normalPrice: i.normalPrice || 0, quantity: String(i.count || 1) }));
      this.setData({
        detail, payType: String(detail.payType || 0),
        payAmount: String(detail.payAmount || detail.amount || ''),
        remark: detail.remark || '', serviceItems: items,
        services: services.filter(s => s.status !== 'inactive')
      });
      this.computePackageTotal();

      if (detail.memberId) {
        try {
          const member = await getMemberById(app.globalData.session.token, detail.memberId);
          this.setData({ member });
        } catch { /* ignore */ }
      }
    } catch (err) { this.setData({ error: err.message || '加载失败' }); }
    finally { this.setData({ isLoading: false }); }
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
    const total = this.data.serviceItems.reduce(
      (s, i) => s + (i.memberPrice || 0) * (Number(i.quantity) || 1), 0
    );
    const update = { packageTotal: total };
    if (this.data.payType === '1' || this.data.payType === '2') update.payAmount = String(total);
    this.setData(update);
  },
  onAmountInput(e) {
    let value = e.detail.value;
    if (/^0\d/.test(value)) value = value.replace(/^0+/, '');
    this.setData({ payAmount: value, error: '' });
  },
  onRemarkInput(e) { this.setData({ remark: e.detail.value, error: '' }); },
  removeService(e) { const i = e.currentTarget.dataset.index; const arr = [...this.data.serviceItems]; arr.splice(i, 1); this.setData({ serviceItems: arr }); this.computePackageTotal(); },
  changeQty(e) {
    const { index, delta } = e.currentTarget.dataset;
    const arr = [...this.data.serviceItems];
    const qty = Math.max(1, (Number(arr[index].quantity) || 1) + Number(delta));
    arr[index] = { ...arr[index], quantity: String(qty) };
    this.setData({ serviceItems: arr });
    this.computePackageTotal();
  },
  async handleSubmit() {
    const { payAmount, remark, serviceItems, id, payType } = this.data;
    if (payType === '2' && serviceItems.length === 0) {
      this.setData({ error: '请添加服务项目' }); return;
    }
    if (payType !== '2' && (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0)) {
      this.setData({ error: '请输入有效的消费金额' }); return;
    }
    try {
      this.setData({ isSubmitting: true, error: '' });
      const payload = { remark: remark.trim() || undefined };
      if (payType !== '2') {
        payload.pay_amount = Number(payAmount);
        payload.amount = Number(payAmount);
      }
      if (serviceItems.length > 0) {
        payload.items = serviceItems.map(i => ({ service_info_id: i.serviceId, quantity: Number(i.quantity) || 1 }));
        if (payType === '2') {
          payload.pay_amount = serviceItems.reduce((s, i) => s + (i.memberPrice || 0) * (Number(i.quantity) || 1), 0);
        }
      }
      await updateConsumptionOrder(app.globalData.session.token, id, payload);
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) { this.setData({ error: err.message || '修改失败' }); }
    finally { this.setData({ isSubmitting: false }); }
  }
});
