const { registerShop, loginShop, verifyWechatPhone, sendRegisterSmsCode } = require('../../services/auth');

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const CODE_REGEX = /^\d{6}$/;
const CODE_COOLDOWN_SECONDS = 60;

Page({
  data: {
    shopName: '',
    ownerName: '',
    address: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    isSubmitting: false,
    errorMessage: '',
    canSubmit: false,
    agreed: false,
    // 手机号验证：init=展示一键/其他号入口；wechat=一键已验证只读；manual=手动输入+短信码
    phoneInputMode: 'init',
    verifyTicket: '',
    smsCode: '',
    smsCooldown: 0,
    // phoneVerifiedBy: '' | 'wechat' | 'sms'，作为提交门禁与后端核销方式依据
    phoneVerifiedBy: ''
  },

  onUnload() {
    this.clearSmsTimer();
  },

  onShopNameInput(e) {
    this.setData({ shopName: e.detail.value, errorMessage: '' });
    this.updateCanSubmit();
  },

  onOwnerNameInput(e) {
    this.setData({ ownerName: e.detail.value, errorMessage: '' });
    this.updateCanSubmit();
  },

  onAddressInput(e) {
    this.setData({ address: e.detail.value, errorMessage: '' });
    this.updateCanSubmit();
  },

  // 手动改手机号会让原短信码作废（后端按号校验），故清码并重置验证态
  onPhoneInput(e) {
    this.setData({
      phoneNumber: e.detail.value,
      smsCode: '',
      phoneVerifiedBy: '',
      errorMessage: ''
    });
    this.updateCanSubmit();
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, errorMessage: '' });
    this.updateCanSubmit();
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value, errorMessage: '' });
    this.updateCanSubmit();
  },

  onSmsCodeInput(e) {
    const value = e.detail.value || '';
    const ready = CODE_REGEX.test(value.trim()) && PHONE_REGEX.test(this.data.phoneNumber.trim());
    this.setData({ smsCode: value, phoneVerifiedBy: ready ? 'sms' : '', errorMessage: '' });
    this.updateCanSubmit();
  },

  updateCanSubmit() {
    const {
      shopName,
      ownerName,
      address,
      phoneNumber,
      password,
      confirmPassword,
      agreed,
      phoneVerifiedBy
    } = this.data;
    this.setData({
      canSubmit: !!(
        shopName.trim() &&
        ownerName.trim() &&
        address.trim() &&
        PHONE_REGEX.test(phoneNumber.trim()) &&
        password.trim().length >= 6 &&
        confirmPassword.trim().length >= 6 &&
        password.trim() === confirmPassword.trim() &&
        agreed &&
        phoneVerifiedBy
      )
    });
  },

  toggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
    this.updateCanSubmit();
  },

  openServiceAgreement() {
    wx.navigateTo({ url: '/pages/service-agreement/index' });
  },

  openPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/privacy-policy/index' });
  },

  goLogin() {
    wx.navigateBack();
  },

  /** 一键获取手机号回调（open-type="getPhoneNumber"） */
  async handleGetPhoneNumber(e) {
    const detail = e.detail || {};

    if (!detail.code) {
      const denied = typeof detail.errMsg === 'string' && detail.errMsg.indexOf('deny') > -1;
      this.setData({
        errorMessage: denied ? '你已取消手机号授权，可改用其他手机号' : '获取手机号失败，请改用其他手机号'
      });
      return;
    }

    try {
      this.setData({ errorMessage: '', isSubmitting: true });
      const { phoneNumber, verifyTicket } = await verifyWechatPhone(detail.code);
      this.setData({
        phoneNumber,
        verifyTicket,
        phoneInputMode: 'wechat',
        phoneVerifiedBy: 'wechat',
        smsCode: ''
      });
      this.updateCanSubmit();
    } catch (error) {
      this.setData({ errorMessage: error.message || '手机号验证失败' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  /** 切换到手动输入（拒绝授权 / 代注册 / 登记非微信绑定号） */
  switchToManual() {
    this.setData({
      phoneInputMode: 'manual',
      phoneVerifiedBy: '',
      verifyTicket: '',
      smsCode: '',
      phoneNumber: '',
      errorMessage: ''
    });
    this.updateCanSubmit();
  },

  clearSmsTimer() {
    if (this._smsTimer) {
      clearInterval(this._smsTimer);
      this._smsTimer = null;
    }
  },

  startSmsCooldown() {
    this.setData({ smsCooldown: CODE_COOLDOWN_SECONDS });
    this._smsTimer = setInterval(() => {
      const next = this.data.smsCooldown - 1;
      if (next <= 0) {
        this.clearSmsTimer();
        this.setData({ smsCooldown: 0 });
        return;
      }
      this.setData({ smsCooldown: next });
    }, 1000);
  },

  /** 短信兜底发码 */
  async handleSendSmsCode() {
    if (this.data.smsCooldown > 0) return;

    const phone = this.data.phoneNumber.trim();
    if (!PHONE_REGEX.test(phone)) {
      this.setData({ errorMessage: '请先输入正确的 11 位手机号' });
      return;
    }

    try {
      this.setData({ errorMessage: '' });
      await sendRegisterSmsCode(phone);
      wx.showToast({ title: '验证码已发送', icon: 'none' });
      this.startSmsCooldown();
    } catch (error) {
      this.setData({ errorMessage: error.message || '验证码发送失败' });
    }
  },

  async handleSubmit() {
    const { shopName, ownerName, address, phoneNumber, password, confirmPassword, phoneVerifiedBy } = this.data;

    if (!shopName.trim()) {
      this.setData({ errorMessage: '请输入贵店名称' });
      return;
    }
    if (!ownerName.trim()) {
      this.setData({ errorMessage: '请输入店主姓名' });
      return;
    }
    if (!address.trim()) {
      this.setData({ errorMessage: '请输入贵店地址' });
      return;
    }
    if (!PHONE_REGEX.test(phoneNumber.trim())) {
      this.setData({ errorMessage: '请输入有效的手机号码' });
      return;
    }
    if (!phoneVerifiedBy) {
      this.setData({ errorMessage: '请先验证手机号' });
      return;
    }
    if (password.length < 6) {
      this.setData({ errorMessage: '登录密码长度不能少于 6 位' });
      return;
    }
    if (password !== confirmPassword) {
      this.setData({ errorMessage: '两次输入的密码不一致' });
      return;
    }
    if (!this.data.agreed) {
      this.setData({ errorMessage: '请先阅读并同意《服务协议》和《隐私政策》' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, errorMessage: '' });

      const payload = {
        shop_name: shopName,
        owner_name: ownerName,
        phone_number: phoneNumber,
        password: password,
        address: address
      };
      if (phoneVerifiedBy === 'wechat') {
        payload.phone_verify_ticket = this.data.verifyTicket;
      } else if (phoneVerifiedBy === 'sms') {
        payload.sms_code = this.data.smsCode;
      }

      await registerShop(payload);

      // 注册成功后自动登录
      try {
        await loginShop({ phone: phoneNumber, password: password });
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(function () {
          wx.switchTab({ url: '/pages/dashboard/index' });
        }, 1000);
      } catch (loginErr) {
        // 注册成功但自动登录失败
        wx.showModal({
          title: '注册成功',
          content: '注册已成功，但自动登录失败，请返回登录页手动登录',
          showCancel: false,
          confirmText: '返回登录',
          success: function (res) {
            if (res.confirm) wx.navigateBack();
          }
        });
      }
    } catch (error) {
      this.setData({
        errorMessage: error.message || '注册失败，请稍后重试'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
