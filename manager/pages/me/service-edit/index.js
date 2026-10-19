const app = getApp();
const { updateService, getServices } = require('../../../services/service');

const NAME_MAX = 10;
const PRICE_MAX = 999.99;

function sanitizePriceInput(value) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const hasDecimal = cleaned.includes('.');
  const parts = cleaned.split('.');
  let integerPart = parts[0].slice(0, 3);
  if (integerPart) integerPart = String(Math.min(Number(integerPart), 999));
  if (!hasDecimal) return integerPart;
  const decimalPart = parts.slice(1).join('').slice(0, 2);
  return (integerPart || '0') + '.' + decimalPart;
}

Page({
  data: {
    serviceId: '',
    name: '',
    memberPrice: '',
    normalPrice: '',
    status: 0,
    canSubmit: false,
    actionError: '',
    isSubmitting: false
  },

  onLoad(options) {
    const serviceId = options.serviceId || '';
    this.setData({ serviceId });
    if (serviceId) {
      this.loadService(serviceId);
    }
  },

  onShow() {
    if (!app.checkLogin()) return;
  },

  /** 根据 id 从服务端拉取服务详情（不再依赖 globalData 侧信道） */
  async loadService(serviceId) {
    try {
      const session = app.globalData.session;
      const services = await getServices(session.token);
      const service = services.find(s => s.id === serviceId);
      if (service) {
        this.initFromService(service);
      } else {
        this.setData({ actionError: '服务项目不存在或已删除' });
      }
    } catch (err) {
      this.setData({ actionError: err.message || '加载服务项目失败' });
    }
  },

  initFromService(service) {
    this.setData({
      name: (service.name || '').slice(0, NAME_MAX),
      memberPrice: sanitizePriceInput(String(service.memberPrice || 0)),
      normalPrice: sanitizePriceInput(String(service.normalPrice || 0)),
      status: service.status === 1 ? 1 : 0
    });
    this.updateCanSubmit();
  },

  validateField(field, value) {
    if (field === 'name') return value.trim() ? '' : '服务名称不能为空';
    if (value === '') return '价格不能为空';
    const n = Number(value);
    if (!isFinite(n)) return '请输入有效数字';
    if (n < 0) return '价格不能为负数';
    if (n > PRICE_MAX) return '价格不能超过 999.99';
    if ((value.split('.')[1] || '').length > 2) return '最多保留两位小数';
    return '';
  },

  onNameInput(e) {
    const v = e.detail.value.slice(0, NAME_MAX);
    this.setData({ name: v, actionError: '' });
    this.updateCanSubmit();
  },

  onMemberPriceInput(e) {
    const v = sanitizePriceInput(e.detail.value);
    this.setData({ memberPrice: v, actionError: '' });
    this.updateCanSubmit();
  },

  onNormalPriceInput(e) {
    const v = sanitizePriceInput(e.detail.value);
    this.setData({ normalPrice: v, actionError: '' });
    this.updateCanSubmit();
  },

  updateCanSubmit() {
    const { name, memberPrice, normalPrice } = this.data;
    const nameOk = !!name.trim();
    const m = Number(memberPrice);
    const n = Number(normalPrice);
    const memberOk = memberPrice !== '' && isFinite(m) && m >= 0 && m <= PRICE_MAX;
    const normalOk = normalPrice !== '' && isFinite(n) && n >= 0 && n <= PRICE_MAX;
    this.setData({ canSubmit: nameOk && memberOk && normalOk });
  },

  setStatus(e) {
    this.setData({ status: Number(e.currentTarget.dataset.status) });
  },

  async handleSubmit() {
    const { serviceId, name, memberPrice, normalPrice, status } = this.data;
    const nameErr = this.validateField('name', name);
    const memberErr = this.validateField('memberPrice', memberPrice);
    const normalErr = this.validateField('normalPrice', normalPrice);
    if (nameErr || memberErr || normalErr) {
      this.setData({ actionError: '请检查必填信息' });
      return;
    }
    if (Number(memberPrice) > Number(normalPrice)) {
      this.setData({ actionError: '会员价不能高于正常价' });
      return;
    }

    try {
      this.setData({ isSubmitting: true, actionError: '' });
      const session = app.globalData.session;
      await updateService(session.token, serviceId, {
        item_name: name.trim(),
        member_price: Number(memberPrice),
        normal_price: Number(normalPrice),
        status
      });
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      this.setData({ actionError: err.message || '修改服务失败' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
