# 微信小程序打包

## 开发与发布

- 开发：`pnpm dev:mp-weixin`，开发者工具导入 `dist/dev/mp-weixin`。
- 发布构建：`pnpm build:mp-weixin`，开发者工具导入 `dist/build/mp-weixin`，再自行预览或上传。
- 独立检查：`pnpm check:mp-weixin`。
- 检查器测试：`node --test scripts/mp-package.test.mjs`。
- H5：`pnpm dev:h5` / `pnpm build:h5`，路由不变。

不要导入尚未重新构建的 `unpackage/dist/dev/mp-weixin`：它可能仍是旧版本。HBuilderX 用户先停止运行，再重新运行，让新的 Vite 压缩配置生效；发布时使用「发行 → 小程序-微信」，不要上传旧开发产物。

本地运行（含 HBuilderX）和发布默认都请求 `https://daishu.oksja.cn`，只启动前端即可连接线上服务。需要联调本机后端时，在项目根目录的 `.env.development.local` 中设置 `VITE_API_BASE=http://localhost:8080`，启动本机后端后重新运行前端。微信登录需在微信开发者工具或真机中验证；H5 的本地调试登录凭证不能用于线上服务。

## 减包方式

首页和消息页位于主包。登录、身份选择、首次引导、协议页及其专用图片位于 `pages/auth` 分包，共用的协议版本校验位于 `common`。岗位、旅居、社区、个人中心、员工工作台、经营管理也分别使用普通分包。现有自定义底栏使用 `uni.reLaunch`，原页面路径与 `?s=1..4` 均保持不变。

`manifest.json` 的 `mp-weixin.packOptions.ignore` 仅排除未被页面使用的 `static/media/kangaroo-atlas.png`。源文件保留，构建目录中也可能仍有该文件，微信上传时不计入包体。其他 377 个静态文件原样保留，不做有损压缩，不改为联网图片。

CLI 入口 `scripts/uni.mjs` 使用绝对 `UNI_INPUT_DIR`，修复 Windows 下使用相对路径导致静态资源没有复制进构建目录的问题。

## 自动检查

Vite 的小程序构建结束后自动检查主包及所有分包是否小于 2 MiB，全部路由与页面文件是否存在，以及每个保留素材是否与源文件 SHA-256 一致。超限、漏图、素材被改写、路由丢失、重新引用已排除图集时直接报错。

检查报告：`.qa/mp-package-build.json` / `.qa/mp-package-dev.json`，HBuilderX 对应 `.qa/mp-package-hbuilder-dev.json`。数值按生成文件的未压缩字节保守统计，扣除明确配置的上传忽略文件；最终服务端大小以微信开发者工具实际预览/上传结果为准。

本次发布构建：主包 1776.4 KiB，六个分包各 120.7–355.2 KiB，总计 2890.8 KiB。使用本机 HBuilderX 编译器进行隔离开发构建复测，主包 1729.6 KiB；Vite 已对小程序开发模式也启用 Terser 压缩。正式预览/上传优先使用发布构建。

本次回归范围：52 页四状态直达、控制台错误、占位页和横向溢出检查；登录→首页、用户底栏来回跳转；素材完整性与包体限制。自动页面检查不代表 208 屏逐像素视觉验收，也不代替微信真机预览。

本次结果：H5 发布产物 208/208 屏自动检查通过，报告在 `.qa/report.json`；底栏循环、简历页返回、分包深链接刷新、无效屏号回退均通过。包体检查器 7/7 单元测试通过。
