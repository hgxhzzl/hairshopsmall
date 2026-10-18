const app = getApp();
const { getMemberById, getMemberBookQrText } = require('../../../services/member');
const { getRechargeOrders } = require('../../../services/recharge');
const { getConsumptionOrders } = require('../../../services/consumption');
const qrcode = require('../../../utils/qrcode');

/** 在 JS 层格式化日期（避免 WXS getRegExp 兼容问题） */
function formatDateYMD(val) {
  if (!val) return '';
  var s = String(val);
  if (/yyyy/i.test(s)) return '';
  if (s.length < 10) return '';
  if (s[4] !== '-' || s[7] !== '-') return '';
  var pos = [0, 1, 2, 3, 5, 6, 8, 9];
  for (var i = 0; i < pos.length; i++) {
    var c = s[pos[i]];
    if (c < '0' || c > '9') return '';
  }
  return s.substring(0, 10);
}

Page({
  data: {
    memberId: '',
    memberDetail: null,
    memberDetailError: '',
    isMemberDetailLoading: false,
    isQrLoading: false,
    qrText: '',
    qrError: '',
    qrImagePath: '',
    qrHint: '',
    recharges: [],
    consumptions: [],
    prepaidRecords: [],
    accountRecords: [],
    prepaidTotals: { recharge: 0, consume: 0 },
    accountTotals: { recharge: 0, consume: 0 },
    activeLedgerTab: 'account'
  },

  onLoad(options) {
    const memberId = options.id || '';
    if (!memberId) {
      this.setData({ memberDetailError: '缺少会员 ID' });
      return;
    }
    this.setData({ memberId });
  },

  onShow() {
    if (!app.checkLogin()) return;
    if (this.data.memberId) {
      this.loadAll();
    }
  },

  async loadAll() {
    const memberId = this.data.memberId;
    const session = app.globalData.session;

    try {
      this.setData({ isMemberDetailLoading: true, memberDetailError: '' });

      // 查询该会员所有充值/消费记录（不限月份），传 member_id 过滤 + 移除当月限制
      var ledgerQuery = { member_id: memberId, create_time_start: '', create_time_end: '', pageSize: 500 };
      const [detail, qrText, recharges, consumptions] = await Promise.all([
        getMemberById(session.token, memberId).catch(err => { throw err; }),
        getMemberBookQrText(session.token, memberId).catch(() => ''),
        getRechargeOrders(session.token, ledgerQuery).then(r => r.rows).catch(err => { console.warn('充值记录查询失败:', err); return []; }),
        getConsumptionOrders(session.token, ledgerQuery).then(r => r.rows).catch(err => { console.warn('消费记录查询失败:', err); return []; })
      ]);

      // 在 JS 层预格式化日期（绕过 WXS 兼容问题）
      var dateFields = {
        registerTimeText: formatDateYMD(detail.registerTime) || '未记录',
        birthDateText: formatDateYMD(detail.birthDate) || '未填写',
        lastRechargeTimeText: formatDateYMD(detail.lastRechargeTime) || '无记录',
        lastConsumptionTimeText: formatDateYMD(detail.lastConsumptionTime) || '无记录'
      };
      Object.assign(detail, dateFields);

      this.setData({
        memberDetail: detail,
        qrText,
        recharges,
        consumptions
      }, () => {
        this.buildLedgerRecords();
        // 二维码异步生成（对齐 RN：有手机号且有 qrText 才生成）
        var phone = (detail.phone || '').trim();
        if (!phone) {
          this.setData({ isQrLoading: false, qrImagePath: '', qrHint: '未登记手机号' });
        } else if (qrText) {
          this.setData({ isQrLoading: true, qrHint: '' });
          this.generateQRImage(qrText);
        } else {
          this.setData({ isQrLoading: false, qrImagePath: '', qrHint: '暂无二维码' });
        }
      });
    } catch (err) {
      this.setData({ memberDetailError: err.message || '加载会员详情失败' });
    } finally {
      this.setData({ isMemberDetailLoading: false });
    }
  },

  /** 构建流水记录 */
  buildLedgerRecords() {
    const { memberId, recharges, consumptions, memberDetail } = this.data;
    if (!memberDetail) return;

    const formatMoney = (v) => '¥' + (v || 0).toFixed(2);
    const formatDate = (v) => {
      if (!v) return '未知';
      const d = new Date(v);
      if (isNaN(d.getTime())) return v;
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };

    const prepaid = [];
    const account = [];
    let prepaidRecharge = 0, prepaidConsume = 0;
    let accountRecharge = 0, accountConsume = 0;

    // 充值记录
    const memberRecharges = recharges.filter(r => r.memberId === memberId);
    const memberConsumptions = consumptions.filter(c => c.memberId === memberId);
    for (const r of memberRecharges) {
      const record = {
        id: 'recharge-' + r.id,
        label: r.benefitType === 0 ? '套餐充值' : '账户充值',
        amount: r.amount,
        amountText: '+' + formatMoney(r.amount),
        isNegative: false,
        dateText: formatDate(r.time),
        time: r.time
      };
      if (r.benefitType === 0) {
        prepaid.push(record);
        prepaidRecharge += r.amount;
      } else {
        account.push(record);
        accountRecharge += r.amount;
      }
    }

    // 消费记录
    for (const c of memberConsumptions) {
      if (c.payType === 0) continue; // 非余额类记账不参与会员余额计算
      const record = {
        id: 'consumption-' + c.id,
        label: c.payType === 2 ? '套餐消费' : '账户消费',
        amount: c.amount,
        amountText: '-' + formatMoney(c.amount),
        isNegative: true,
        dateText: formatDate(c.time),
        time: c.time
      };
      if (c.payType === 2) {
        prepaid.push(record);
        prepaidConsume += c.amount;
      } else {
        account.push(record);
        accountConsume += c.amount;
      }
    }

    prepaid.sort((a, b) => a.time.localeCompare(b.time));
    account.sort((a, b) => a.time.localeCompare(b.time));

    // 计算运行余额
    let prepaidBalance = memberDetail.beginningPrepaid || 0;
    const prepaidWithBalance = prepaid.map(r => {
      prepaidBalance += r.isNegative ? -r.amount : r.amount;
      return { ...r, runningBalance: prepaidBalance };
    });

    let accountBalance = memberDetail.beginningBalance || 0;
    const accountWithBalance = account.map(r => {
      accountBalance += r.isNegative ? -r.amount : r.amount;
      return { ...r, runningBalance: accountBalance };
    });

    this.setData({
      prepaidRecords: prepaidWithBalance,
      accountRecords: accountWithBalance,
      prepaidTotals: { recharge: prepaidRecharge, consume: prepaidConsume },
      accountTotals: { recharge: accountRecharge, consume: accountConsume }
    });
  },

  /** 切换账本 Tab */
  switchLedgerTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeLedgerTab: tab });
  },

  /** 格式化金额 */
  formatMoney(value) {
    return '¥' + (value || 0).toFixed(2);
  },

  /** 格式化日期 */
  formatDate(value) {
    if (!value) return '未记录';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  /** 生成二维码图片（使用 qrcode-generator 官方库 + Canvas 2D） */
  generateQRImage(qrUrl) {
    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#qrCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          that.setData({ isQrLoading: false, qrImagePath: '', qrHint: '二维码加载失败' });
          return;
        }
        var canvas = res[0].node;
        var success = qrcode.drawQRCodeToCanvas(canvas, qrUrl, { width: 280 });
        if (!success) {
          that.setData({ isQrLoading: false, qrImagePath: '', qrHint: '二维码加载失败' });
          return;
        }
        setTimeout(function() {
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: function(result) {
              that.setData({ isQrLoading: false, qrImagePath: result.tempFilePath, qrHint: '扫码查看充值消费' });
            },
            fail: function() {
              that.setData({ isQrLoading: false, qrImagePath: '', qrHint: '二维码加载失败' });
            }
          });
        }, 100);
      });
  },

  /** 返回 */
  goBack() {
    wx.navigateBack();
  }
});
