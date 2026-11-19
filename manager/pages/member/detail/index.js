const app = getApp();
const { getMemberById, getMemberBookQrText, getMemberServiceEntitlements } = require('../../../services/member');
const { getRechargeOrders } = require('../../../services/recharge');
const { getConsumptionOrders } = require('../../../services/consumption');
const qrcode = require('../../../utils/qrcode');
const { formatDateYMD } = require('../../../utils/date');

/**
 * 服务端列表 pageSize 上限（HairShopApi src/utils/request.ts 的 MAX_PAGE_SIZE）。
 * 超过上限会被后端 400 拒绝，而这里的 catch 会把它变成空数组 ——
 * 表现就是「会员流水一条都不显示」，所以这个值必须与后端保持一致。
 */
const MAX_PAGE_SIZE = 100;

/** 同时并发的翻页请求数。会员流水多的店一年能到十几页，串行翻页会把等待时间叠成 N 倍 RTT */
const PAGE_CONCURRENCY = 4;

/** 多久之后 onShow 认为数据陈旧、需要重拉（毫秒） */
const STALE_AFTER_MS = 60 * 1000;

/**
 * 按分页把某会员的全部充值/消费流水取回，避免单页 pageSize 上限导致
 * 活跃会员流水被静默截断、余额累计算错。用后端返回的 totalPages 驱动翻页，
 * 除首页外按 4 页一批并发拉取（结果仍按页码顺序拼接，保持时间顺序与旧实现一致）。
 */
async function fetchAllOrderRows(token, baseQuery, fetcher) {
  const pageSize = MAX_PAGE_SIZE;
  const first = await fetcher(token, { ...baseQuery, page: 1, pageSize });
  const rows = (first && first.rows) || [];
  const totalPages = Math.max(1, (first && first.pagination && first.pagination.totalPages) || 1);

  if (totalPages <= 1) {
    return rows;
  }

  const restPages = [];
  for (let page = 2; page <= totalPages; page++) {
    restPages.push(page);
  }

  const tail = [];
  for (let i = 0; i < restPages.length; i += PAGE_CONCURRENCY) {
    const chunk = restPages.slice(i, i + PAGE_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(page => fetcher(token, { ...baseQuery, page, pageSize }))
    );
    chunkResults.forEach(result => {
      if (result && result.rows) {
        tail.push(...result.rows);
      }
    });
  }

  return rows.concat(tail);
}

/** 将逐条明细按「项目名 + 单价」归集并累加次数，供套餐流水每条明细展示 */
function groupEntitlementItems(items) {
  const map = {};
  (items || []).forEach(it => {
    const key = it.name + '|' + it.price;
    if (!map[key]) map[key] = { name: it.name, price: it.price, count: 0 };
    map[key].count += (it.count || 1);
  });
  return Object.keys(map).map(k => map[k]);
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
    // 本年账户充值合计（benefitType 非套餐、且充值年份为当前自然年）
    yearAccountRechargeTotal: 0,
    // 本年套餐充值合计（benefitType 为套餐、且充值年份为当前自然年）
    yearPrepaidRechargeTotal: 0,
    // 本年账户消费合计（payType 为账户、且消费年份为当前自然年）
    yearAccountConsumeTotal: 0,
    // 本年套餐消费合计（payType 为套餐、且消费年份为当前自然年）
    yearPrepaidConsumeTotal: 0,
    // 套餐金额子卡片：当前会员各项目剩余可用权益次数 [{ name, count }]
    entitlementSummary: [],
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
    if (!this.data.memberId) return;

    // 旧实现每次 onShow 都全量重拉（会员 + 二维码 + 全部流水）：
    // 从「新增消费」返回一次就是一次十几页的串行翻页。现在只在
    // 「首次进入 / 数据已陈旧 / 别处刚改过消费充值」时才重拉。
    const isStale = Date.now() - (this.loadedAt || 0) > STALE_AFTER_MS;
    const hasPendingChange = !!app.globalData.dashboardDirty;

    if (this.hasLoaded && !isStale && !hasPendingChange) {
      return;
    }

    this.loadAll();
  },

  async loadAll() {
    const memberId = this.data.memberId;
    const session = app.globalData.session;

    try {
      this.setData({ isMemberDetailLoading: true, memberDetailError: '' });

      // 查询该会员所有充值/消费记录（不限月份），按 member_id 服务端过滤并分页取全量
      var ledgerQuery = { member_id: memberId, create_time_start: '', create_time_end: '' };
      const [detail, qrText, recharges, consumptions, entitlements] = await Promise.all([
        getMemberById(session.token, memberId).catch(err => { throw err; }),
        getMemberBookQrText(session.token, memberId).catch(() => ''),
        fetchAllOrderRows(session.token, ledgerQuery, getRechargeOrders).catch(err => { console.warn('充值记录查询失败:', err); return []; }),
        fetchAllOrderRows(session.token, ledgerQuery, getConsumptionOrders).catch(err => { console.warn('消费记录查询失败:', err); return []; }),
        getMemberServiceEntitlements(session.token, memberId).catch(err => { console.warn('权益次数加载失败:', err); return []; })
      ]);

      // 权益次数汇总：后端仅返回 status=0 的未使用权益，每条即 1 次，按项目名称归集计数
      const entitlementGroups = {};
      (entitlements || []).forEach(e => {
        const name = e.itemName || '未命名项目';
        if (!entitlementGroups[name]) entitlementGroups[name] = { name, count: 0 };
        entitlementGroups[name].count += 1;
      });
      const entitlementSummary = Object.keys(entitlementGroups).map(k => entitlementGroups[k]);

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
        consumptions,
        entitlementSummary
      }, () => {
        this.hasLoaded = true;
        this.loadedAt = Date.now();
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
    // 账户/套餐子卡片只统计本年（按自然年）的对应类金额
    const currentYear = new Date().getFullYear();
    let yearAccountRecharge = 0;
    let yearPrepaidRecharge = 0;
    let yearAccountConsume = 0;
    let yearPrepaidConsume = 0;

    // 充值记录
    const memberRecharges = recharges.filter(r => r.memberId === memberId);
    const memberConsumptions = consumptions.filter(c => c.memberId === memberId);
    for (const r of memberRecharges) {
      const record = {
        id: 'recharge-' + r.id,
        kind: 'recharge',
        label: r.benefitType === 0 ? '套餐充值' : '账户充值',
        amount: r.amount,
        amountText: '+' + formatMoney(r.amount),
        giftAmount: r.giftAmount || 0,
        items: groupEntitlementItems(r.items),
        isNegative: false,
        dateText: formatDate(r.time),
        time: r.time
      };
      if (r.benefitType === 0) {
        prepaid.push(record);
        prepaidRecharge += r.amount;
        const rechargeYear = new Date(r.time).getFullYear();
        if (rechargeYear === currentYear) yearPrepaidRecharge += r.amount;
      } else {
        // 账户充值实际到账 = 本金 + 赠送，第一行金额、顶部充值汇总均按到账总额计，口径对齐
        const credited = r.amount + record.giftAmount;
        record.amountText = '+' + formatMoney(credited);
        account.push(record);
        accountRecharge += credited;
        const rechargeYear = new Date(r.time).getFullYear();
        if (rechargeYear === currentYear) yearAccountRecharge += credited;
      }
    }

    // 消费记录
    for (const c of memberConsumptions) {
      if (c.payType === 0) continue; // 非余额类记账不参与会员余额计算
      // 账户消费按实付金额（pay_amount）记账；套餐消费按消费总额（total_amount）记账，与后端账本口径一致
      const consumeAmount = c.payType === 1 ? (c.payAmount || c.amount) : c.amount;
      const record = {
        id: 'consumption-' + c.id,
        kind: 'consumption',
        label: c.payType === 2 ? '套餐消费' : '账户消费',
        amount: consumeAmount,
        amountText: '-' + formatMoney(consumeAmount),
        primaryItemName: c.primaryItemName,
        serviceCount: c.serviceCount,
        payAmount: c.payAmount,
        items: groupEntitlementItems(c.items),
        isNegative: true,
        dateText: formatDate(c.time),
        time: c.time
      };
      // 账户消费：明细单价合计与实付不一致（含优惠）时，明细末尾追加对账提示
      if (c.payType === 1) {
        const detailTotal = (record.items || []).reduce(
          (sum, ent) => sum + (Number(ent.count) || 1) * (Number(ent.price) || 0),
          0
        );
        const paid = record.amount;
        if (
          record.items.length > 0 &&
          Number.isFinite(paid) &&
          paid > 0 &&
          Math.abs(detailTotal - paid) > 0.005
        ) {
          record.showTotalHint = true;
          record.totalHintText = formatMoney(detailTotal) + ' · 实付 ' + formatMoney(paid);
        }
      }
      if (c.payType === 2) {
        prepaid.push(record);
        prepaidConsume += record.amount;
        const consumeYear = new Date(c.time).getFullYear();
        if (consumeYear === currentYear) yearPrepaidConsume += record.amount;
      } else {
        account.push(record);
        accountConsume += record.amount;
        const consumeYear = new Date(c.time).getFullYear();
        if (consumeYear === currentYear) yearAccountConsume += record.amount;
      }
    }

    prepaid.sort((a, b) => a.time.localeCompare(b.time));
    account.sort((a, b) => a.time.localeCompare(b.time));

    // 计算运行余额
    let prepaidBalance = memberDetail.beginningPrepaid || 0;
    // 项目名 → 截至该笔的累计剩余次数（按时间顺序推算：套餐充值累加、套餐消费累减）
    const runningEntitlement = {};
    const prepaidWithBalance = prepaid.map(r => {
      prepaidBalance += r.isNegative ? -r.amount : r.amount;
      const items = (r.items || []).map(ent => {
        const prev = runningEntitlement[ent.name] || 0;
        const next = r.isNegative ? prev - ent.count : prev + ent.count;
        runningEntitlement[ent.name] = next;
        return { ...ent, remain: next };
      });
      return { ...r, runningBalance: prepaidBalance, items };
    });

    let accountBalance = memberDetail.beginningBalance || 0;
    const accountWithBalance = account.map(r => {
      accountBalance += r.isNegative ? -r.amount : (r.amount + (r.giftAmount || 0));
      return { ...r, runningBalance: accountBalance };
    });

    this.setData({
      prepaidRecords: prepaidWithBalance,
      accountRecords: accountWithBalance,
      prepaidTotals: { recharge: prepaidRecharge, consume: prepaidConsume },
      accountTotals: { recharge: accountRecharge, consume: accountConsume },
      yearAccountRechargeTotal: yearAccountRecharge,
      yearPrepaidRechargeTotal: yearPrepaidRecharge,
      yearAccountConsumeTotal: yearAccountConsume,
      yearPrepaidConsumeTotal: yearPrepaidConsume
    });
  },

  /** 切换账本 Tab */
  switchLedgerTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeLedgerTab: tab });
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
