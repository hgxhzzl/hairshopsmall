const app = getApp();
const { getMembers } = require('../../../services/member');

Page({
  data: {
    members: [],
    memberError: '',
    isMemberLoading: false,
    searchText: '',
    filteredMembers: [],
    filteredStats: { totalCount: 0, totalBalance: 0, totalPrepaid: 0 }
  },

  onShow() {
    if (!app.checkLogin()) return;
    this.loadMembers();
  },

  async loadMembers() {
    try {
      this.setData({ isMemberLoading: true, memberError: '' });
      const session = app.globalData.session;
      const members = await getMembers(session.token);
      this.setData({ members, isMemberLoading: false });
      this.applySearchFilter();
    } catch (err) {
      this.setData({ memberError: err.message || '会员列表加载失败', isMemberLoading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value });
    this.applySearchFilter();
  },

  clearSearch() {
    this.setData({ searchText: '' });
    this.applySearchFilter();
  },

  applySearchFilter() {
    const { members, searchText } = this.data;
    const normalizedSearch = searchText.trim().toLowerCase();
    let filtered = members;

    if (normalizedSearch) {
      filtered = members.filter(m =>
        (m.name || '').toLowerCase().includes(normalizedSearch) ||
        (m.memberNo || '').toLowerCase().includes(normalizedSearch) ||
        (m.phone || '').toLowerCase().includes(normalizedSearch)
      );
    }

    const stats = {
      totalCount: filtered.length,
      totalBalance: filtered.reduce((s, m) => s + (m.balance || 0), 0),
      totalPrepaid: filtered.reduce((s, m) => s + (m.prepaid || 0), 0)
    };

    this.setData({ filteredMembers: filtered, filteredStats: stats });
  },

  formatMoney(v) {
    return '¥' + (v || 0).toFixed(2);
  },

  onOpenMemberDetail(e) {
    const memberId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/member/detail/index?id=' + memberId });
  },

  onSelectMember(e) {
    const memberId = e.currentTarget.dataset.id;
    const memberName = e.currentTarget.dataset.name || '';
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];

    if (prevPage) {
      prevPage.onMemberSelected(memberId, memberName);
    }
    wx.navigateBack();
  }
});
