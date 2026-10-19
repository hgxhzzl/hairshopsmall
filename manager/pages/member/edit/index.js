const app = getApp();
const { getMemberById, updateMember } = require('../../../services/member');
const { getStoredMemberFieldVisibility } = require('../../../services/memberFieldConfig');
const {
  sanitizeName,
  sanitizeMemberNo,
  sanitizePhone,
  sanitizeRemark,
  canSubmitForm,
  validateMemberForm,
  buildMemberPayload,
  memberToForm
} = require('../../../utils/memberForm');

Page({
  data: {
    memberId: '',
    memberName: '',
    memberNo: '',
    phone: '',
    gender: '男',
    birthDate: '',
    registerDate: '',
    remark: '',
    canSubmit: false,
    actionError: '',
    isLoading: true,
    isSubmitting: false,
    fieldVisibility: { phone_number: true, member_no: true, birth_date: true, remark: true }
  },

  onLoad(options) {
    this.setData({
      memberId: options.id || '',
      fieldVisibility: getStoredMemberFieldVisibility()
    });
  },

  onShow() {
    if (!app.checkLogin()) return;
    if (this.data.memberId && this.data.isLoading) {
      this.loadMember();
    }
  },

  async loadMember() {
    try {
      this.setData({ isLoading: true, actionError: '' });
      const session = app.globalData.session;
      const detail = await getMemberById(session.token, this.data.memberId);
      this.applyMemberToForm(detail);
      this.updateCanSubmit();
    } catch (error) {
      this.setData({ actionError: error.message || '读取会员信息失败' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  applyMemberToForm(member) {
    this.setData(memberToForm(member));
  },

  onNameInput(e) {
    const value = sanitizeName(e.detail.value);
    this.setData({ memberName: value, actionError: '' });
    this.updateCanSubmit();
  },

  onNoInput(e) {
    const value = sanitizeMemberNo(e.detail.value);
    this.setData({ memberNo: value, actionError: '' });
  },

  onPhoneInput(e) {
    const value = sanitizePhone(e.detail.value);
    this.setData({ phone: value, actionError: '' });
    this.updateCanSubmit();
  },

  onDateInput(e) {
    this.setData({ registerDate: e.detail.value, actionError: '' });
    this.updateCanSubmit();
  },

  onBirthDateInput(e) {
    this.setData({ birthDate: e.detail.value, actionError: '' });
  },

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

      await updateMember(session.token, this.data.memberId, payload);
      app.invalidateDashboardCache();
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (error) {
      this.setData({ actionError: error.message || '修改会员失败，请稍后重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
