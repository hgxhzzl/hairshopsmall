const app = getApp();
const { getMembers } = require('../../../services/member');

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

Page({
  data: {
    members: [],
    memberError: '',
    isMemberLoading: false,
    isLoadingMore: false,
    searchText: '',
    filteredMembers: [],
    filteredStats: { totalCount: 0, totalBalance: 0, totalPrepaid: 0 },
    page: 1,
    totalPages: 1,
    hasMore: false
  },

  onShow() {
    if (!app.checkLogin()) return;
    this.reload('');
  },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
  },

  onScrollToLower() {
    this.loadMore();
  },

  async fetchList(page, keyword, append) {
    const session = app.globalData.session;
    try {
      if (append) {
        this.setData({ isLoadingMore: true });
      } else {
        this.setData({ isMemberLoading: true, memberError: '' });
      }
      const { data, pagination } = await getMembers(session.token, {
        keyword,
        page,
        pageSize: PAGE_SIZE
      });
      const members = append ? this.data.members.concat(data) : data;
      const totalPages = Math.max(pagination.totalPages || 1, 1);
      this.setData({
        members,
        filteredMembers: members,
        page,
        totalPages,
        hasMore: page < totalPages,
        filteredStats: {
          totalCount: pagination.total || members.length,
          totalBalance: members.reduce((s, m) => s + (m.balance || 0), 0),
          totalPrepaid: members.reduce((s, m) => s + (m.prepaid || 0), 0)
        },
        isMemberLoading: false,
        isLoadingMore: false
      });
    } catch (err) {
      this.setData({
        memberError: err.message || '会员列表加载失败',
        isMemberLoading: false,
        isLoadingMore: false
      });
    }
  },

  reload(keyword) {
    const kw = (keyword !== undefined ? keyword : this.data.searchText).trim();
    return this.fetchList(1, kw, false);
  },

  loadMore() {
    if (!this.data.hasMore || this.data.isLoadingMore || this.data.isMemberLoading) return;
    return this.fetchList(this.data.page + 1, this.data.searchText.trim(), true);
  },

  onSearchInput(e) {
    const value = e.detail.value;
    this.setData({ searchText: value });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this.reload(value);
    }, SEARCH_DEBOUNCE_MS);
  },

  clearSearch() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.setData({ searchText: '' });
    this.reload('');
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

    // 回调判空：上一页不存在或未实现该方法时，不能直接调用导致崩溃
    if (prevPage && typeof prevPage.onMemberSelected === 'function') {
      prevPage.onMemberSelected(memberId, memberName);
      wx.navigateBack();
    } else {
      wx.showToast({ title: '无法返回上一页', icon: 'none' });
    }
  }
});
