const app = getApp();
const { updateShopInfo } = require('../../../services/shop');

const SHOP_NAME_MAX = 10;
const ADDRESS_MAX = 40;
const OWNER_NAME_MAX = 10;

Page({
  data: {
    shopName: '',
    ownerName: '',
    address: '',
    canSubmit: false,
    actionError: '',
    isSubmitting: false
  },

  onShow() {
    if (!app.checkLogin()) return;
    const session = app.globalData.session;
    const shop = session.shop || {};
    this.setData({
      shopName: (shop.shopName || '').slice(0, SHOP_NAME_MAX),
      ownerName: (shop.ownerName || '').slice(0, OWNER_NAME_MAX),
      address: (shop.address || '').slice(0, ADDRESS_MAX),
      actionError: ''
    });
    this.updateCanSubmit();
  },

  updateCanSubmit() {
    // 仅店铺名称为必填；店主姓名与地址均为可选，留空也可以保存。
    const { shopName } = this.data;
    this.setData({ canSubmit: !!shopName.trim() });
  },

  onShopNameInput(e) {
    const v = e.detail.value.slice(0, SHOP_NAME_MAX);
    this.setData({ shopName: v, actionError: '' });
    this.updateCanSubmit();
  },

  onOwnerNameInput(e) {
    const v = e.detail.value.slice(0, OWNER_NAME_MAX);
    this.setData({ ownerName: v, actionError: '' });
    this.updateCanSubmit();
  },

  onAddressInput(e) {
    const v = e.detail.value.slice(0, ADDRESS_MAX);
    this.setData({ address: v, actionError: '' });
  },

  async handleSubmit() {
    const { shopName, ownerName, address } = this.data;

    // 基本校验
    if (!shopName.trim()) {
      this.setData({ actionError: '请填写店铺名称' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, actionError: '' });
      const session = app.globalData.session;
      // 姓名/地址留空时不下发空串：后端 optionalTrimmedString 会把空串转成 undefined（等于不改），
      // 所以这里同样只在有值时带上键，保持“填了就写、没填就不动”的语义。
      const ownerNameTrimmed = ownerName.trim();
      const addressTrimmed = address.trim();
      const updatedShop = await updateShopInfo(session.token, {
        shop_name: shopName.trim(),
        ...(ownerNameTrimmed ? { owner_name: ownerNameTrimmed } : {}),
        ...(addressTrimmed ? { address: addressTrimmed } : {})
      });

      // 更新本地 session 缓存
      const nextSession = { ...session, shop: updatedShop };
      app.setStoredSession(nextSession);
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      this.setData({ actionError: err.message || '修改店铺信息失败' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
