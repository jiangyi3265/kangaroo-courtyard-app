---
name: 袋鼠小院
description: 手作生活与青年旅居共创平台
colors:
  lacquer-red: "#A94734"
  ochre: "#C99043"
  indigo: "#40576B"
  moss-green: "#4F7A66"
  deep-ink: "#241B17"
  muted-ink: "#6B635C"
  flax-bg: "#F3ECE0"
  paper-card: "#FBF7F0"
  warm-line: "#D9D3C7"
  soft-green: "#E7EFE7"
  soft-ochre: "#F4E8D2"
  soft-blue: "#E7EDF1"
typography:
  headline:
    fontFamily: "STSong, Songti SC, Noto Serif SC, serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "STSong, Songti SC, Noto Serif SC, serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  xs: "4px"
  sm: "8px"
  md: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.lacquer-red}"
    textColor: "{colors.paper-card}"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.lacquer-red}"
    rounded: "{rounded.sm}"
    height: "48px"
    padding: "0 24px"
  card:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: 袋鼠小院

## Overview

**Creative North Star: "一本住进院子里的旅行手册"**

袋鼠小院是明亮、温暖的产品界面，面向白天和旅途中使用手机的青年与门店人员。纸张般的暖色底、深墨文字和克制的手作线描建立人文感；清楚的层级、熟悉的移动端控件和固定主操作保证任务效率。

界面拒绝装饰性炫技。信息密度来自真实业务流程，不来自卡片堆叠。用户端更生活化，员工端更紧凑，但二者使用同一套颜色、圆角、线性图标和状态语义。

**Key Characteristics:**

- 亚麻纸底与纸白内容面，深墨文字始终保持可读性。
- 漆红只用于主操作、当前选择和关键提醒。
- 宋体负责页面标题，黑体负责正文、标签、数字和操作。
- 轻边框与极弱环境阴影建立层次，绝不使用厚重悬浮卡片。
- 所有流程页明确展示当前步骤、责任主体、截止时间和下一步。

## Colors

完整色板由漆红、赭黄、靛蓝和苔绿承担不同语义，暖中性色提供稳定背景。

### Primary

- **漆红**：主 CTA、选中态、关键金额和需要立即处理的提醒。

### Secondary

- **赭黄**：活动、积分、轻度警告和手作气质点缀。
- **靛蓝**：AI、数据、订单与信息类状态。
- **苔绿**：安心商家、成功、认证、保险和可恢复状态。

### Neutral

- **深墨**：主要文字和图标。
- **亚麻纸**：应用背景。
- **纸白**：卡片、输入框和导航内容面。
- **暖线**：分隔线、描边与禁用边界。

**The One Red Action Rule.** 每屏只允许一个大面积漆红主操作。若同时出现多个红色实心按钮，必须重新确定优先级。

## Typography

**Display Font:** STSong / Songti SC，中文宋体回退
**Body Font:** PingFang SC / Microsoft YaHei，系统无衬线回退

**Character:** 宋体只承担品牌与章节气质，所有长文、表单、标签和数据均使用清晰黑体。

### Hierarchy

- **Headline**（700，28px，1.25）：模块标题和重要成功结果。
- **Title**（700，20px，1.35）：页面标题与内容区标题。
- **Body**（400，14px，1.6）：正文、表单值和说明。
- **Label**（500，12px，1.4）：状态、辅助信息和元数据。

**The Reading First Rule.** 任何正文不得为了塞进一屏而低于 14px；优先滚动、换行和分组。

## Elevation

系统以色面和 1px 暖灰边框建立层级，阴影只用于底部导航、浮层和需要与滚动内容分离的固定操作区。静态列表与表单保持平整。

### Shadow Vocabulary

- **浮层弱阴影**（`0 8px 24px rgba(36, 27, 23, 0.08)`）：智能助手、底部浮层和页面固定操作区。
- **卡片环境阴影**（`0 2px 10px rgba(36, 27, 23, 0.04)`）：仅用于图片主卡和关键结果卡。

**The Flat by Default Rule.** 普通卡片没有可见厚阴影；如果一页看起来像漂浮卡片墙，层级就是错误的。

## Components

### Buttons

- **Shape:** 克制圆角（8px），高度 48px。
- **Primary:** 漆红底、纸白字，按下时降低亮度并轻微缩放。
- **Secondary:** 纸白底、漆红或深墨描边文字。
- **Disabled:** 暖灰底与辅助灰字，并配套原因说明。

### Chips

- **Style:** 4–8px 圆角的浅色标签，内容紧凑；筛选胶囊可使用全圆角。
- **State:** 选中态必须同时改变边框、底色和文字色。

### Cards / Containers

- **Corner Style:** 14px。
- **Background:** 纸白，必要时用语义浅色面。
- **Border:** 1px 暖线。
- **Internal Padding:** 12–16px，根据内容密度调整。

### Inputs / Fields

- **Style:** 纸白或极浅亚麻底、1px 暖线、8px 圆角，最小高度 44px。
- **Focus:** 漆红边框；错误状态增加错误文案，不只改变颜色。
- **Disabled:** 明显降低对比度并保留可读值。

### Navigation

用户端底栏为首页、社区、发布、消息、我的；员工端为工作台、业务、消息、数据/我的。发布按钮居中抬高，活动态使用漆红文字与图标。顶部保持微信胶囊安全区，不绘制虚假系统状态栏。

### Flow Progress

编号节点、连接线和短标签组成流程条。当前节点使用漆红，完成节点使用苔绿，未开始节点使用暖灰；当前步骤下方必须出现责任主体和下一步。

## Do's and Don'ts

### Do:

- **Do** 使用 390×844 作为视觉校准基准，并适配微信安全区和小屏。
- **Do** 保持正文至少 14px、主点击区域至少 48px。
- **Do** 让每个空、错、断网、权限拒绝和超时状态提供恢复动作。
- **Do** 复用统一的主按钮、输入框、卡片、标签、流程条和底部导航。
- **Do** 使用图标、文字和颜色三者共同传递状态。

### Don't:

- **Don't** 使用玻璃拟态、霓虹、黑金、大片无意义渐变或重阴影。
- **Don't** 使用过度做旧、剪贴簿、乡土装饰或卡片套卡片。
- **Don't** 把产品做成通用 AI SaaS 模板或展示型落地页。
- **Don't** 在同一屏制造多个同级主操作。
- **Don't** 用颜色作为唯一状态信号，或隐藏失败原因和恢复路径。
