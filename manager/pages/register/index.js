const { registerShop, loginShop } = require('../../services/auth');

const PHONE_REGEX = /^1[3-9]\d{9}$/;

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
    agreed: false
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

  onPhoneInput(e) {
    this.setData({ phoneNumber: e.detail.value, errorMessage: '' });
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

  updateCanSubmit() {
    const { shopName, ownerName, address, phoneNumber, password, confirmPassword, agreed } = this.data;
    this.setData({
      canSubmit: !!(shopName.trim() && ownerName.trim() && address.trim() && phoneNumber.trim() && password.trim().length >= 6 && confirmPassword.trim().length >= 6 && password.trim() === confirmPassword.trim() && agreed)
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

  async handleSubmit() {
    const { shopName, ownerName, address, phoneNumber, password, confirmPassword } = this.data;

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

      await registerShop({
        shop_name: shopName,
        owner_name: ownerName,
        phone_number: phoneNumber,
        password: password,
        address: address
      });

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
