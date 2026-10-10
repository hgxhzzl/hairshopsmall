const app = getApp();
const {
  CANCELLATION_REASONS,
  submitCancellationRequest,
  getCancellationRequest,
  withdrawCancellationRequest
} = require('../../../services/shop');
const { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } = require('../../../utils/constants');

/** 后端返回的时间统一格式化为 yyyy-mm-dd hh:mm，避免直接暴露 ISO 串 */
function formatDateTime(value) {
  if (!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5];
  const date = new Date(s);
  if (isNaN(date.getTime())) return s;
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

/** 状态记录，补上页面要用的三个时间文本 */
function decorateTimes(record) {
  if (!record) return record;
  record.createTimeText = formatDateTime(record.createTime);
  record.contactTimeText = formatDateTime(record.contactTime);
  record.doneTimeText = formatDateTime(record.doneTime);
  return record;
}

Page({
  data: {
    loading: true,
    request: null,
    reasons: CANCELLATION_REASONS,
    selectedCode: '',
    reasonText: '',
    password: '',
    actionError: '',
    isSubmitting: false,
    canSubmit: false,
    showWithdraw: false,
    withdrawPassword: '',
    withdrawError: '',
    isWithdrawing: false,
    supportPhone: SUPPORT_PHONE_DISPLAY
  },

  onShow() {
    if (!app.checkLogin()) return;
    this.loadStatus();
  },

  async loadStatus() {
    try {
      this.setData({ loading: true, actionError: '' });
      const session = app.globalData.session;
      const record = await getCancellationRequest(session.token);
      this.setData({ request: decorateTimes(record), loading: false });
    } catch (err) {
      this.setData({
        loading: false,
        actionError: err.message || '注销状态读取失败，请稍后重试'
      });
    }
  },

  handleSelectReason(e) {
    this.setData({ selectedCode: e.currentTarget.dataset.code, actionError: '' });
    this.updateCanSubmit();
  },

  onReasonTextInput(e) {
    this.setData({ reasonText: e.detail.value, actionError: '' });
    this.updateCanSubmit();
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, actionError: '' });
    this.updateCanSubmit();
  },

  updateCanSubmit() {
    const { selectedCode, reasonText, password } = this.data;
    const reasonReady = !!selectedCode && (selectedCode !== 'other' || reasonText.trim().length > 0);
    this.setData({ canSubmit: reasonReady && password.trim().length >= 6 });
  },

  async handleSubmit() {
    if (this.data.isSubmitting) return;
    const { selectedCode, reasonText, password } = this.data;
    if (!selectedCode) {
      this.setData({ actionError: '请选择注销原因' });
      return;
    }
    if (selectedCode === 'other' && !reasonText.trim()) {
      this.setData({ actionError: '选择其他原因时请补充一句话说明' });
      return;
    }
    if (password.trim().length < 6) {
      this.setData({ actionError: '请输入当前登录密码' });
      return;
    }

    const confirmed = await this.confirmDanger();
    if (!confirmed) return;

    try {
      this.setData({ isSubmitting: true, actionError: '' });
      const session = app.globalData.session;
      const payload = { reason_code: selectedCode, password: password.trim() };
      if (selectedCode === 'other') payload.reason_text = reasonText.trim();
      const record = await submitCancellationRequest(session.token, payload);
      wx.showToast({ title: '申请已提交', icon: 'success' });
      this.setData({
        request: decorateTimes(record),
        selectedCode: '',
        reasonText: '',
        password: '',
        canSubmit: false
      });
    } catch (err) {
      this.setData({ actionError: err.message || '注销申请提交失败，请稍后重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  handleOpenWithdraw() {
    this.setData({ showWithdraw: true, withdrawError: '' });
  },

  handleCancelWithdraw() {
    this.setData({ showWithdraw: false, withdrawPassword: '', withdrawError: '' });
  },

  onWithdrawInput(e) {
    this.setData({ withdrawPassword: e.detail.value, withdrawError: '' });
  },

  async handleConfirmWithdraw() {
    if (this.data.isWithdrawing) return;
    const password = this.data.withdrawPassword.trim();
    if (password.length < 6) {
      this.setData({ withdrawError: '请输入当前登录密码' });
      return;
    }

    try {
      this.setData({ isWithdrawing: true, withdrawError: '' });
      const session = app.globalData.session;
      await withdrawCancellationRequest(session.token, { password });
      wx.showToast({ title: '已撤回', icon: 'success' });
      this.setData({ showWithdraw: false, withdrawPassword: '' });
      await this.loadStatus();
    } catch (err) {
      this.setData({ withdrawError: err.message || '撤回失败，请稍后重试' });
    } finally {
      this.setData({ isWithdrawing: false });
    }
  },

  /** 二次确认：提交的是不可逆操作的起点，避免误触 */
  confirmDanger() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '确认提交注销申请',
        content: '服务人员核实身份后将删除本店铺的会员、充值、消费及账本数据，删除后不可恢复。确定提交吗？',
        confirmText: '确认提交',
        cancelText: '再想想',
        confirmColor: '#c0392b',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      });
    });
  },

  handleCallSupport() {
    wx.makePhoneCall({ phoneNumber: SUPPORT_PHONE, fail: () => {} });
  }
});
