const app = getApp();
const { getConsumptionOrderDetail } = require('../../../services/consumption');
const { getMemberById } = require('../../../services/member');
const { formatDateStr } = require('../../../utils/date');

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
  goBack() { wx.navigateBack(); }
});
