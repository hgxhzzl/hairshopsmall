const app = getApp();
const { SUPPORT_PHONE } = require('../../../utils/constants');

Page({
  data: {
    currentPhone: ''
  },

  onShow() {
    if (!app.checkLogin()) return;
    const session = app.globalData.session;
    this.setData({ currentPhone: (session.shop && session.shop.phoneNumber) || session.phone || '' });
  },

  /** 变更登录手机号需人工核实店主身份，引导联系服务人员 */
  handleCallSupport() {
    wx.makePhoneCall({
      phoneNumber: SUPPORT_PHONE,
      fail: () => {}
    });
  }
});
