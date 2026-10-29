const app = getApp();
const { getConsumptionOrderDetail, updateConsumptionOrder } = require('../../../services/consumption');
const { getServices } = require('../../../services/service');
const { getMemberById, getMemberServiceEntitlements } = require('../../../services/member');

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
      const items = (detail.items || []).map(i => ({ key: String(i.serviceInfoId || i.id), serviceId: i.serviceInfoId || i.id, name: i.itemName || i.name || '', memberPrice: i.memberPrice || 0, normalPrice: i.normalPrice || 0, quantity: String(i.count || 1) }));
      this.setData({
        detail, payType: String(detail.payType || 0),
        payAmount: String(detail.payAmount || detail.amount || ''),
        remark: detail.remark || '', serviceItems: items,
        services: services.filter(s => s.status === 0)
      });
      this.computePackageTotal();

      if (detail.memberId) {
        try {
          const member = await getMemberById(app.globalData.session.token, detail.memberId);
          this.setData({ member });
        } catch { /* ignore */ }
      }

      // 服务套餐（payType=2）：与新增页一致，按「服务 + 会员价」分组（同价合并、异价分列）
      if (String(detail.payType || 0) === '2' && detail.memberId) {
        try {
          const entitlements = await getMemberServiceEntitlements(app.globalData.session.token, detail.memberId, this.data.id);
          const entById = {};
          (entitlements || []).forEach(e => { entById[String(e.id)] = e; });
          // 权益池：按 serviceInfoId + 会员价 归集（含可用与本单已占用）
          const pools = {};
          (entitlements || []).forEach(e => {
            const mp = Number(e.memberPrice) || 0;
            const gkey = e.serviceInfoId + '|' + mp;
            if (!pools[gkey]) {
              pools[gkey] = { key: gkey, serviceId: e.serviceInfoId, name: e.itemName, memberPrice: mp, normalPrice: Number(e.normalPrice) || 0, entitlementIds: [], entitlementCount: 0 };
            }
            pools[gkey].entitlementIds.push(e.id);
            pools[gkey].entitlementCount++;
          });
          // 本单各池已用次数
          const usedCount = {};
          (detail.items || []).forEach(it => {
            const ids = (it.memberServiceEntitlementIds && it.memberServiceEntitlementIds.length)
              ? it.memberServiceEntitlementIds
              : (it.memberServiceEntitlementId ? [it.memberServiceEntitlementId] : []);
            let matched = false;
            ids.forEach(id => {
              const e = entById[String(id)];
              if (e) {
                const gkey = e.serviceInfoId + '|' + (Number(e.memberPrice) || 0);
                usedCount[gkey] = (usedCount[gkey] || 0) + 1;
                matched = true;
              }
            });
            if (!matched) {
              const mp = Number(it.price || it.memberPrice) || 0;
              const gkey = (it.serviceInfoId || '') + '|' + mp;
              const cnt = Number(it.count) || 1;
              usedCount[gkey] = (usedCount[gkey] || 0) + cnt;
              if (!pools[gkey]) {
                pools[gkey] = { key: gkey, serviceId: it.serviceInfoId, name: it.itemName || it.name || '', memberPrice: mp, normalPrice: Number(it.normalPrice) || 0, entitlementIds: [], entitlementCount: cnt };
              }
            }
          });
          const groupedItems = Object.keys(usedCount).map(gkey => {
            const p = pools[gkey];
            return { key: gkey, serviceId: p.serviceId, name: p.name, memberPrice: p.memberPrice, normalPrice: p.normalPrice, entitlementIds: p.entitlementIds, entitlementCount: p.entitlementCount, quantity: String(Math.max(1, usedCount[gkey])) };
          });
          this.setData({ serviceItems: groupedItems });
          this.computePackageTotal();
        } catch { /* 拉取权益失败则维持按明细逐条映射 */ }
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
        key: 'svc-' + service.id,
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
    const item = arr[index];
    const maxQty = this.data.payType === '2' ? (item.entitlementCount || 1) : 999;
    const qty = Math.max(1, Math.min(maxQty, (Number(item.quantity) || 1) + Number(delta)));
    arr[index] = { ...item, quantity: String(qty) };
    this.setData({ serviceItems: arr });
    this.computePackageTotal();
  },
  async handleSubmit() {
    const { payAmount, remark, serviceItems, id, payType, detail } = this.data;
    if (!detail || !detail.memberId) {
      this.setData({ error: '未获取到会员信息，请返回重试' }); return;
    }
    if (payType === '2' && serviceItems.length === 0) {
      this.setData({ error: '请添加服务项目' }); return;
    }
    if (payType !== '2' && (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0)) {
      this.setData({ error: '请输入有效的消费金额' }); return;
    }
    try {
      this.setData({ isSubmitting: true, error: '' });
      const payload = {
        member_id: Number(detail.memberId),
        pay_type: Number(payType),
        remark: remark.trim() || undefined
      };
      if (payType !== '2') {
        payload.pay_amount = Number(payAmount);
        payload.amount = Number(payAmount);
      }
      if (serviceItems.length > 0) {
        if (payType === '2') {
          // 服务套餐：每条权益核销一次，quantity 恒为 1，与新增消费一致
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
          payload.items = serviceItems.map(i => ({ service_info_id: i.serviceId, quantity: Number(i.quantity) || 1 }));
        }
      }
      await updateConsumptionOrder(app.globalData.session.token, id, payload);
      app.invalidateDashboardCache();
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) { this.setData({ error: err.message || '修改失败' }); }
    finally { this.setData({ isSubmitting: false }); }
  }
});
