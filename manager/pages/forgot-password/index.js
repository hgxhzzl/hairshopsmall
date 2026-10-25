const { sendResetPasswordSmsCode, resetPasswordBySms } = require('../../services/auth');
const { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } = require('../../utils/constants');

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const CODE_REGEX = /^\d{6}$/;
const CODE_COOLDOWN_SECONDS = 60;

Page({
  data: {
    supportPhone: SUPPORT_PHONE_DISPLAY,
    phoneNumber: '',
    smsCode: '',
    newPassword: '',
    confirmPassword: '',
    smsCooldown: 0,
    isSubmitting: false,
    errorMessage: '',
    canSubmit: false
  },

  onUnload() {
    this._clearTimer();
  },

  onPhoneInput(e) {
    this.setData({ phoneNumber: e.detail.value, errorMessage: '' });
    this._updateCanSubmit();
  },

  onSmsCodeInput(e) {
    this.setData({ smsCode: e.detail.value, errorMessage: '' });
    this._updateCanSubmit();
  },

  onNewPasswordInput(e) {
    this.setData({ newPassword: e.detail.value, errorMessage: '' });
    this._updateCanSubmit();
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value, errorMessage: '' });
    this._updateCanSubmit();
  },

  _updateCanSubmit() {
    const { phoneNumber, smsCode, newPassword, confirmPassword } = this.data;
    this.setData({
      canSubmit: !!(
        PHONE_REGEX.test(phoneNumber.trim()) &&
        CODE_REGEX.test(smsCode.trim()) &&
        newPassword.trim().length >= 6 &&
        newPassword.trim() === confirmPassword.trim()
      )
    });
  },

  _clearTimer() {
    if (this._smsTimer) {
      clearInterval(this._smsTimer);
      this._smsTimer = null;
    }
  },

  _startCooldown() {
    this.setData({ smsCooldown: CODE_COOLDOWN_SECONDS });
    this._smsTimer = setInterval(() => {
      const next = this.data.smsCooldown - 1;
      if (next <= 0) {
        this._clearTimer();
        this.setData({ smsCooldown: 0 });
        return;
      }
      this.setData({ smsCooldown: next });
    }, 1000);
  },

  /** 发送重置密码短信验证码 */
  async handleSendSmsCode() {
    if (this.data.smsCooldown > 0) return;

    const phone = this.data.phoneNumber.trim();
    if (!PHONE_REGEX.test(phone)) {
      this.setData({ errorMessage: '请先输入正确的 11 位手机号' });
      return;
    }

    try {
      this.setData({ errorMessage: '' });
      await sendResetPasswordSmsCode(phone);
      wx.showToast({ title: '验证码已发送', icon: 'none' });
      this._startCooldown();
    } catch (error) {
      this.setData({ errorMessage: error.message || '验证码发送失败' });
    }
  },

  /** 提交短信重置密码 */
  async handleSubmit() {
    const { phoneNumber, smsCode, newPassword, confirmPassword } = this.data;

    if (!PHONE_REGEX.test(phoneNumber.trim())) {
      this.setData({ errorMessage: '请输入有效的手机号码' });
      return;
    }
    if (!CODE_REGEX.test(smsCode.trim())) {
      this.setData({ errorMessage: '请输入 6 位验证码' });
      return;
    }
    if (newPassword.trim().length < 6) {
      this.setData({ errorMessage: '新密码长度不能少于 6 位' });
      return;
    }
    if (newPassword !== confirmPassword) {
      this.setData({ errorMessage: '两次输入的密码不一致' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, errorMessage: '' });
      await resetPasswordBySms({
        phone_number: phoneNumber,
        sms_code: smsCode,
        new_password: newPassword
      });
      wx.showToast({ title: '密码重置成功', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1500);
    } catch (error) {
      this.setData({ errorMessage: error.message || '重置失败，请稍后重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  /** 拨打客服电话 */
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
