const app = getApp();
const { getStoredMemberFieldVisibility, saveMemberFieldVisibility } = require('../../../services/memberFieldConfig');

const FIELD_DEFINITIONS = [
  { key: 'phone_number', label: '手机号码', description: '用于会员手机号记录' },
  { key: 'member_no', label: '会员编号', description: '适合门店内部编号管理' },
  { key: 'birth_date', label: '出生日期', description: '适合生日营销或关怀场景' },
  { key: 'remark', label: '备注信息', description: '用于个性化偏好或补充说明' }
];

Page({
  data: {
    fieldVisibility: { phone_number: true, member_no: true, birth_date: true, remark: true },
    fieldDefinitions: FIELD_DEFINITIONS,
    enabledCount: 4,
    isSaving: false,
    canSubmit: true,
    actionError: ''
  },

  onShow() {
    if (!app.checkLogin()) return;
    const visibility = getStoredMemberFieldVisibility();
    const enabledCount = Object.values(visibility).filter(Boolean).length;
    this.setData({ fieldVisibility: visibility, enabledCount });
  },

  /** 切换字段可见性 */
  handleVisibilityChange(e) {
    const key = e.currentTarget.dataset.key;
    const visible = e.currentTarget.dataset.visible;
    const fieldVisibility = { ...this.data.fieldVisibility, [key]: visible };
    const enabledCount = Object.values(fieldVisibility).filter(Boolean).length;
    this.setData({ fieldVisibility, enabledCount, actionError: '' });
  },

  /** 保存设置 */
  async handleSave() {
    try {
      this.setData({ isSaving: true, actionError: '' });
      const session = app.globalData.session;
      await saveMemberFieldVisibility(session.token, this.data.fieldVisibility);
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (error) {
      this.setData({ actionError: error.message || '字段显示配置保存失败' });
    } finally {
      this.setData({ isSaving: false });
    }
  }
});
