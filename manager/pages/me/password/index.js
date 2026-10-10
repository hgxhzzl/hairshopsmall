const app = getApp();
const { changeShopPassword } = require('../../../services/shop');

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    actionError: '',
    isSubmitting: false,
    canSubmit: false
  },

  onOldInput(e) { this.setData({ oldPassword: e.detail.value, actionError: '' }); this.updateCanSubmit(); },
  onNewInput(e) { this.setData({ newPassword: e.detail.value, actionError: '' }); this.updateCanSubmit(); },
  onConfirmInput(e) { this.setData({ confirmPassword: e.detail.value, actionError: '' }); this.updateCanSubmit(); },

  updateCanSubmit() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    this.setData({
      canSubmit: !!(oldPassword.trim().length >= 6 && newPassword.trim().length >= 6 && confirmPassword.trim().length >= 6 && newPassword.trim() === confirmPassword.trim())
    });
  },

  async handleSubmit() {
    const oldPwd = this.data.oldPassword.trim();
    const newPwd = this.data.newPassword.trim();
    const confirmPwd = this.data.confirmPassword.trim();

    if (!oldPwd || !newPwd || !confirmPwd) {
      this.setData({ actionError: '请填写所有密码字段' });
      return;
    }
    if (oldPwd.length < 6 || newPwd.length < 6) {
      this.setData({ actionError: '密码长度不能少于 6 位' });
      return;
    }
    if (newPwd !== confirmPwd) {
      this.setData({ actionError: '两次输入的新密码不一致' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, actionError: '' });
      const session = app.globalData.session;
      await changeShopPassword(session.token, {
        old_password: oldPwd,
        new_password: newPwd
      });
      wx.showToast({ title: '密码修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      this.setData({ actionError: err.message || '密码修改失败' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
