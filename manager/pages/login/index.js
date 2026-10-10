const { loginShop, getStoredSession } = require('../../services/auth');

Page({
  data: {
    phone: '',
    password: '',
    isSubmitting: false,
    errorMessage: '',
    canSubmit: false
  },

  onLoad() {
    // 检查是否已有登录态
    const session = getStoredSession();
    if (session && session.token) {
      wx.switchTab({ url: '/pages/dashboard/index' });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value, errorMessage: '' });
    this.updateCanSubmit();
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, errorMessage: '' });
    this.updateCanSubmit();
  },

  updateCanSubmit() {
    const { phone, password } = this.data;
    this.setData({
      canSubmit: !!(phone.trim() && password.trim().length >= 6)
    });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/index' });
  },

  goForgotPassword() {
    wx.navigateTo({ url: '/pages/forgot-password/index' });
  },

  async handleSubmit() {
    const phone = this.data.phone.trim();
    const password = this.data.password.trim();

    if (!phone || !password) {
      this.setData({ errorMessage: '请输入手机号和密码' });
      return;
    }
    if (password.length < 6) {
      this.setData({ errorMessage: '密码长度不能少于 6 位' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, errorMessage: '' });
      await loginShop({ phone, password });
      wx.switchTab({ url: '/pages/dashboard/index' });
    } catch (error) {
      this.setData({
        errorMessage: error.message || '登录失败，请稍后重试'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
