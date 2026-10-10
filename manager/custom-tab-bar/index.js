Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/dashboard/index', text: '首页', icon: 'home' },
      { pagePath: '/pages/member/list/index', text: '会员', icon: 'member' },
      { pagePath: '/pages/recharge/list/index', text: '充值', icon: 'recharge' },
      { pagePath: '/pages/consumption/list/index', text: '消费', icon: 'consumption' },
      { pagePath: '/pages/me/index/index', text: '我的', icon: 'me' }
    ]
  },

  methods: {
    init() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      if (!currentPage) return;

      const route = '/' + currentPage.route;
      const list = this.data.list;
      const index = list.findIndex(item => item.pagePath === route);
      if (index >= 0) {
        this.setData({ selected: index });
      }
    },

    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (!item) return;
      if (this.data.selected === index) return;

      wx.switchTab({
        url: item.pagePath,
        fail: () => {
          wx.navigateTo({ url: item.pagePath });
        }
      });
    }
  }
});
