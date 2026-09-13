# 袋鼠小院用户端 · kangaroo-courtyard-app

基于 uni-app 和 Vue 3 的青年旅居客户端，提供 H5 与微信小程序页面及员工移动工作台原型。

## 项目简介

围绕青年旅居、义工换宿、兼职/全职机会、房源预订、活动社区与同行互动组织页面。包含首页与城市发现、岗位详情与报名、面试/签约/保险流程展示、房源预订和订单展示、社区活动、消息中心、个人简历，以及员工工作台、报名管理、房源、评价和经营数据等界面。

已实现的本地交互包括：普通登录预览后直接进入首页、首页可选兴趣城市、报名时填写资料并保存本机草稿、当前账号和身份的消息过滤、未授权员工入口拦截。

**当前是可运行的前端原型。** 登录为本地预览，员工授权服务未接入，报名只能保存草稿；支付、短信、微信认证、业务订单和消息服务尚未与后端完成集成。页面中的其他展示数据不能作为真实业务记录。

## 技术栈

- uni-app `3.0.0-alpha-5020520260829001`
- Vue 3.4.21、JavaScript、Vite 5.2.8
- uni-app H5 与微信小程序编译目标
- Sass、可复用 `k-*` 组件、Lucide 静态图标
- Playwright 1.62.1 浏览器交互检查、Node.js 测试脚本
- pnpm 锁文件及 Node.js CLI 构建辅助脚本

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| kangaroo-courtyard-backend | 后端服务与权限基础 | [kangaroo-courtyard-backend](https://github.com/jiangyi3265/kangaroo-courtyard-backend) |
| kangaroo-courtyard-admin | Web 管理后台 | [kangaroo-courtyard-admin](https://github.com/jiangyi3265/kangaroo-courtyard-admin) |
| kangaroo-courtyard-app | 用户端与员工移动端原型 | [kangaroo-courtyard-app](https://github.com/jiangyi3265/kangaroo-courtyard-app) |

三个仓库共同承载袋鼠小院项目。当前后端和 Web 管理端提供若依基础管理能力；小程序端已实现业务页面与部分本地交互，微信登录、员工授权、旅居业务 API、支付和消息接口尚待集成，不能视为已完成生产联调。

## 快速启动

需要 Node.js（`package.json` 声明 `>=18`）、pnpm；微信端预览还需要微信开发者工具。先在 PowerShell 中准备本地 manifest：

```powershell
Copy-Item config/manifest.example.json manifest.json
```

该示例故意不包含真实 AppID。H5 可直接运行；微信预览按开发者工具要求填写自己的小程序 AppID 或使用可用的测试身份。不要在 manifest 中存放 AppSecret、私钥或服务端 Token。保留已有项目时无需覆盖现有 manifest。

```bash
pnpm install --frozen-lockfile
pnpm dev:h5
```

微信开发与构建：

```bash
pnpm dev:mp-weixin
pnpm build:mp-weixin
pnpm check:mp-weixin
```

使用微信开发者工具导入 `dist/build/mp-weixin`。H5 发布构建：

```bash
pnpm build:h5
```

构建脚本自动设置绝对 `UNI_INPUT_DIR`，微信构建会检查主包、分包体积和静态资源完整性。更多说明见 [PACKAGING.md](PACKAGING.md)。

验证命令：

```bash
node --test scripts/experience.test.mjs
node --test scripts/mp-package.test.mjs scripts/check-wxml-bindings.test.mjs
```

浏览器流程检查需先启动 H5 服务，并安装 Playwright Chromium：

```bash
pnpm exec playwright install chromium
```

```powershell
$env:FLOW_TEST_URL = 'http://127.0.0.1:5173/'
node scripts/check-entry-flow.mjs
```

`FLOW_TEST_URL` 应与实际开发服务地址一致。测试截图在 `artifacts/`，不会提交。功能边界及注册流程见 [FLOW-CHANGES.md](FLOW-CHANGES.md)。

## 项目结构

```text
pages/auth/       登录、可选兴趣与员工入口
pages/home/       首页、城市和助手页面
pages/jobs/       岗位、报名与履约流程
pages/stays/      房源、预订和订单页面
pages/community/ 社区、活动、同行与聊天页面
pages/messages/  消息中心与提醒
pages/profile/   个人资料、简历与订单入口
pages/staff/     员工移动工作台界面
pages/manage/    经营、任务、钱包与数据界面
components/      复用的 k-* UI 组件
common/          路由、页面状态、账号和本地偏好逻辑
static/          页面图片和静态资源
styles/          共享主题
scripts/         uni-app 构建、包检查与交互验证
config/          无真实 AppID 的 manifest 示例
pages.json       页面及微信分包配置
```

## 简历描述示例

开发袋鼠小院 uni-app 多端界面与复用组件，覆盖旅居发现、岗位报名、社区活动及员工移动工作台；优化注册与报名信息收集流程，实现本地草稿、兴趣持久化、消息隔离，并通过 Playwright 交互检查和微信分包体积检查验证。尚未完成的服务端、支付或微信认证集成不列为已交付能力。

## 数据与资源说明

本机偏好和报名草稿按预览账号隔离，生产系统需接入真实认证与服务端数据。`manifest.json`、依赖、构建目录、测试截图与本机配置均已忽略。静态图片用于现有项目展示；仓库未对这些资源额外授予许可，复用前请确认相应授权。
