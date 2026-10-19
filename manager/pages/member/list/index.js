const app = getApp();
const { getMembers, getMemberSummary, deleteMember } = require('../../../services/member');

const PAGE_SIZE = 20;
// 搜索输入防抖：停止输入 300ms 后才发起服务端查询，避免每次按键都打接口
const SEARCH_DEBOUNCE_MS = 300;

Page({
  data: {
    members: [],
    memberError: '',
    isMemberLoading: false,
    isLoadingMore: false,
    memberSearchText: '',
    filteredMembers: [],
    memberStats: { totalCount: 0, totalBalance: 0, totalPrepaid: 0 },
    memberGenderStats: { maleCount: 0, femaleCount: 0 },
    page: 1,
    totalPages: 1,
    hasMore: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    if (!app.checkLogin()) return;
    this.refresh();
  },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh());
  },

  /** 滚动到底部加载下一页 */
  onScrollToLower() {
    this.loadMore();
  },

  async refresh() {
    await Promise.all([this.loadSummary(), this.reload('')]);
  },

  async loadSummary() {
    try {
      const session = app.globalData.session;
      const s = await getMemberSummary(session.token);
      this.setData({
        memberStats: {
          totalCount: s.totalCount,
          totalBalance: s.totalBalance,
          totalPrepaid: s.totalPrepaid
        },
        memberGenderStats: {
          maleCount: s.maleCount,
          femaleCount: s.femaleCount
        }
      });
    } catch (err) {
      // 汇总失败不阻断列表展示
    }
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
        isMemberLoading: false,
        isLoadingMore: false
      });
    } catch (err) {
      this.setData({
        memberError: err.message || '读取会员列表失败',
        isMemberLoading: false,
        isLoadingMore: false
      });
    }
  },

  /** 重新从第一页加载（搜索/清除/刷新） */
  reload(keyword) {
    const kw = (keyword !== undefined ? keyword : this.data.memberSearchText).trim();
    return this.fetchList(1, kw, false);
  },

  /** 追加分页 */
  loadMore() {
    if (!this.data.hasMore || this.data.isLoadingMore || this.data.isMemberLoading) return;
    return this.fetchList(this.data.page + 1, this.data.memberSearchText.trim(), true);
  },

  /** 搜索输入（防抖走服务端关键字查询） */
  onSearchInput(e) {
    const value = e.detail.value;
    this.setData({ memberSearchText: value });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this.reload(value);
    }, SEARCH_DEBOUNCE_MS);
  },

  /** 清除搜索 */
  onClearSearch() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.setData({ memberSearchText: '' });
    this.reload('');
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
          app.invalidateDashboardCache();
          wx.showToast({ title: '已删除', icon: 'success' });
          await Promise.all([this.loadSummary(), this.reload()]);
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
