/**
 * 年服务费「联系续费」弹层。
 *
 * 合规：小程序内只给文字提示 + 客服电话并走系统拨号，绝不展示收款二维码 / 价目；
 * 真正的商户收款码由服务人员在小程序外一对一发给店主（见续费流程约定）。
 * 文案与号码单点维护，「我的」页与首页到期横幅共用，避免多处漏改。
 */
const { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } = require('./constants');

function showRenewDialog() {
  wx.showModal({
    title: '续费咨询',
    content: `年服务费续费请拨打客服电话 ${SUPPORT_PHONE_DISPLAY}，由服务人员为您办理并更新到期日期。`,
    confirmText: '拨打电话',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        // 拨号用原始号码，展示号带空格（makePhoneCall 不接受空格）
        wx.makePhoneCall({ phoneNumber: SUPPORT_PHONE, fail: () => {} });
      }
    }
  });
}

module.exports = { showRenewDialog };
