const app = getApp();
const { getMembers, deleteMember } = require('../../../services/member');

Page({
  data: {
    members: [],
    memberError: '',
    isMemberLoading: false,
    memberSearchText: '',
    filteredMembers: [],
    memberStats: { totalCount: 0, totalBalance: 0, totalPrepaid: 0 },
    memberGenderStats: { maleCount: 0, femaleCount: 0 }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    if (!app.checkLogin()) return;
    this.loadMembers();
  },

  onPullDownRefresh() {
    this.loadMembers().finally(() => wx.stopPullDownRefresh());
  },

  async loadMembers() {
    try {
      this.setData({ isMemberLoading: true, memberError: '' });
      const session = app.globalData.session;
      const members = await getMembers(session.token);
      this.setData({ members }, () => this.applySearchFilter());
    } catch (err) {
      this.setData({ memberError: err.message || '读取会员列表失败' });
    } finally {
      this.setData({ isMemberLoading: false });
    }
  },

  /** 搜索输入 */
  onSearchInput(e) {
    this.setData({ memberSearchText: e.detail.value }, () => this.applySearchFilter());
  },

  /** 清除搜索 */
  onClearSearch() {
    this.setData({ memberSearchText: '' }, () => this.applySearchFilter());
  },

  /** 应用筛选 */
  applySearchFilter() {
    const { members, memberSearchText } = this.data;
    const normalizedSearch = memberSearchText.trim().toLowerCase();
    let filtered = members;
    if (normalizedSearch) {
      filtered = members.filter(m =>
        (m.name || '').toLowerCase().includes(normalizedSearch) ||
        (m.memberNo || '').toLowerCase().includes(normalizedSearch) ||
        (m.phone || '').toLowerCase().includes(normalizedSearch)
      );
    }

    const maleCount = members.filter(m => m.gender === '男').length;
    const femaleCount = members.filter(m => m.gender === '女').length;

    this.setData({
      filteredMembers: filtered,
      memberStats: {
        totalCount: members.length,
        totalBalance: members.reduce((sum, m) => sum + m.balance, 0),
        totalPrepaid: members.reduce((sum, m) => sum + m.prepaid, 0)
      },
      memberGenderStats: { maleCount, femaleCount }
    });
  },

  /** 格式化金额 */
  formatMoney(value) {
    return '¥' + (value || 0).toFixed(2);
  },

  /** 查看会员详情 */
  onOpenMemberDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/member/detail/index?id=' + id });
  },

  /** 编辑会员 */
  onEditMember(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/member/edit/index?id=' + id });
  },

  /** 为该会员充值 */
  onRechargeForMember(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/recharge/add/index?memberId=' + id });
  },

  /** 为该会员消费 */
  onConsumptionForMember(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/consumption/add/index?memberId=' + id });
  },

  /** 新增会员 */
  navToAddMember() {
    wx.navigateTo({ url: '/pages/member/add/index' });
  },

  /** 删除会员 */
  onDeleteMember(e) {
    const id = e.currentTarget.dataset.id;
    const member = this.data.members.find(m => m.id === id);
    const name = member ? member.name : '该会员';
    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${name}」吗？删除后不可恢复。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const session = app.globalData.session;
          await deleteMember(session.token, id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadMembers();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  /** 字段设置 */
  navToFieldSettings() {
    wx.navigateTo({ url: '/pages/member/field-settings/index' });
  }
});
