# 袋鼠小院 UniApp · 设计图 1:1 还原规范

目标：把 `../袋鼠小院-手作人文完整版全量UI-53张/袋鼠小院-手作人文完整版全量UI/` 下 52 张总览图（01–52，每张 4 个 390×844 手机屏）逐屏、逐像素还原为 uni-app（Vue3 `<script setup>`）页面。文字内容、布局、间距、颜色、图标、图片全部以设计图为准，不允许"差不多"。

## 1. 页面与屏的对应

- 一张设计图 = 一个页面文件（映射见 `common/routes.js`）。页面用 `const s = useScreen(4)` 读取 `?s=N` 打开第 N 屏；页内也要能通过真实交互（按钮/页签/步骤）切换到各屏。
- 每一屏都必须完整实现，包含：状态栏下方的导航栏、全部内容、底部按钮/底栏。
- 设计图各屏是"一个页面的 4 个状态"（页签、步骤、弹层、空态等）时，用 `v-if="s===N"` 或页签状态实现；确保 `?s=N` 直达。

## 2. 看设计图

- 每屏 2 倍放大截图：`.qa/design-crops/NN-k.png`（NN=图号 01–52，k=1..4；`meta.json` 记录每屏在原图中的坐标；`python .qa/crop-phones.py .qa/design-crops` 可重新生成）。**先逐屏看清楚**，需要看细节时再看原图。
- 设计稿宽 390px，放大截图约 820px 宽：截图上的尺寸 ÷ 2 ≈ 设计 px。**CSS 全部用 px**（不要 rpx），字号/间距/圆角按设计稿读数。

## 3. 设计令牌（`styles/theme.scss`，全局已注入，CSS 变量直接用）

| 变量 | 值 | 用途 |
|---|---|---|
| `--k-bg` | #FAF7F1 | 页面背景（亚麻纸） |
| `--k-paper` | #FDFBF7 | 卡片/输入框（纸白） |
| `--k-paper2` | #F4EEE4 | 次级浅底（搜索按钮、次级块、标签底） |
| `--k-ink` / `--k-muted` / `--k-light` | #241B17 / #6B635C / #9A8E84 | 主文字 / 辅助 / 占位 |
| `--k-line` / `--k-line2` | #E4DCCF / #D9D3C7 | 分隔线 / 描边 |
| `--k-red` `--k-red-soft` | #A94734 / #F5E6E1 | 漆红主操作、选中、金额、角标 |
| `--k-ochre` `--k-ochre-soft` | #C99043 / #F4E8D2 | 赭黄 活动/积分/警示 |
| `--k-indigo` `--k-indigo-soft` | #40576B / #E7EDF1 | 靛蓝 AI/数据/信息 |
| `--k-green` `--k-green-soft` | #4F7A66 / #E7EFE7 | 苔绿 安心/成功/认证 |
| `--k-serif` | 宋体栈 | 页面标题、卡片标题、区块标题、品牌字 |
| `--k-sans` | 黑体栈 | 正文、标签、数字 |
| `--k-safe-bottom` | 安全区 | H5 为 34px，小程序为 env() |

字号常用：导航标题 17 宋体粗；区块标题 16 宋体粗；卡片标题 15–16 宋体粗；正文 14；辅助 12–13；标签 11；金额 20 红色 Georgia 粗。圆角：卡片 14，按钮 8，标签 5–6，胶囊 999。主按钮高 48。

常用工具类：`.k-page .k-body(padding 12px 16px) .k-pad-tab .k-pad-bottom .k-row .k-col .k-between .k-flex1 .k-gapN .k-mtN .k-grid-2/3/4 .k-title .k-h1 .k-h2 .k-text .k-small .k-meta .k-tiny .k-muted .k-red .k-green .k-price .k-link .k-ellipsis .k-clamp2 .k-section(+__title/__more) .k-kv(+__label/__value) .k-circle(--green/--outline/--soft-*) .k-tabs(+__item.active) .k-badge .k-dot .k-input .k-bar .k-radio .k-check .k-switch .k-mask .k-sheet .k-dialog`。详见 `styles/theme.scss`。

## 4. 组件（全局自动注册，目录 `components/k-*`）

- `<k-topbar title="岗位详情" back :dark="false" :fixed="false" @back="...">`：包含状态栏占位（H5 绘制 9:41/刘海/信号，小程序用真实高度）、导航栏（返回 ‹、宋体标题、H5 绘制胶囊）。插槽 `left`（品牌字/城市等自定义左侧）、`right`（替换胶囊，小程序上不要绘制胶囊）、默认插槽（导航下方的页签/搜索，随导航 sticky）。`fixed` 用于图片沉浸式头部。
- `<k-tabbar active="home|community|messages|profile" mode="user" badge="6">` / `mode="staff"`（工作台 business messages profile）。含安全区与 H5 Home 条。
- `<k-bottom>`：固定底部操作区（按钮），自动处理安全区和 Home 条。页面内容记得加 `.k-pad-bottom`（有底部按钮）或 `.k-pad-tab`（有底栏）。
- `<k-button type="primary|secondary|outline|ghost|green|indigo|ochre|dark|soft|disabled" size="lg|md|sm|xs" block round icon="lucide-name">文字</k-button>`
- `<k-card tone="paper|flax|green|ochre|blue|red" :pad="14" :radius="14" flat>`
- `<k-chip tone="neutral|green|blue|ochre|red|ink" icon="shield-check" pill outline selected>安心商家</k-chip>`
- `<k-icon name="calendar-days" :size="18" color="ink|muted|light|red|green|ochre|indigo|paper|white|#hex" :stroke="1.6" fill/>`：480 个 lucide 图标，名字见 `common/icons.js`（键名）。设计图是 1.5px 线性圆角图标，默认 stroke 1.6 已匹配。
- `<k-field v-model label="标题" required hint="（选填）" placeholder type="text|number|textarea" error :maxlength="200" counter row>`
- `<k-steps :steps="['浏览岗位','投递报名','商家筛选','面试沟通','确认录用','入职适应']" :current="2" compact/>`：已完成绿、当前红、未开始灰。
- `<k-status title desc image="/static/media/x.jpg" icon="wifi-off" tone="red">`（插槽放按钮）
- `<k-img src="/static/media/x.jpg" :w="100" :h="80" :radius="10" shade>`（插槽为图上文字）
- `<k-section title="近期活动" action="更多" @action>`

不要自己再造同类组件；页面独有的结构直接在页面里写 scoped 样式。

## 5. 图片素材（照片、头像、插画）

从设计图裁切，路径 `static/media/<名字>.jpg`：

```bash
python .qa/crop-asset.py <NN> <k> <x0> <y0> <x1> <y1> <名字>     # 坐标为 crops/NN-k.png 上的像素
python .qa/crop-asset.py 07 1 96 430 810 760 job-cafe               # 例：07 图第 1 屏的店铺照片
```

裁完用 Read 看一眼确认内容正确。头像裁成正方形后用 `radius="50%"`。文件名用英文，前缀页面名避免冲突（如 `stays-room-1`）。已有素材：`login-hero`、`avatar-1`（女）、`avatar-2`（女店长）、`avatar-3`（男）。`static/media/kangaroo-atlas.png` 为透明袋鼠吉祥物图集（4 列 2 行，可用 `background-position` 取一格），空状态优先直接裁设计图上的插画。

## 6. 截图比对（必须做）

dev 服务器已在 `http://127.0.0.1:5173` 运行（改文件即热更新，不要再起一个）。

```bash
node .qa/shot.mjs "/pages/jobs/detail?s=2" .qa/out/07-2.png            # 390×844 首屏截图，输出含 overflowX 与控制台错误
node .qa/shot.mjs "/pages/jobs/detail?s=2" .qa/out/07-2-full.png --full # 整页长图
python .qa/pair.py 07 2 .qa/out/07-2.png .qa/out/07-2-pair.png          # 左设计右实现并排
```

每一屏都要 `pair` 后用 Read 看图对比，修到布局、字号、间距、颜色、图标、文案与设计一致；`errors` 必须为空，`overflowX` 必须为 false。内容超过一屏时，首屏应与设计图首屏一致，其余内容按设计顺序继续向下排列（可滚动）。

## 7. 小程序兼容硬规则

- 只用 `view / text / image / scroll-view / input / textarea / button / navigator / swiper`，不用 div/span/p/img/svg/br。
- 文字必须放在 `<text>` 里；换行用 `\n` + `.k-pre`。
- `image` 必须给宽高；图标一律 `<k-icon>`（data URI SVG，勿引用 static/icons）。
- 样式写在 `<style scoped lang="scss">`；可用全局工具类；不要用 `:deep` 修改组件内部，改用 props 或自写结构。
- 不要用 `document/window`；导航用 `common/screen.js` 的 `go/replace/relaunch/back/toast` 与 `common/routes.js` 的 `R`。
- `onLoad` 用 `useScreen`，其它生命周期从 `@dcloudio/uni-app` 引入。

## 8. 交付标准（每张图）

1. 4 屏全部实现且 `?s=1..4` 直达。
2. 与设计图逐项比对：导航标题、页签、卡片顺序与内容、每条文案、数字、日期、标签颜色、按钮文字与类型、底栏。
3. 页内按钮跳转到 `routes.js` 中语义正确的页面（如"立即报名"→`R.jobApply`）。
4. `.qa/out/NN-k-pair.png` 已生成并自查过。
