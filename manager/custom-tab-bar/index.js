const { getExpireStatus } = require('../utils/date');

// 服务到期后需要禁用的底部入口图标（会员 / 充值 / 消费）；首页、我的保持可用
const EXPIRE_DISABLED_ICONS = ['member', 'recharge', 'consumption'];

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
      const baseList = this.data.list;
      const index = baseList.findIndex(item => item.pagePath === route);

      // 到期判定直接读会话里的最新 expireTime：首页/「我的」页 onShow 已异步向后端核对并回写，
      // 页面刷新到到期状态后会再次调用本 init()，因此这里无需再发请求。
      const app = getApp();
      const expireTime =
        app && app.globalData && app.globalData.session && app.globalData.session.shop
          ? app.globalData.session.shop.expireTime
          : '';
      const expired = getExpireStatus(expireTime) === 'expired';

      const list = baseList.map(item => ({
        ...item,
        disabled: expired && EXPIRE_DISABLED_ICONS.indexOf(item.icon) !== -1
      }));

      const patch = { list };
      if (index >= 0) patch.selected = index;
      this.setData(patch);
    },

    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (!item) return;
      // 到期后会员/充值/消费入口被禁用：只给一句轻提示，不做跳转
      if (item.disabled) {
        wx.showToast({ title: '服务已到期，续费后恢复使用', icon: 'none' });
        return;
      }
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
