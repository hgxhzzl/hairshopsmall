const { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } = require('../../utils/constants');

Page({
  data: {
    supportPhone: SUPPORT_PHONE_DISPLAY
  },

  /** 密码重置需核实店主本人身份，由服务人员人工办理 */
  handleCallSupport() {
    wx.makePhoneCall({
      phoneNumber: SUPPORT_PHONE,
      fail: () => {}
    });
  },

  goLogin() {
    wx.navigateBack();
  }
});
