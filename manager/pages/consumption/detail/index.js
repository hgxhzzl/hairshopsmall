const app = getApp();
const { getConsumptionOrderDetail } = require('../../../services/consumption');
const { getMemberById, getMemberServiceEntitlements } = require('../../../services/member');
const { formatDateStr } = require('../../../utils/date');

Page({
  data: { detail: null, member: null, error: '', isLoading: false, id: '' },
  onLoad(opts) { this.setData({ id: opts.id || '' }); },
  onShow() { if (!app.checkLogin()) return; if (this.data.id) this.load(); },
  async load() {
    try {
      this.setData({ isLoading: true, error: '' });
      const detail = await getConsumptionOrderDetail(app.globalData.session.token, this.data.id);
      const rawItems = (detail.items || []).map(i => ({ ...i, count: i.count || 1 }));
      const isServiceMode = detail.payType === 2;
      // 与新增消费页一致：服务套餐按「服务 + 实际单价」分组，同价合并并累加次数，异价分列
      let services = rawItems;
      if (isServiceMode) {
        // 拉取本单权益（含已占用），用权益下单时的原始正常价覆盖服务主表当前正常价
        const entMap = {};
        if (detail.memberId) {
          try {
            const ents = await getMemberServiceEntitlements(app.globalData.session.token, detail.memberId, this.data.id);
            (ents || []).forEach(e => { entMap[String(e.id)] = e; });
          } catch { /* 取不到则正常价回退服务主表值 */ }
        }
        const grouped = {};
        rawItems.forEach(i => {
          const unitPrice = Number(i.price) || 0;
          const gkey = (i.serviceInfoId || i.name || '') + '|' + unitPrice;
          if (!grouped[gkey]) {
            const entIds = (i.memberServiceEntitlementIds && i.memberServiceEntitlementIds.length)
              ? i.memberServiceEntitlementIds
              : (i.memberServiceEntitlementId ? [i.memberServiceEntitlementId] : []);
            const ent = entIds.map(id => entMap[String(id)]).find(Boolean);
            const originalNormal = ent && Number(ent.normalPrice) ? Number(ent.normalPrice) : (Number(i.normalPrice) || 0);
            grouped[gkey] = { ...i, id: gkey, memberPrice: unitPrice, normalPrice: originalNormal, count: 0 };
          }
          grouped[gkey].count += (Number(i.count) || 1);
        });
        services = Object.keys(grouped).map(k => grouped[k]);
      }
      this.setData({ detail, services, isServiceMode, dateText: formatDateStr(detail.time) });

      if (detail.memberId) {
        try {
          const member = await getMemberById(app.globalData.session.token, detail.memberId);
          this.setData({ member });
        } catch { /* ignore */ }
      }
    } catch (err) { this.setData({ error: err.message || '加载失败' }); }
    finally { this.setData({ isLoading: false }); }
  },
  goBack() { wx.navigateBack(); }
});
