# 易顺通美发会员管家 · 店长端小程序（B 端）

面向美发门店的会员管理微信小程序，供店主使用：会员档案、储值充值、消费记账、套餐余量、
经营看板、年度会员账本导出，以及账号注销申请。

后端为同仓库组的 `HairShopApi`（Express + Prisma + PostgreSQL），本项目只包含小程序前端。

## 目录结构

```
HairshopSmall/
├── manager/                  # 小程序根目录（project.config.json 的 miniprogramRoot）
│   ├── app.js                # 全局逻辑，含 apiBaseUrl 配置
│   ├── app.json              # 页面注册（31 页）、自定义 tabBar、窗口样式
│   ├── pages/                # 页面：login / register / dashboard / member / recharge /
│   │                         #       consumption / common / me（含 cancellation 注销申请）
│   ├── components/           # 本地组件：action-btn / app-icon / initial-badge / nav-bar
│   ├── custom-tab-bar/       # 自定义底部 tabBar
│   ├── services/             # 接口封装：按业务域拆分，统一走 services/_request.js
│   ├── utils/                # 工具：constants（共享常量）、qrcode、filters.wxs
│   └── miniprogram_npm/      # 「构建 npm」产物，刻意入库
├── project.config.json       # 团队共享的小程序配置（入库）
└── project.private.config.json # 开发者工具本地配置（不入库，见 .gitignore）
```

## 技术栈

- 原生微信小程序（无框架），模块规范为 CommonJS
- UI：`tdesign-miniprogram`，日期：`dayjs`
- 底部 tabBar 为自定义实现（`app.json` 中 `tabBar.custom: true`）
- 开启 `lazyCodeLoading: requiredComponents`（按需注入）

## 本地运行

1. 安装依赖（在项目根目录）

   ```shell
   npm install
   ```

2. 微信开发者工具 → 「工具」→「构建 npm」，产物写入 `manager/miniprogram_npm/`
   （该目录已入库，克隆后如遇组件缺失再重跑这一步）

3. 微信开发者工具导入本项目根目录，AppID 已在 `project.config.json` 中配置

## 接口地址

默认指向生产环境：`https://api.hairshop.shunshunlu.cn/api`

- 全局配置在 `manager/app.js` 的 `globalData.apiBaseUrl`
- 兜底同值写在 `manager/services/_request.js` 的 `getApiBaseUrl()`

联调本地后端时改 `manager/app.js` 一处即可；开发者工具需勾选「不校验合法域名」
（`project.config.json` 已设 `urlCheck: false`）。

登录态失效（接口返回 401）时，`services/_request.js` 会清除本地会话并跳转登录页。

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)，由 `commitlint` 校验：

```
feat: 新增账号注销在线申请
fix: 修正充值列表金额精度
docs / style / refactor / perf / test / chore
```

`npm run changelog` 可基于提交历史生成 CHANGELOG。

## 合规相关页面

- `pages/privacy-policy/index`：个人信息处理说明（含注销数据处理范围与时限）
- `pages/service-agreement/index`：服务协议
- `pages/me/cancellation/index`：账号注销申请（提交、查询进度、撤回）

## 许可

本项目自研代码以 MIT 许可发布，详见 [LICENSE](./LICENSE)。

`manager/miniprogram_npm/` 里的 TDesign 组件、dayjs，以及手工内置的 qrcode-generator，
均保持各自的 MIT 许可；由于「构建 npm」会剥掉这些包自带的 LICENSE 文件，它们的版权声明
统一记录在 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)，对外分发时请一并保留。
