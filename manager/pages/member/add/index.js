const app = getApp();
const { createMember } = require('../../../services/member');
const { getStoredMemberFieldVisibility } = require('../../../services/memberFieldConfig');
const {
  sanitizeName,
  sanitizeMemberNo,
  sanitizePhone,
  sanitizeRemark,
  canSubmitForm,
  validateMemberForm,
  buildMemberPayload
} = require('../../../utils/memberForm');

Page({
  data: {
    memberName: '',
    memberNo: '',
    phone: '',
    gender: '男',
    birthDate: '',
    registerDate: '',
    remark: '',
    canSubmit: false,
    actionError: '',
    isSubmitting: false,
    fieldVisibility: { phone_number: true, member_no: true, birth_date: true, remark: true }
  },

  onLoad() {
    const today = new Date().toISOString().slice(0, 10);
    this.setData({
      registerDate: today,
      fieldVisibility: getStoredMemberFieldVisibility()
    });
  },

  onShow() {
    if (!app.checkLogin()) return;
  },

  /** 姓名输入 */
  onNameInput(e) {
    const value = sanitizeName(e.detail.value);
    this.setData({ memberName: value, actionError: '' });
    this.updateCanSubmit();
  },

  /** 编号输入 */
  onNoInput(e) {
    const value = sanitizeMemberNo(e.detail.value);
    this.setData({ memberNo: value, actionError: '' });
  },

  /** 手机号输入 */
  onPhoneInput(e) {
    const value = sanitizePhone(e.detail.value);
    this.setData({ phone: value, actionError: '' });
    this.updateCanSubmit();
  },

  /** 日期输入 */
  onDateInput(e) {
    const value = e.detail.value;
    this.setData({ registerDate: value, actionError: '' });
    this.updateCanSubmit();
  },

  /** 出生日期输入 */
  onBirthDateInput(e) {
    this.setData({ birthDate: e.detail.value, actionError: '' });
  },

  /** 备注输入 */
  onRemarkInput(e) {
    const value = sanitizeRemark(e.detail.value);
    this.setData({ remark: value, actionError: '' });
  },

  /** 设置性别 */
  setGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender });
  },

  updateCanSubmit() {
    this.setData({ canSubmit: canSubmitForm(this.data) });
  },

  /** 提交 */
  async handleSubmit() {
    const error = validateMemberForm(this.data);
    if (error) {
      this.setData({ actionError: error });
      return;
    }

    try {
      this.setData({ isSubmitting: true, actionError: '' });
      const session = app.globalData.session;

      const payload = buildMemberPayload(this.data);

      await createMember(session.token, payload);
      app.invalidateDashboardCache();
      wx.showToast({ title: '新增成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (error) {
      this.setData({ actionError: error.message || '新增会员失败，请稍后重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
