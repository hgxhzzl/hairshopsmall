const app = getApp();
const { getRechargeOrderDetail } = require('../../../services/recharge');
const { getMemberById } = require('../../../services/member');

function formatDateStr(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d.getTime())) {
    var s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  var M = d.getMonth() + 1;
  var D = d.getDate();
  return d.getFullYear() + '-' + (M < 10 ? '0' + M : M) + '-' + (D < 10 ? '0' + D : D);
}

Page({
  data: {
    rechargeId: '',
    detail: null,
    detailError: '',
    isLoading: false,
    member: null,
    isStoredMode: true,
    arrivalAmount: 0,
    services: [],
    serviceCount: 0,
    packageTotal: 0,
    totalDiscount: 0
  },

  onLoad(options) {
    this.setData({ rechargeId: options.id || '' });
  },

  onShow() {
    if (!app.checkLogin()) return;
    if (this.data.rechargeId) this.loadDetail();
  },

  async loadDetail() {
    try {
      this.setData({ isLoading: true, detailError: '' });
      const session = app.globalData.session;
      const detail = await getRechargeOrderDetail(session.token, this.data.rechargeId);
      const isStoredMode = detail.benefitType !== 0;

      const services = (detail.items || []).map(item => ({
        ...item,
        count: item.count || 1
      }));
      const serviceCount = services.reduce((s, i) => s + i.count, 0);
      const hasPricing = services.some(s => s.memberPrice > 0 || s.normalPrice > 0);
      const packageTotal = hasPricing
        ? services.reduce((s, i) => s + (i.memberPrice || 0) * i.count, 0)
        : (detail.amount || 0);
      const totalDiscount = hasPricing
        ? services.reduce((s, i) => s + ((i.normalPrice || 0) - (i.memberPrice || 0)) * i.count, 0)
        : 0;
      const arrivalAmount = (detail.amount || 0) + (detail.giftAmount || 0);

      this.setData({
        detail, isStoredMode, services, serviceCount,
        packageTotal, totalDiscount, arrivalAmount,
        dateText: formatDateStr(detail.time)
      });

      // Try loading member info
      if (detail.memberId) {
        try {
          const member = await getMemberById(session.token, detail.memberId);
          this.setData({ member });
        } catch { /* ignore */ }
      }
    } catch (err) {
      this.setData({ detailError: err.message || '加载充值详情失败' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  formatMoney(v) { return '¥' + (v || 0).toFixed(2); },
  formatDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  goBack() { wx.navigateBack(); }
});
