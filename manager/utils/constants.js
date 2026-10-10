/**
 * 跨页面共享的固定配置。
 *
 * 客服电话原先在 forgot-password / me/index / me/phone / me/cancellation 四个页面
 * 各写了一份字面量，换号时极易漏改，统一收敛到这里。
 */

/** 运维服务人员联系电话（拨打时用这个不带空格的原始号码） */
const SUPPORT_PHONE = '13766891959';

/** 展示用号码（3-4-4 分段）；wx.makePhoneCall 不接受空格，只能用于界面文案 */
const SUPPORT_PHONE_DISPLAY = SUPPORT_PHONE.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3');

module.exports = {
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY
};
