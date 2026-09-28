# DesignHub 当前 UI 样式 Token 现状

日期：2026-09-28
用途：供 UI/UX 设计师阅读和对照实现
性质：现状描述，不是新的视觉改版规范

本文从当前源码提取已经实际生效或被主要界面使用的样式 token。设计稿、组件补充和视觉评审应先以本文确认现有基线，再提出新增或修改；不要把历史 Figma 颜色、未接入的设计稿 token 或单个页面的临时值当成全局规范。

## 1. Token 来源与优先级

| 层级 | 当前来源 | 作用 |
| --- | --- | --- |
| 全局主题 | `src/app/styles/tokens.css` | 深色/浅色语义颜色、窗口材质、页面间距、圆角、滚动条和装饰色 |
| 应用壳层 | `src/app/styles/window.css` | 自定义窗口栏、启动屏、欢迎页、主题/语言按钮、焦点和减少动效 |
| Studio 基础组件 | `src/app/styles/studio.css` | 页面容器、按钮、图标按钮、徽标、输入/选择器、抽屉、对话框、标签和空状态 |
| 页面/工作台 | `src/app/studio/*.css` | 画布、Workbench、对话栏、素材/人物库和项目详情的局部尺寸与材质 |
| 组件结构 | `src/app/studio/ui.tsx` | `Button`、`IconButton`、`Badge`、`Field`、`Select`、`Modal`、`EmptyState` 等共享组件接口 |
| 设计说明 | `docs/product/UI-FOUNDATIONS.md`、`DESIGN-DARK.md`、`DESIGN-LIGHT.md` | 视觉方向、交互原则和主题语义的背景说明；如与 CSS 实现冲突，以当前 CSS 为现状依据 |

## 2. 整体视觉基线

当前应用呈现的是本地优先的专业创作工作站：深色为主要视觉基线，浅色复用相同布局和组件层级。界面依靠明度层级、1px 边界、紧凑控件和少量玻璃材质组织信息，而不是大量悬浮卡片。

- 页面主内容区域通常是无外框的，`content-card-background` 为透明，`content-card-shadow` 为无阴影。
- 组件和面板大多使用 `--radius-ui: 10px`；对话区域使用更大的 `--radius-conversation: 14px`。
- 主窗口栏高度 40px；Studio 工具栏高度 44px；紧凑控制高度 28px；标准按钮和图标按钮命中区约 32px。
- 常规交互色由 `primary` 承担；AI/生成使用 `secondary`；完成使用 `success` 或 `tertiary`；警告、错误和信息使用独立语义色。
- 文字、路径、尺寸和运行指标使用较小字号；路径、哈希、状态和运行数据通常使用 JetBrains Mono 或 `.mono`。
- 图标使用 CSS mask 加本地 SVG 图标资源，组件入口是 `Icon` / `IconButton`，不是多套图标库混用。

## 3. 主题颜色

### 3.1 深色主题当前值

来源：`src/app/styles/tokens.css` 的 `:root` 和 `:root[data-theme='dark']`。

| 语义 token | 当前值 | 使用方向 |
| --- | --- | --- |
| `background` / `surface` | `#0f131c` | 应用和工作区基础背景 |
| `surface-container-lowest` | `#0a0e17` | 最深层、部分阴影/滚动条底 |
| `surface-container-low` | `#181b25` | 低层面板、输入和工具背景 |
| `surface-container` | `#1c1f29` | 标准控件/面板表面 |
| `surface-container-high` | `#262a34` | hover、选中或浮层内层 |
| `surface-container-highest` | `#31353f` | 强调面、菜单项、徽标背景 |
| `on-surface` | `#dfe2ef` | 主文字和图标 |
| `on-surface-variant` | `#bcc9cd` | 次级文字、说明、路径 |
| `outline` | `#869397` | 强边界和 hover 边界 |
| `outline-variant` | `#3d494c` | 弱边界、分隔线的来源色 |
| `primary` | `#4cd7f6` | 焦点、主操作、当前选中 |
| `primary-container` | `#06b6d4` | 填充型主操作背景 |
| `secondary` | `#c0c1ff` | AI、生成、辅助动作 |
| `secondary-container` | `#3131c0` | AI/辅助强调面 |
| `tertiary` | `#4edea3` | 完成、可用、正向状态 |
| `success` | `#4ade80` | 成功状态 |
| `warning` | `#fbbf24` | 警告、需注意状态 |
| `error` | `#fca5a5` | 错误、失败和危险提示 |
| `info` | `#93c5fd` | 信息性提示 |
| `accent-warm` | `#fb923c` | 少量暖色强调，不是主品牌色 |

### 3.2 浅色主题当前值

来源：`src/app/styles/tokens.css` 的 `:root[data-theme='light']`，以及未显式设置深色时的 `prefers-color-scheme: light` 规则。

| 语义 token | 当前值 | 使用方向 |
| --- | --- | --- |
| `background` / `surface` | `#faf8ff` | 应用和工作区基础背景 |
| `surface-container-lowest` | `#ffffff` | 最底层和高不透明度内容表面 |
| `surface-container-low` | `#f2f3ff` | 低层面板、输入和工具背景 |
| `surface-container` | `#eaedff` | 标准控件/面板表面 |
| `surface-container-high` | `#e2e7ff` | hover、选中或浮层内层 |
| `surface-container-highest` | `#dae2fd` | 强调面、菜单项、徽标背景 |
| `on-surface` | `#131b2e` | 主文字和图标 |
| `on-surface-variant` | `#464554` | 次级文字、说明、路径 |
| `outline` | `#767586` | 强边界和 hover 边界 |
| `outline-variant` | `#c7c4d7` | 弱边界、分隔线的来源色 |
| `primary` | `#4648d4` | 焦点、主操作、当前选中 |
| `primary-container` | `#6063ee` | 填充型主操作背景 |
| `secondary` | `#4b41e1` | AI、生成、辅助动作 |
| `secondary-container` | `#645efb` | AI/辅助强调面 |
| `tertiary` | `#4651b9` | 主题辅助强调；完成仍主要使用 `success` |
| `success` | `#15803d` | 成功状态 |
| `warning` | `#a16207` | 警告、需注意状态 |
| `error` | `#b91c1c` | 错误、失败和危险提示 |
| `info` | `#1d4ed8` | 信息性提示 |
| `accent-warm` | `#c2410c` | 少量暖色强调 |

### 3.3 主题兼容 token

以下 token 在浅色主题额外存在，设计稿可用于画布和传统文档表面，但它们不是所有深色组件都直接使用的通用替代：

| Token | 浅色值 | 当前用途 |
| --- | --- | --- |
| `canvas-bg` | `#f1f5f9` | 浅色画布背景 |
| `surface-base` | `#ffffff` | 高不透明度面板/内容表面 |
| `surface-subdued` | `#f8fafc` | 嵌套内容面 |
| `accent-tint` | `#eef2ff` | 选中和强调的浅色 tint |
| `border-subtle` | `#e2e8f0` | 浅色设计稿中的弱边界值 |
| `border-strong` | `#cbd5e1` | 浅色设计稿中的强边界值 |
| `text-primary` | `#0f172a` | 浅色内容主文字 |
| `text-secondary` | `#475569` | 浅色内容次级文字 |
| `text-muted` | `#94a3b8` | 浅色内容弱文字 |

注意：`tokens.css` 后面的 `:root` 又定义了 `--border-subtle: color-mix(in srgb, var(--outline-variant) 45%, transparent)`，因此实际应用中很多 Studio 组件读取的是这个混合值，而不是浅色主题表中的固定 `#e2e8f0`。设计稿需要以具体页面截图/实现为准，不应只复制主题文档中的固定值。

## 4. 材质、边界和阴影

### 4.1 窗口和玻璃

| Token | 深色 | 浅色 |
| --- | --- | --- |
| `shell-solid` | `#0e1424` | `#f7f8ff` |
| `shell-glass` | `color-mix(... 68%, transparent)` | 同样 68% 混合 |
| `shell-glass-border` | `rgb(255 255 255 / 0.09)` | `rgb(115 125 160 / 0.22)` |
| `shell-backdrop` | `blur(24px) saturate(125%)` | `blur(24px) saturate(120%)` |

窗口栏本身当前是透明背景、无 backdrop-filter；玻璃材质主要给浮动工具岛、画布控件、对话 dock、抽屉和菜单使用。工作台局部还使用 `blur(12–18px)`、`saturate(125–150%)` 的加强玻璃值。

### 4.2 阴影

- 全局浮层 token：`--shadow-overlay: 0 20px 80px rgba(0, 0, 0, 0.28)`。
- 普通页面主容器无阴影。
- 页面和浮层会根据上下文添加局部阴影，例如 `0 4px 16px`、`0 12px 32px`、`0 16px 38px`、`0 18px 48px` 等；这些不是全局可复用 token。
- 玻璃面板常用 `inset 0 1px 0` 的顶部亮边，帮助从背景中分离。

### 4.3 减少透明

`prefers-reduced-transparency: reduce` 时：

- `--shell-glass` 改为 `var(--shell-solid)`；
- `--shell-backdrop` 改为 `none`；
- 相关局部玻璃样式降级为实色表面。

## 5. 尺寸、间距和布局 token

### 5.1 全局尺寸

| Token | 当前值 |
| --- | --- |
| `toolbar-control-height` | `28px` |
| `toolbar-control-padding-inline` | `8px` |
| `toolbar-control-icon-size` | `14px` |
| `radius-ui` | `10px` |
| `radius-conversation` | `14px` |
| `content-panel-min-height` | `520px` |
| `library-card-width` | `216px` |
| `scrollbar-size` | `6px` |

### 5.2 页面内容内边距

默认值：上 `24px`、左右 `28px`、下 `20px`。

| 视口条件 | 上 | 左右 | 下 |
| --- | ---: | ---: | ---: |
| 默认 | 24px | 28px | 20px |
| `min-width: 1440px` | 28px | 32px | 24px |
| `max-width: 1279px` | 20px | 24px | 16px |
| `max-width: 560px` | 16px | 16px | 16px |

当前 Electron 外壳在 `html, body, #root` 上设置 `min-width: 1024px`、`min-height: 720px`，因此 `max-width: 560px` 的 token 更接近可复用 CSS 或窄嵌入场景，不代表首版 Electron 窗口会缩到手机宽度。

### 5.3 常用局部间距

当前没有独立的 spacing token 集；主要 CSS 值集中在 2、4、6、8、10、12、16、18、20、24px。常见实现如下：

- 工具栏/操作组间距：8px 或 12px；
- 页面 heading 与按钮区域：16px gap、18px 下边距；
- 表单字段和紧凑列表：4–10px；
- 主要页面/项目网格：16–20px；
- 页面内容边距通过 `--page-content-padding-*` 统一管理。

设计师可按 4px 节奏排布，但不要假设源码已经存在 `space-xs`、`space-md` 等 CSS 变量。

## 6. 字体与文字层级

### 6.1 字体栈

根级默认字体：

```css
Inter, 'PingFang SC', 'Microsoft YaHei UI', 'Noto Sans CJK SC', sans-serif
```

当前实际使用还包括：

- 标题、页面 heading、工具栏标题和品牌名：`Geist`，中文回退到 PingFang/微软雅黑等；
- 路径、哈希、运行数据、eyebrow 和状态元数据：`JetBrains Mono`、`SFMono-Regular`、`Consolas` 或 `monospace`；
- 组件继承父级字体，按钮/输入/选择器不另起字体系统。

### 6.2 常见实际字阶

| 场景 | 当前值 |
| --- | --- |
| 窗口/欢迎页 H1 | `24px / 32px`, Geist, 600 |
| 页面主标题 | `22px / 28px`, Geist, 600 |
| Studio 工具栏标题 | `13px / 18px`, Geist, 600 |
| Studio 默认正文 | `13px / 18px` |
| 页面说明 | `12px / 18px` |
| 普通按钮/标签 | `12px`, 多数 500 |
| 次级说明/列表元数据 | `10–11px`, 常见行高 14–18px |
| section kicker / eyebrow | `10–11px`, JetBrains Mono, 常见 `0.08em` tracking |
| 启动屏小型系统状态 | `9–12px`, JetBrains Mono |

文字大小在人物库、项目卡片和画布叠层中会进一步缩到 8–10px；这些属于高密度局部，不应扩展成全局正文标准。

## 7. 共享组件现状

### 7.1 Button

`src/app/styles/studio.css` 中 `.ui-button`：

- 最小高度 32px；
- 水平 padding 12px；
- 图标和文字 gap 8px；
- 1px `border-subtle` 边界；
- `radius-ui` 圆角；
- 默认背景 `surface-container`、前景 `on-surface`；
- 文字 12px、字重 500；
- hover/active 动画约 100ms；
- 文案固定单行，不自动换行。

变体：

| 变体 | 当前表现 |
| --- | --- |
| `primary` | `primary` 背景和边界，`on-primary` 文字 |
| `secondary` | 默认表面；hover 提升到 `surface-container-high` 并使用 `outline` |
| `ghost` | 透明背景/边界，hover 显示 `surface-container-high` |
| `ai` | `secondary` 的低透明混合背景和边界，文字使用 `secondary` |

窗口栏旧式 `.button` 仍存在，最小高度 32px、水平 padding 16px；新页面优先使用 `.ui-button`。

### 7.2 IconButton

- 默认 32 × 32px；窗口栏语言按钮为 32 × 28px；
- 透明背景，默认颜色 `on-surface-variant`；
- hover 或 `aria-pressed=true` 使用 `surface-container-high`；
- pressed 状态颜色为 `primary`；
- 共享 `Tooltip` 和 `aria-label`；
- 图标常用 14–18px，具体由 `Icon` 的 `size` 参数决定。

### 7.3 Badge

- 最小高度 20px；
- 水平 padding 6px；
- 字号 10px、字重 500、单行；
- 默认背景 `surface-container-high`、边界 `border-subtle`；
- 圆角仍使用 `radius-ui`，不是全局 pill。

语义变体：空值默认、`primary`、`ai`、`success`、`warning`、`error`。

### 7.4 Field / Select / Modal / EmptyState

- `Field` 用可见 label 包裹控件，可附加小号 hint；设计稿应为错误/帮助文本预留垂直空间。
- `Select` 是自绘组合控件，支持键盘方向键、Enter、Space、Escape，列表项使用 `listbox/option` 语义；不要把它当作浏览器原生 select 的外观。
- `Modal` 使用原生 `dialog`，打开时聚焦首个输入，关闭后尝试还原触发控件焦点；宽版通过 `ui-dialog--wide`。
- `EmptyState` 以图标、标题、说明和可选操作组成，不使用单独的大插画卡片。

## 8. 状态、焦点和动效

### 8.1 焦点

全局控件的 `:focus-visible` 通常为：

```css
outline: 2px solid var(--primary);
outline-offset: 3px;
```

搜索框和部分特殊控件使用 2px outline、2px offset；不要用低对比度边框替代键盘焦点。

### 8.2 禁用

`button:disabled` 使用 `cursor: not-allowed` 和 `opacity: 0.48`。如果禁用原因对理解操作很重要，界面应在邻近区域提供说明，不能只依赖透明度。

### 8.3 动效

- 普通按钮 hover/active：约 100ms；
- tooltip：约 120ms；
- 页面进入/Studio 视图切换：约 280ms ease-out；
- 启动屏进入：360ms ease-out；
- 进度条宽度过渡：760ms cubic-bezier，用于平滑显示启动进度；
- `prefers-reduced-motion: reduce` 时将动画/过渡压到接近即时，并移除启动屏和指针光效动画。

新增 UI 不应引入持续脉冲、弹跳或会改变内容布局的装饰动画。

## 9. 画布、对话和特殊区域

### 9.1 画布控件

`project-canvas.css` 和 `workbench.css` 使用 `shell-glass`、`shell-glass-border`、`shell-backdrop` 组合浮动工具岛、画布菜单、分析历史和工作台叠层。画布上的主内容仍应保持高可读性，不能把所有图像预览都放进低不透明度玻璃面。

### 9.2 对话 dock

对话 dock 使用独立的 `--radius-conversation: 14px` 作为外形基线；输入聚焦时会通过边界/伪元素强调当前输入状态。`prefers-reduced-motion` 下停止边界角度动画。

### 9.3 人物库和内容卡片

人物库、项目卡片和素材卡片普遍使用 `radius-ui`，头像/状态点另用 `50%` 圆形。人物库存在 8–10px 的密集字号、局部插画色 `--art-*` 和较多局部阴影，不应直接复制为全应用基础组件。

## 10. 当前实现与设计说明的差异

以下是设计师需要特别注意的“文档理想值”和源码现状之间的差异：

1. 设计说明强调 4px 基线和部分 4–6px 圆角；当前共享组件实际主要使用 `--radius-ui: 10px`，普通矩形的圆角以 10px 为准。
2. 设计说明列出 `body-sm`、`label-sm` 等命名字阶，但源码没有同名 CSS token；实际字阶分散在 `studio.css` 和各页面样式中。
3. 设计说明中的 `border-subtle` 固定浅色值会被 `tokens.css` 后定义的 color-mix 覆盖一部分实际组件效果。
4. 设计说明推荐成熟 UI primitives，但当前源码仍由 `src/app/studio/ui.tsx` 自己提供 Button、Select、Modal 等基础组件；设计稿应遵循现有组件行为，不假设已经接入 Radix/shadcn。
5. 文档中建议的 280px/320px 面板等基线在不同页面有局部实现，画布和 Workbench 还会使用自己的玻璃面板宽度；需以具体页面 CSS 为准。
6. 旧样式仍存在少量直接颜色、阴影和局部圆角值。新增组件应优先消费语义 token，但不应在设计评审中假设历史页面已经完全 token 化。

## 11. 给 UI 设计师的使用规则

- 先选语义角色，再选颜色：主操作用 `primary`，AI 用 `secondary`，完成用 `success/tertiary`，不要复制某个页面的十六进制颜色。
- 普通矩形优先按 10px 圆角、1px 边界和紧凑高度设计；只有圆点、头像、进度节点等状态元素使用 50%/999px。
- 主要内容区域保持无卡片外框；真正需要分组时使用子面板或边界，不要卡片套卡片。
- 设计桌面密度时以 1024 × 720 的最小 Electron 窗口为压力基准；按钮、标签和长文案必须测试中文/英文混排。
- 所有图标按钮同时提供可见 Tooltip 和 `aria-label`；危险或不可逆操作保留可见文字。
- 主题切换只改变语义颜色和材质，不改变布局、控件尺寸、字号和交互顺序。
- 玻璃效果必须准备实色降级，并检查复杂背景下的对比度和文字可读性。

## 12. 应用壳层与启动交互

### 12.1 应用层级

当前应用的实际层级是：

```text
App
├─ startup splash
├─ profile onboarding
├─ model onboarding
├─ project-library selection / recovery
└─ Studio
   ├─ WindowBar
   ├─ optional page toolbar
   ├─ page body
   ├─ toast notification
   └─ Drawer / Modal / Popover overlays
```

进入 Studio 后，应用不是“左侧固定导航 + 内容区”的布局。全局导航收在窗口栏右侧的用户头像菜单中；页面本身占据 Studio 主体区域。设计稿若需要表现导航，应使用用户菜单、页面工具栏和返回按钮这三个已存在的入口，不要默认绘制一个当前代码中不存在的常驻侧栏。

### 12.2 首次启动

启动流程由 `App.tsx` 控制：

1. 启动屏显示品牌、`LOCAL FIRST` 状态、进度条和 profile/library/workspace 三项检查。
2. 没有完成资料时进入 profile；资料完成但模型步骤未完成时进入 model；项目库未就绪时进入项目库选择/欢迎状态；全部就绪才进入 Studio。
3. 项目库选择失败、目录非空或位置失效时，错误显示在当前流程附近，并保留重新选择入口。
4. 启动屏进度是可访问的 `progressbar`，主题和语言可在窗口栏切换；减少动效时取消进入动画和指针光效。

### 12.3 WindowBar

WindowBar 高度 40px，使用透明背景。它包含：

- 可拖动空白区域；
- 主题切换图标按钮（system/dark/light 循环）；
- 中英文切换按钮；
- Studio 中的用户头像菜单；
- macOS 左侧或 Windows 右侧原生控制区安全空间。

按钮和输入区域必须标记为不可拖动。语言和主题切换会立即更新界面，但不能重置当前页面、抽屉或画布状态。

## 13. Studio 整体布局与导航

### 13.1 Studio 框架

Studio 的主体结构：

```text
┌─────────────────────────────────────────────────────────────┐
│ WindowBar：拖动区 / 主题 / 语言 / 用户菜单                  │ 40px
├─────────────────────────────────────────────────────────────┤
│ Page toolbar（非项目首页页面显示）                           │ 44px
│   返回项目  ·  页面标题                    页面级操作        │
├─────────────────────────────────────────────────────────────┤
│ studio-body：当前页面或项目内容                              │
│                                                             │
│   StudioHome / LibraryPages / ProjectCanvas / Workbench      │
└─────────────────────────────────────────────────────────────┘
```

项目首页（没有选中项目）不显示普通 page toolbar，而直接显示 StudioHome 的品牌、项目列表和创建区。进入设计师、素材、品牌、连接、任务、交付、工作区管理或设置时，顶部显示返回项目按钮和页面标题。

页面内容由一个主要滚动拥有者负责；Studio 外壳和画布工作台本身保持 `overflow: hidden`，具体列表、抽屉或页面内容区域拥有自己的滚动。

### 13.2 用户菜单导航

头像按钮打开 `role="menu"` 菜单，菜单分为三组：

| 分组 | 页面 |
| --- | --- |
| 创作 | 首页、设计师、素材库、品牌包 |
| 模型 | 模型连接、模型任务 |
| 管理 | 导出交付、工作区管理、设置 |

当前页面用勾选和 `aria-current="page"` 表示。菜单支持：

- 点击头像打开/关闭；
- 点击外部关闭；
- Escape 关闭并把焦点还给头像；
- Arrow Up/Down、Home、End 在菜单项之间移动；
- 用户菜单底部还提供新建项目和导入项目包，读写权限不足时禁用。

点击“模型连接”是特殊行为：它通常保持当前页面上下文，直接打开连接 Drawer/Dialog，而不是把用户带到一个新的完整页面。

### 13.3 页面切换

Studio 以 `view` 和 `surface` 保存当前页面。切换页面时：

- 记录前进/后退方向并播放约 280ms 的页面进入动画；
- 离开项目页面会清除当前选中项目和打开文档状态；
- 返回项目按钮回到项目首页；
- 打开项目先进入项目概览，再由文档卡片进入 Workbench；
- 页面切换不刷新整个应用壳，也不改变主题、语言和项目库。

## 14. 页面布局与交互现状

### 14.1 项目首页（StudioHome）

布局由三块组成：

1. 品牌标识区；
2. 项目列表/搜索/筛选区（有项目时显示）；
3. 对话式创建区和设计师横向 rail。

交互：

- 项目筛选支持进行中、已归档、全部，并记录切换方向；
- 项目搜索实时更新可见项目；
- 点击项目打开项目概览；
- 对话输入可提交文字、附件、设计师选择和画面比例；
- 新建项目打开 Drawer；
- 点击设计师卡片打开设计师信息 Drawer，不离开首页；
- 无项目时显示空创建状态，不能把空列表误认为加载失败；
- 数据加载失败显示恢复按钮，不清空已有可见项目。

### 14.2 项目概览（ProjectCanvas / ProjectDetailPage）

项目概览显示项目封面、状态、设计署名、文档数量和设计文档列表。每个文档卡片是可点击按钮，点击后进入 Workbench。

项目操作菜单通过图标按钮打开 Popover，提供返回首页、重命名、复制、归档等动作。只读项目禁用写入动作，并保留可见的只读状态。

没有真实项目库的预览项目会显示“预览未保存”状态；本地项目显示“已保存”。设计稿卡片不自动打开画布，用户必须显式选择文档。

### 14.3 设计师库

设计师库以筛选/卡片或列表为主，选中设计师后打开右侧详情 Drawer。详情操作不应改变主列表滚动位置。创建设计师是多步骤流程：作品集导入 → 分析 → 形象生成 → 复核；创建流程使用固定宽度 Drawer，步骤返回按钮位于底部操作区。

导入、分析或生成失败时，错误贴近当前步骤，已完成的输入和候选应保留。关闭 Drawer 会结束当前临时流程并恢复触发控件焦点。

### 14.4 素材库

素材库提供：

- 搜索输入；
- 类型筛选；
- 网格/列表视图切换；
- 素材卡片选择；
- 选中后打开素材详情 Drawer。

网格/列表按钮使用 `aria-pressed` 表示当前布局。素材详情中的“放入画布”“作为参考”“替换选中图像”等动作会路由回当前项目文档；如果没有项目或文档，显示恢复提示，而不是静默失败。

### 14.5 品牌包

品牌包以列表/卡片选择为主，详情打开 Drawer；新建/编辑使用 Modal，删除使用二次确认 Modal。删除、归档和覆盖等不可逆操作必须保留可见文字按钮，不只使用图标。

### 14.6 模型连接

模型连接通常作为 Drawer/Dialog 打开，内部按配置类别切换。类别切换是分段控件，当前类别用 `aria-pressed` 和 primary 颜色表示。保存、测试连接和模型选择均在当前 Drawer 中完成，关闭后 Studio 刷新 provider 配置。

没有连接或能力不足时，页面和 Workbench 应提供“打开模型连接”的恢复入口，不能自动选择其他连接。

### 14.7 模型任务

模型任务是全局运行视图，以工具栏筛选和任务列表为主。任务行展示能力、provider/model、状态、更新时间和错误/未知结果。筛选按钮是 `role="group"` 内的 `aria-pressed` 按钮。

任务详情可以跳转回项目、文档或图像工具父作业；返回时应恢复原上下文，而不是只跳回任务列表首页。

### 14.8 导出交付

导出页面在普通内容区显示项目/文档选择和格式选择，具体导出设置通过右侧 Drawer 展开。格式选项是分段选择，当前项用 `aria-pressed` 表示。导出前需明确当前文档和修订；导出失败显示可重试错误，不自动替换目标目录。

### 14.9 工作区管理与设置

工作区管理包含废纸篓和备份等子 tab，tab 使用 `aria-pressed`；恢复、删除、备份等危险动作需要确认或明确状态。设置页面修改主题、语言、操作者名称和诊断入口；修改后即时生效并保留当前页面。

## 15. Workbench 画布工作台交互

### 15.1 工作台布局

```text
┌─────────────────────────────────────────────────────────────┐
│ 文档返回 / 文档名 / 保存状态       缩放 / 重置 / 网格        │
├───────────────┬─────────────────────────────────────────────┤
│ 左侧工具条     │                                               │
│ 图层面板       │                  画布                         │
│               │     当前场景 / 候选场景 / 选择框               │
│               │                                               │
│               │ 右下上下文工具 / 对话 dock / 属性浮层          │
├───────────────┴─────────────────────────────────────────────┤
│ 选中图层 · 可见性 · 本地会话/示例会话                         │
└─────────────────────────────────────────────────────────────┘
```

### 15.2 顶部工具栏

- 返回按钮回到项目概览；
- 文档名和主海报/尺寸稿名称单行省略；
- 保存状态 Badge 区分已保存和预览未保存；
- 缩小/放大以 8 个百分点为步进，范围 20%–160%；
- 重置缩放恢复默认视图；
- 网格是按下状态图标按钮。

### 15.3 左侧工具条和图层

工具条提供选择、文本、形状、图像和图层开关。选择工具会打开属性/图层上下文；文本、形状、图像工具会选中对应图层。图层面板中的每一行包含：

- 选择按钮（`aria-pressed`）；
- 图层类型图标、名称和类型；
- 可见性切换；
- 锁定切换。

没有有效图片图层时，图像工具应保持不可提交并解释选择要求。只读状态保留浏览、查看和切换能力，禁用编辑和写入动作。

### 15.4 画布和候选分支

画布中心显示当前场景；设计生成或图像工具完成后，候选场景可直接显示在画布中，但不自动写入正式场景。候选操作：

- 原图/结果切换；
- 确认候选并创建修订；
- 放弃候选并恢复当前场景；
- 继续编辑，将候选提升为 working scene；
- 从历史中查看、比较和继续候选。

候选到达不应抢走输入焦点或自动切换文档。候选确认失败时保留候选画面，允许用户重试。

### 15.5 右下上下文工具

属性、对话、历史、工具四个图标按钮组成上下文工具条，当前面板使用 `aria-pressed`。属性在部分场景显示为画布上的浮层；历史和工具打开右侧 Drawer；对话在画布底部使用 dock。

- 属性：编辑文字位置、透明度和锁定/可见状态；
- 对话：输入修改说明、附件、设计师和生成比例，提交后显示任务状态；
- 历史：查看候选和正式版本，支持查看、比较、继续和保存版本；
- 工具：调整尺寸、旋转预览、智能裁切、去除背景、替换背景、移除对象、局部重绘、扩展画布和放大图像。

工具参数先在 Modal 中配置，区域工具使用遮罩/选区编辑；提交前校验目标图层、连接和参数。任务完成只显示候选，确认后才提交修订。

### 15.6 状态栏

底部状态栏显示当前选中图层、可见性和本地/示例会话。它是状态反馈，不承担主要操作；重要错误和恢复动作应出现在对应控件附近或 toast 中。

## 16. 共享组件交互契约

### 16.1 Button / IconButton

- Button 适合提交、保存、确认、删除、返回等明确动作；主操作保留文字。
- IconButton 适合缩放、关闭、切换面板、图层可见性等高频工具；必须同时有 `aria-label` 和 Tooltip。
- `aria-pressed` 表示可切换状态，不能用颜色变化单独表示；`disabled` 只表示当前不可操作，不代替错误说明。
- 点击动作可产生页面状态变化、打开抽屉/模态或显示 6 秒 toast；按钮本身不负责持久化反馈。

### 16.2 Select / Segmented / Tabs

- `Select` 点击或 Enter/Space 打开；方向键移动候选；Enter 选择；Escape 关闭；点击外部关闭。
- 分段控件和 tab 使用 `aria-pressed`，当前项使用背景提升和 primary 前景；切换不应导致页面整体刷新。
- 选项 disabled 时保留可见原因或在相邻区域提供恢复入口。

### 16.3 Field / Input

- Field 的 label 始终可见；hint 和错误信息放在控件下方，不使用 placeholder 代替 label。
- 数值输入使用 tabular figures；非法值保留用户输入并在就近位置提示，不静默归零。
- 长文本、项目名、路径和模型名使用 `min-width: 0`、省略号或详情 tooltip；编辑态允许自然换行。

### 16.4 Drawer

Drawer 是当前最常用的上下文详情容器：

- 打开时显示遮罩，锁定 body 滚动；
- 自动聚焦首个可操作控件；
- Tab 在 Drawer 内循环；
- Escape 或点击遮罩关闭；
- 关闭后焦点返回触发控件；
- 内容和 footer 分离，固定操作区放在底部；
- 适合详情、设置、历史、设计师流程和导出配置，不适合不可逆确认。

### 16.5 Modal / Confirm

Modal 使用原生 `dialog`，适合重命名、编辑品牌、删除确认和工具参数配置。打开时聚焦第一个输入或关闭按钮；点击安全区域外、Escape 或显式取消关闭。删除、覆盖、放弃草稿等动作必须在 Modal 中再次确认。

### 16.6 Toast / Inline notice

- Studio toast 出现在全局内容上方，约 6 秒后自动消失，也可用关闭图标立即关闭。
- Toast 适合“已保存”“任务已排队”“项目已导入”等结果通知。
- 需要用户修改输入或采取恢复动作的错误必须使用 inline notice、`role="alert"` 或 `role="status"`，不能只发 toast。

## 17. 设计评审时的交互检查清单

- [ ] 是否能从启动屏、引导、项目库选择顺利进入 Studio，并在失败时保留恢复入口？
- [ ] 是否使用当前头像菜单导航，而不是假设存在常驻侧栏？
- [ ] 页面是否区分项目首页、项目概览和 Workbench 三个层级？
- [ ] 页面级操作是否放入 page toolbar 或项目操作菜单，而不是和内容混在一起？
- [ ] 详情、设置和长流程是否使用 Drawer；删除/覆盖/放弃是否使用 Modal？
- [ ] 所有切换控件是否有 pressed/current 状态和键盘行为？
- [ ] 画布候选是否先预览、后确认修订，没有直接覆盖正式场景？
- [ ] 图像工具是否作用于真实选中图层，并在无目标/只读/无连接时给出恢复入口？
- [ ] 页面切换、主题切换、语言切换和抽屉关闭后焦点是否保持可预测？
- [ ] 中文/英文、长路径、长项目名和窄窗口下关键操作是否仍可见且不重叠？

## 18. 参考文件

- [全局 token](../../src/app/styles/tokens.css)
- [窗口和启动屏样式](../../src/app/styles/window.css)
- [Studio 基础样式](../../src/app/styles/studio.css)
- [共享组件实现](../../src/app/studio/ui.tsx)
- [UI 基础规范](UI-FOUNDATIONS.md)
- [暗色主题说明](DESIGN-DARK.md)
- [浅色主题说明](DESIGN-LIGHT.md)
- [画布样式](../../src/app/studio/project-canvas.css)
- [工作台样式](../../src/app/studio/workbench.css)
- [对话 dock 样式](../../src/app/studio/conversation-dock.css)
