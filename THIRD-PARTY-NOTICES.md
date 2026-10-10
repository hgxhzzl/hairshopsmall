# 第三方组件许可声明（Third-Party Notices）

本项目 `LICENSE` 中的 MIT 许可仅覆盖本工作室自研的代码。下列第三方组件保持各自的原始许可，
按 MIT 的要求在此保留其版权声明与许可声明。

> 注意：`manager/miniprogram_npm/` 是微信开发者工具「构建 npm」的产物，构建时**会剥掉各包自带的
> LICENSE 文件**（实测该目录下没有任何 LICENSE 文件）。因此若本仓库对外分发，必须连同本文件一起
> 分发，否则就丢失了下述组件的署名。请勿删除本文件。

## tdesign-miniprogram

- 用途：小程序 UI 组件库（`manager/miniprogram_npm/tdesign-miniprogram/`）
- 许可：MIT License
- 版权：Copyright (c) 2021-present TDesign

```
MIT License

Copyright (c) 2021-present TDesign

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## dayjs

- 用途：日期格式化（`manager/miniprogram_npm/dayjs/`，根 `package.json` 依赖）
- 许可：MIT License
- 版权：Copyright (c) 2018-present, iamkun

```
MIT License

Copyright (c) 2018-present, iamkun

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## qrcode-generator（手工内置副本）

- 用途：会员二维码生成，源码直接内置在 `manager/utils/qrcode-lib.js`、`manager/utils/qrcode.js`
- 许可：MIT License
- 版权：Copyright (c) 2009 Kazuhiko Arase
- 原始出处：http://www.d-project.com/ 、https://github.com/kazuhikoarase/qrcode-generator

该文件的版权头未被剥除，仍完整保留在源码第 1-16 行。另按原文声明：
「QR Code」是 DENSO WAVE INCORPORATED 的注册商标。

## 关于原始模板

本项目的小程序工程骨架与 npm 工具链配置（`package.json` 脚本、`commitlint.config.js`、
`LICENSE` 文件形态）源自腾讯 TDesign / 云开发模板，模板自身的许可同上，均为 MIT。
项目内的页面、业务逻辑、接口封装（`manager/pages`、`manager/services`、`manager/components`、
`manager/custom-tab-bar`）均为本工作室自研。
