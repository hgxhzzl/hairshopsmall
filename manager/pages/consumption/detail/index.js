const app = getApp();
const { getConsumptionOrderDetail } = require('../../../services/consumption');
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
  data: { detail: null, member: null, error: '', isLoading: false, id: '' },
  onLoad(opts) { this.setData({ id: opts.id || '' }); },
  onShow() { if (!app.checkLogin()) return; if (this.data.id) this.load(); },
  async load() {
    try {
      this.setData({ isLoading: true, error: '' });
      const detail = await getConsumptionOrderDetail(app.globalData.session.token, this.data.id);
      const services = (detail.items || []).map(i => ({ ...i, count: i.count || 1 }));
      const isServiceMode = detail.payType === 2;
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
  fm(v) { return '¥' + (v || 0).toFixed(2); },
  goBack() { wx.navigateBack(); }
});
