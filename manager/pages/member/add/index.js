const app = getApp();
const { createMember } = require('../../../services/member');
const { getStoredMemberFieldVisibility } = require('../../../services/memberFieldConfig');

const MEMBER_ID_MAX_LENGTH = 6;
const MEMBER_NAME_MAX_LENGTH = 10;
const REMARK_MAX_LENGTH = 20;

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
    const value = (e.detail.value || '').slice(0, MEMBER_NAME_MAX_LENGTH);
    this.setData({ memberName: value, actionError: '' });
    this.updateCanSubmit();
  },

  /** 编号输入 */
  onNoInput(e) {
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, MEMBER_ID_MAX_LENGTH);
    this.setData({ memberNo: value, actionError: '' });
  },

  /** 手机号输入 */
  onPhoneInput(e) {
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, 11);
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
    const value = (e.detail.value || '').slice(0, REMARK_MAX_LENGTH);
    this.setData({ remark: value, actionError: '' });
  },

  /** 设置性别 */
  setGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender });
  },

  updateCanSubmit() {
    const { memberName, phone, registerDate } = this.data;
    const nameOk = !!memberName.trim();
    const registerOk = !!registerDate.trim();
    const phoneOk = !phone.trim() || /^1[3-9]\d{9}$/.test(phone);
    this.setData({ canSubmit: nameOk && registerOk && phoneOk });
  },

  /** 提交 */
  async handleSubmit() {
    const { memberName, phone, memberNo, gender, birthDate, registerDate, remark } = this.data;

    if (!memberName.trim()) {
      this.setData({ actionError: '请输入会员姓名' });
      return;
    }
    if (phone.trim() && !/^1[3-9]\d{9}$/.test(phone)) {
      this.setData({ actionError: '手机号码格式不正确' });
      return;
    }
    if (!registerDate.trim()) {
      this.setData({ actionError: '请选择注册日期' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, actionError: '' });
      const session = app.globalData.session;

      const payload = {
        member_name: memberName.trim(),
        member_no: memberNo.trim() || undefined,
        phone_number: phone.trim() || undefined,
        gender,
        birth_date: birthDate || undefined,
        register_time: new Date(registerDate + 'T00:00:00').toISOString(),
        remark: remark.trim() || undefined
      };

      await createMember(session.token, payload);
      wx.showToast({ title: '新增成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (error) {
      this.setData({ actionError: error.message || '新增会员失败，请稍后重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
