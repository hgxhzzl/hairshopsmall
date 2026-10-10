const app = getApp();
const { getMemberById, updateMember } = require('../../../services/member');
const { getStoredMemberFieldVisibility } = require('../../../services/memberFieldConfig');

const MEMBER_ID_MAX_LENGTH = 6;
const MEMBER_NAME_MAX_LENGTH = 10;
const REMARK_MAX_LENGTH = 20;

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
    this.setData({
      memberName: (member.name || '').slice(0, MEMBER_NAME_MAX_LENGTH),
      memberNo: (member.memberNo || '').replace(/\D/g, '').slice(0, MEMBER_ID_MAX_LENGTH),
      phone: (member.phone || '').replace(/\D/g, '').slice(0, 11),
      gender: member.gender === '女' ? '女' : '男',
      birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
      registerDate: member.registerTime ? member.registerTime.slice(0, 10) : '',
      remark: (member.remark || '').slice(0, REMARK_MAX_LENGTH)
    });
  },

  onNameInput(e) {
    const value = (e.detail.value || '').slice(0, MEMBER_NAME_MAX_LENGTH);
    this.setData({ memberName: value, actionError: '' });
    this.updateCanSubmit();
  },

  onNoInput(e) {
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, MEMBER_ID_MAX_LENGTH);
    this.setData({ memberNo: value, actionError: '' });
  },

  onPhoneInput(e) {
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, 11);
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

  async handleSubmit() {
    const { memberName, phone, memberNo, gender, birthDate, registerDate, remark, memberId } = this.data;

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

      await updateMember(session.token, memberId, payload);
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (error) {
      this.setData({ actionError: error.message || '修改会员失败，请稍后重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
