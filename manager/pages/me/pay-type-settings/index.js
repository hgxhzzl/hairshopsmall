const app = getApp();
const { getStoredConsumptionPayTypeSettings, saveConsumptionPayTypeSettings } = require('../../../services/consumptionPayTypeConfig');

const PAY_TYPES = [
  { key: '现金', label: '现金', description: '散客到店或按原价直接结算场景' },
  { key: '账户', label: '账户', description: '会员使用账户余额进行扣费场景' },
  { key: '服务', label: '服务', description: '核销会员服务权益或套餐次数场景' }
];

const PRICE_OPTIONS = [
  { key: 'normal_price', label: '原价' },
  { key: 'member_price', label: '会员价' }
];

Page({
  data: {
    fieldVisibility: { '现金': true, '账户': true, '服务': true },
    usagePrice: { '现金': 'normal_price', '账户': 'member_price', '服务': 'member_price' },
    enabledCount: 3,
    isSaving: false,
    canSubmit: true,
    actionError: '',
    payTypes: PAY_TYPES,
    priceOptions: PRICE_OPTIONS
  },

  onShow() {
    if (!app.checkLogin()) return;
    const settings = getStoredConsumptionPayTypeSettings();
    const enabledCount = Object.values(settings.visibility).filter(Boolean).length;
    this.setData({
      fieldVisibility: { ...settings.visibility },
      usagePrice: { ...settings.usagePrice },
      enabledCount,
      canSubmit: enabledCount > 0
    });
  },

  onVisibilityChange(e) {
    const key = e.currentTarget.dataset.key;
    const visible = e.currentTarget.dataset.visible;
    const fieldVisibility = { ...this.data.fieldVisibility };
    fieldVisibility[key] = visible;
    const enabledCount = Object.values(fieldVisibility).filter(Boolean).length;
    this.setData({ fieldVisibility, enabledCount, canSubmit: enabledCount > 0 });
  },

  onPriceChange(e) {
    const { payType, priceKey } = e.currentTarget.dataset;
    const usagePrice = { ...this.data.usagePrice };
    usagePrice[payType] = priceKey;
    this.setData({ usagePrice });
  },

  async handleSave() {
    const { fieldVisibility, usagePrice } = this.data;
    const enabledCount = Object.values(fieldVisibility).filter(Boolean).length;
    if (enabledCount === 0) {
      this.setData({ actionError: '至少保留一个消费业务类型' });
      return;
    }

    try {
      this.setData({ isSaving: true, actionError: '' });
      const session = app.globalData.session;
      await saveConsumptionPayTypeSettings(session.token, {
        visibility: fieldVisibility,
        usagePrice
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      this.setData({ actionError: err.message || '保存失败' });
    } finally {
      this.setData({ isSaving: false });
    }
  }
});
