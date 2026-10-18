const app = getApp();
const { SUPPORT_PHONE } = require('../../../utils/constants');
const { sendPhoneSmsCode, changeShopPhoneBySms } = require('../../../services/shop');

const CODE_COOLDOWN_SECONDS = 60;
const PHONE_PATTERN = /^1\d{10}$/;

Page({
  data: {
    currentPhone: '',
    oldCode: '',
    newPhone: '',
    newCode: '',
    remark: '',
    oldCooldown: 0,
    newCooldown: 0,
    actionError: '',
    isSubmitting: false,
    canSubmit: false
  },

  onShow() {
    if (!app.checkLogin()) return;
    const session = app.globalData.session;
    this.setData({ currentPhone: (session.shop && session.shop.phoneNumber) || session.phone || '' });
  },

  onUnload() {
    this.clearCooldownTimers();
  },

  clearCooldownTimers() {
    if (this._oldTimer) {
      clearInterval(this._oldTimer);
      this._oldTimer = null;
    }
    if (this._newTimer) {
      clearInterval(this._newTimer);
      this._newTimer = null;
    }
  },

  startCooldown(key) {
    const dataKey = `${key}Cooldown`;
    this.setData({ [dataKey]: CODE_COOLDOWN_SECONDS });
    const timer = setInterval(() => {
      const next = this.data[dataKey] - 1;
      if (next <= 0) {
        clearInterval(timer);
        this[`_${key}Timer`] = null;
        this.setData({ [dataKey]: 0 });
        return;
      }
      this.setData({ [dataKey]: next });
    }, 1000);
    this[`_${key}Timer`] = timer;
  },

  updateCanSubmit() {
    const { oldCode, newPhone, newCode } = this.data;
    this.setData({
      canSubmit: /^\d{6}$/.test(oldCode.trim()) && PHONE_PATTERN.test(newPhone.trim()) && /^\d{6}$/.test(newCode.trim())
    });
  },

  onOldCodeInput(e) { this.setData({ oldCode: e.detail.value, actionError: '' }); this.updateCanSubmit(); },
  onNewPhoneInput(e) { this.setData({ newPhone: e.detail.value, actionError: '' }); this.updateCanSubmit(); },
  onNewCodeInput(e) { this.setData({ newCode: e.detail.value, actionError: '' }); this.updateCanSubmit(); },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },

  /** ① 向当前登记旧号发码（服务端只认数据库登记号，防止冒充旧号收码） */
  async handleSendOldCode() {
    const { currentPhone, oldCooldown } = this.data;
    if (oldCooldown > 0 || !currentPhone) return;

    try {
      this.setData({ actionError: '' });
      await sendPhoneSmsCode(app.globalData.session.token, { purpose: 'shop_phone_old', phone_number: currentPhone });
      wx.showToast({ title: '验证码已发送', icon: 'none' });
      this.startCooldown('old');
    } catch (err) {
      this.setData({ actionError: err.message || '验证码发送失败' });
    }
  },

  /** ② 向新手机号发码（发送前本地先校验格式，服务端还会查重） */
  async handleSendNewCode() {
    const { newPhone, newCooldown } = this.data;
    if (newCooldown > 0) return;

    if (!PHONE_PATTERN.test(newPhone.trim())) {
      this.setData({ actionError: '请先输入正确的 11 位新手机号' });
      return;
    }

    if (newPhone.trim() === this.data.currentPhone) {
      this.setData({ actionError: '新手机号不能与当前手机号相同' });
      return;
    }

    try {
      this.setData({ actionError: '' });
      await sendPhoneSmsCode(app.globalData.session.token, { purpose: 'shop_phone_new', phone_number: newPhone.trim() });
      wx.showToast({ title: '验证码已发送', icon: 'none' });
      this.startCooldown('new');
    } catch (err) {
      this.setData({ actionError: err.message || '验证码发送失败' });
    }
  },

  /** 提交换绑：旧码+新码都通过服务端才改库；token 不受换号影响，仅更新本地 session 手机号 */
  async handleSubmit() {
    const { currentPhone, oldCode, newPhone, newCode, remark } = this.data;

    if (!/^\d{6}$/.test(oldCode.trim())) {
      this.setData({ actionError: '请输入原手机号的 6 位验证码' });
      return;
    }
    if (!PHONE_PATTERN.test(newPhone.trim())) {
      this.setData({ actionError: '请输入正确的 11 位新手机号' });
      return;
    }
    if (!/^\d{6}$/.test(newCode.trim())) {
      this.setData({ actionError: '请输入新手机号的 6 位验证码' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, actionError: '' });
      const session = app.globalData.session;
      const updatedShop = await changeShopPhoneBySms(session.token, {
        new_phone_number: newPhone.trim(),
        old_code: oldCode.trim(),
        new_code: newCode.trim(),
        remark: remark.trim() || undefined
      });

      const nextSession = {
        ...session,
        phone: updatedShop.phoneNumber || newPhone.trim(),
        shop: { ...(session.shop || {}), ...updatedShop }
      };
      app.setStoredSession(nextSession);

      wx.showToast({ title: '手机号修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      this.setData({ actionError: err.message || '手机号修改失败' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  /** 人工核实兜底通道：原号失联等场景仍走服务人员办理 */
  handleCallSupport() {
    wx.makePhoneCall({
      phoneNumber: SUPPORT_PHONE,
      fail: () => {}
    });
  }
});
