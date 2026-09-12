# 模块测试、checklist 与回归登记

创建：2026-09-08；更新：2026-09-12。本文件是实施与回归协议。Electron 框架已选；M01–M08 的可验证契约已落地，未覆盖的平台、真实模型、签名与人工质量前提继续单列。

| 模块 | 当前状态 | 实现前测试/清单文件 | 必须回归的直接消费者 |
| --- | --- | --- | --- |
| M01 | 部分验证；基础外壳、bridge、规则、构建与 macOS 原生 smoke 已完成，双平台/发布门禁开放 | [M01 记录](M01.md) | M02–M08 |
| M02 | 实施中；Tasks 1–5 工作区格式、单写者锁、项目/废纸篓/备份存储与 Electron 工作区入口已完成；项目持久化 UI、Windows 与发布验证开放 | [M02 记录](M02.md) | M03、M04、M06、M07、M08 |
| M03 | 部分验证；设计师发布/默认/归档、作品集权利确认、工作区持久化与只读/内置/不可变回归已完成，历史集成与真实分析仍开放 | `docs/verification/M03.md` | M04、M06、M07、M08 |
| M04 | 部分验证；简报确认、项目容器、项目元数据快照与重开/归档回归已完成，素材、修订与 M06 对话依赖仍开放 | `docs/verification/M04.md` | M02 的完整备份校验、M05、M06、M07、M08 |
| M05 | 部分验证；画布 schema、Konva 编辑、中文文本、遮罩、撤销/恢复与工作区文档场景持久化已实现；大图、IME、跨平台原生与视觉性能开放 | `docs/verification/M05.md` | M06、M07、M08 |
| M06 | 部分验证；连接边界、上下文隔离、任务状态/幂等、设计师交接与草稿任务已实现；真实提供方、系统钥匙串、持久化任务与完整对话闭环开放 | `docs/verification/M06.md` | M03、M04、M07、M08 |
| M07 | 部分验证；工具目标、版本绑定导出、项目/只读包策略已实现；真实编码器、归档闭包、原生 worker 与人工图像质量开放 | `docs/verification/M07.md` | M02、M04、M08 |
| M08 | 部分验证；本地检索、诊断白名单、设置与发布验收入口已实现；原生双平台、签名、真实模型和全链路证据开放 | `docs/verification/M08.md` | 改动涉及的基础模块与整条交付旅程 |

## 模块记录的必填内容

实施前创建每个模块记录，填写：模块目标、批准范围、具体测试 ID、前置状态、输入、操作、预期输出、文件及契约、依赖研究来源和 checklist。先有测试与 checklist，再写应用实现。功能后端、前端与原生差异按同一用例关联证据，不通过新增目录层级代替职责清楚。

每条执行结果包括代码提交或文件快照、日期、OS、依赖版本、命令及退出码、输出摘要或附件位置、通过/失败/未执行、失败恢复。真模型用量及费用只记录提供方可证实信息，不存 Key。

任务完成状态只有：未开始、实施中、部分验证、已验证、需回归、被前提阻塞。模块全部用例覆盖后才能标已验证；假适配器和单平台通过标部分验证。

## checklist 模板

- [ ] 对应官方资料与候选取舍有日期及准确版本。
- [ ] 实现前已经写出可观察行为测试与验收清单。
- [ ] 行为测试 Red 失败与原因已记录；不是安装/路径报错代替 Red。
- [ ] Green 输出、类型检查、箭头函数规则和修改 diff 已核对。
- [ ] 业务成功、错误、取消、重复操作与恢复场景已验证。
- [ ] 适用的临时目录/真数据库/原生系统能力已验证。
- [ ] 当前模块的 UI 空态、只读、模型不可用、键盘与双语已验证。
- [ ] 涉及视觉实现时，已有 UI 设计师对该模块相关页面、状态、双语和响应式行为的交付或明确确认；M01 窗口外壳可直接依据已确认的 UI 基础规范。
- [ ] 适用的 [UI01–UI10](../product/UI-FOUNDATIONS.md#14-实现前测试与验收矩阵)已先写测试并在对应平台、主题、语言和缩放组合留证据。
- [ ] 受影响的已验证模块已登记并回归。
- [ ] 没有超出首版计划的抽象、接口或未使用依赖。
- [ ] 未执行项有真实原因，未被记为通过。

## 变更回归记录

后续每个影响已验证模块的改动追加一行，字段为：变更 ID、原因、目标文件、变更前验证版本、影响模块/契约、需重跑测试 ID、实际结果、证据路径、是否恢复已验证。没有历史变更时不伪造示例为真实记录。

2026-09-09：按用户决定从 Tauri 切换 Electron；新增 ADR 0024、Electron 资料报告并改写 M01 前置。Tauri/SQLite 一次性探针保留为历史，不能作为 Electron 回归证据。没有既有已验证的应用模块，因此不伪造“回归通过”；Electron 宿主/事务/凭据实现确定后须覆盖 M02–M08 直接消费者。

2026-09-09：用户确认 UI 基线；新增 Figma DesignHub Frame allowlist、明暗主题共用布局、无标题栏和原生毛玻璃降级、四字按钮、防异常换行、抽屉、动效及 UI01–UI10。影响 M01 窗口外壳和基础组件、M05 画布布局及 M02–M08 的界面验收。当前没有已验证应用模块，不登记回归通过；后续首次实现及任何相关改动按 M01 E11–E16 与适用 UI 编号留证据。

2026-09-09：用户确认本机操作者档案、分模块 UI 交付门槛与本地诊断包边界。本机操作者只提供显示身份，历史保存名称快照；首版诊断仅预览并主动导出，不自动联网发送。影响 M04 修订/时间线、M08 设置/诊断以及 M02–M08 的视觉实施前置。当前无已验证应用模块，不登记回归通过；首次实现按相关计划和 checklist 留证据。

2026-09-09：用户确认 Q1–Q66 冻结为 DesignHub V1 实施基线。依赖版本和工程实验继续按 G01–G11 与模块门槛选择，不视为重新打开产品范围；新增或修改产品能力必须先登记基线变更、受影响模块、测试与回归范围。

2026-09-09：M02 Task 1 引入 `better-sqlite3`、Forge native-unpack 插件并收窄 unit 测试扫描范围，影响 M01 构建、打包配置和测试入口。M01 unit/integration/lint/typecheck/build 全部回归通过，macOS Playwright Electron smoke 1/1 通过；Forge package 仍在 GitHub Electron artifact 获取阶段因 `ENOTFOUND` 失败，Windows、安装与发布状态不恢复为已验证。证据见 [M01](M01.md) 与 [M02](M02.md)。

2026-09-10：M02 Task 2 增加 main-only 项目存储、Electron storage smoke、Vite native external 和 Forge 精确保留规则，影响 M01 main/build/package。unit 13/13、integration 29/29、lint/typecheck/build 通过；本地镜像下 macOS arm64 package 与 source/packaged storage smoke 2/2 曾通过，并确认 `.node` 位于 `app.asar.unpacked`。随后只增加项目完整性校验与回归测试，最终树重打包和 native 套件请求被审批策略拒绝，因此 Windows、最终 artifact、签名安装和 UI 仍保持开放，未伪记为已验证。

2026-09-12：UI 布局回归（变更 ID UI-20260912-01）。目标文件为 `src/app/styles/tokens.css`、`src/app/styles/studio.css`、`src/app/studio/library.css`、`src/app/studio/persona.css`；影响 M01 基础 UI、M03 设计师库、M04 项目/素材页及 M07 导出/模型页的布局契约。主内容容器改为无外层卡片背景/边框/圆角/阴影，独立项目卡保留卡片样式；页面内容、设计师列表和检查器明确内部滚动所有者，并统一 6px 双主题滚动条 token。先执行契约 Red，再实现 Green；layout-contract 3/3、unit 56/56、integration 65/65、lint、typecheck、build、diff check 均通过。Playwright E2E 因环境缺少 Chromium 可执行文件未完成，下载尝试无结果，未记为通过；需在具备浏览器运行时后补 UI01–UI10 及双语/主题回归。
2026-09-12：UI 布局回归（变更 ID UI-20260912-02）。针对截图反馈，目标文件为 `src/app/studio/library.css`、`src/app/studio/persona.css` 与 `tests/integration/layout-contract.test.ts`。主分栏区域改为 flex 填满页面可用高度并保持左右拉伸对齐；素材网格与搜索框共享左基线；品牌列表与详情顶部对齐；交付空态与原稿 footer 样式隔离；设置页移除孤立首尾分割线；设计师页使用高特异性规则关闭外层滚动，仅保留列表/检查器内部滚动。先新增 4 条失败契约再实现；layout-contract 4/4、unit 56/56、integration 66/66、lint、typecheck、build、diff check 均通过。浏览器截图回归仍受同一 Playwright Chromium 前提阻塞，未记为通过。
2026-09-12：设计师页滚动边界回归（变更 ID UI-20260912-03）。用户反馈设计师页面外侧仍存在滚动；目标文件为 `src/app/styles/window.css`、`src/app/styles/studio.css`、`tests/integration/layout-contract.test.ts`、`tests/e2e/studio.spec.ts` 与 UI 验收文档。根节点/应用壳层/Studio 现在固定在窗口视口并裁剪外层溢出，Studio 不再使用 680px 人工最小高度；设计师列表和检查器保留内部滚动所有权。先收紧正则并新增 1 条失败契约，随后实现 Green；layout-contract 5/5、integration 67/67、unit 56/56、lint、typecheck、build、diff check 均通过；设计师专项浏览器旅程 1/1 通过。同步将与“标题由面包屑承载”冲突的 E2E 可见性断言改为节点存在性，并在导航矩阵加入 1280/1024 外层纵向溢出断言；最近一次完整浏览器套件 14/16，余下 2 条为 headless 毛玻璃断言环境差异，未归因于本次滚动改动。新增矩阵断言后的完整重跑因本地提权审批超时未执行，不伪记为通过。
2026-09-12：M02 Task 5 工作区入口与 Electron bridge（变更 ID M02-20260912-01）。目标文件为 `src/platform/contracts.ts`、`src/platform/desktop.ts`、`src/desktop/preload.ts`、`src/desktop/ipc/workspace.ts`、`src/desktop/main.ts`、`src/app/App.tsx`、`src/app/studio/Studio.tsx`、`vite.preload.config.ts` 及相关测试。新增受信 sender/origin 下的创建/打开 handler、typed preload API、main-only `WorkspaceHandle` 替换与关闭、欢迎页真实创建/打开流程；真实工作区不再注入示例项目。先执行 focused Red（4 failures），再 Green；unit 60/60、integration 68/68、lint、typecheck、build、diff check 通过；macOS native 2 passed/1 skipped。构建回归发现 preload 清空共享输出目录会删除 `main.cjs`，新增配置契约并修复为保留主进程产物。E03 目前为代码审查证据，双工作区原生切换 harness、Windows、打包 artifact 与项目持久化 UI 仍开放。

2026-09-12：M04 manual project persistence follow-up（变更 ID M04-20260912-01）。新增 active-project list/create contracts over the existing M02 project index, trusted `project:list-active`/`project:create` IPC, and Studio hydration/manual creation for writable workspaces. Focused storage/IPC/Studio suites 3 files/15 tests passed; unit 55/149, integration 22/96, lint, typecheck, build, and diff check passed. Read-only listing uses validated manifests without mutating the index. Packaged/native persistence, Windows, and richer document/brief/designer metadata remain open.

2026-09-12：M03 workspace persistence follow-up（变更 ID M03-20260912-01）。设计师档案、默认值与编辑草稿改由 `.designhub/designers.json` 和受信 IPC 管理；后续修复内置档案兜底、只读 UI、发布版本不可变及引用档案归档。聚焦存储/IPC/UI 通过；真实原子故障注入、M06 分析和跨平台门禁仍开放。

2026-09-12：M04 project metadata follow-up（变更 ID M04-20260912-02）。项目 manifest 增加 brief、设计师/品牌快照、文档尺寸、归档和时间戳；新增 get/update metadata IPC；重开、重命名和归档测试通过。资产字节、修订内容、备份/包闭包和 Windows/打包验证仍开放。

2026-09-12：M04/M05/M06 storage bridge follow-ups（变更 ID M04-20260912-03、M05-20260912-02、M06-20260912-01）。资产 manifest/内容寻址、工作区文档场景、真实项目工作台和 provider 凭据设置 UI 接入；受影响的资产、场景、工作台、连接与全量静态/单元/集成回归已重跑通过。真实 codec、Konva 导出、系统钥匙串、模型网络、Windows 与签名发布仍开放。
2026-09-12：M06 creation-draft 回接（变更 ID M06-20260912-02）。对话创建现在通过稳定的 `creation-draft` 来源提交持久任务，UI 不再在对话模式直接创建项目；项目工作台对话继续使用 `project` 来源。回归范围为 task service、agent IPC、Studio/NewDesignPage、任务列表；focused 6 files/8 tests、lint、typecheck、diff check 通过。真实 provider、审阅后建项目、原生密钥链与跨平台任务恢复仍开放。
2026-09-12：M07 codec/export follow-up（变更 ID M07-20260912-02）。导出入口现在实际调用 Sharp/pdf-lib 将 renderer 输出转换为目标 PNG/JPEG/WebP/PDF，并拒绝未知源格式；新增真实透明 PNG→JPEG 与 GIF 拒绝回归。M07 codec/export focused 6/6、unit、integration、lint、typecheck、build、diff check 通过；ICC/字体、原生 worker、真实文件对话框与归档流式包仍开放。
2026-09-12：M06 task cancellation UI（变更 ID M06-20260912-03）。任务列表为排队/运行任务增加停止操作，成功调用 host bridge 后将条目标记为 cancelled；新增 LibraryPages 回归，focused unit、lint、typecheck、diff check 通过。远端取消语义仍按 provider 能力保持未验证。
2026-09-12：M06 draft review metadata（变更 ID M06-20260912-04）。持久任务增加脱敏的用户可见 `requestText`，任务列表显示简报/请求摘要，支持重启后的草稿审阅；没有保存凭据或隐藏提示。focused task/storage/UI、lint、typecheck、diff check 通过。
2026-09-12：M06 bridge contract regression（变更 ID M06-20260912-05）。任务 API 新增后更新 Electron native smoke bridge 白名单；`pnpm test:native` 2 passed/1 skipped，未改变 renderer 能力边界。打包 storage、系统钥匙链和 Windows 仍开放。
2026-09-12：M06 explicit retry state（变更 ID M06-20260912-06）。`TaskRuntime.retry` 为失败/取消任务生成新的 queued attempt，保留原记录并复用 request ID，不自动调用 provider；新增 runtime 回归，unit、lint、typecheck、diff check 通过。真实 provider 幂等查询与 UI 重试入口仍开放。
2026-09-12：macOS packaged gate（变更 ID M08-20260912-01）。`pnpm package` 生成 Electron 44.3.0 macOS arm64 包，使用实际 packaged executable 的 native smoke/storage 3/3 通过；SHA-256 `588478afc5f2bc73b6433d6e565a214dc830144be39a3d79805723292754ccd8`。M01/M02/M08 的 macOS 包内路径与 native SQLite 门禁恢复为已验证；Windows、签名/公证、钥匙串和升级卸载仍需真实环境。

2026-09-12：最终回归（变更 ID REL-20260912-01）。最终树执行 unit 63 文件/181 测试、integration 22 文件/96 测试、browser E2E 24/24、native 2 passed/1 skipped、lint/typecheck/build/diff check 全部通过；仅 packaged storage、真实模型/codec、系统钥匙串、Windows 与签名发布保留为外部门禁。

2026-09-12：M05 工作台属性持久化（变更 ID M05-20260912-07）。`Workbench` 的标题、位置和不透明度编辑现在更新活动 `TextLayer` 并通过 `saveDocumentScene` 写回工作区文档；画布拖拽/加载继续同步检查器状态。先新增真实项目标题编辑失败测试再实现；全量 unit 70 files/221 tests、lint、typecheck 通过。影响 M05 P04 及 M06/M07 工作台消费者，已完成直接回归；原生进程恢复、打包存储和 Windows 仍开放。
2026-09-12：M06 重试执行（变更 ID M06-20260912-07）。新增 `TaskRuntime.run`、`AgentTaskService.retry`、受信 retry IPC/preload bridge 和任务列表重试按钮；失败/取消任务复用已持久化 requestText 与 provider/source，创建新 attempt 并真实再次执行适配器，原终态记录保持不变。先写服务/IPC/UI Red，再 Green；focused 4 files/28 tests、lint、typecheck 通过。真实 provider 幂等、远端取消、系统钥匙串和 Windows 仍开放。
2026-09-12：M06 creation-draft 审阅确认（变更 ID M06-20260912-08）。Studio 读取已完成 `creation-draft` 任务结果，在新建设计页展示可审阅简报；用户明确确认后才切换到手动创建项目路径。先新增 `NewDesignPage` Red，再 Green；相关 unit、lint、typecheck 通过。真实 provider、跨进程恢复和原生打包仍开放。
2026-09-12：M07 桌面导出桥接（变更 ID M07-20260912-03）。新增受信 `document:export` IPC/preload 合约、原生保存对话框和场景 SVG/Sharp/pdf-lib 转换；交付页对真实工作区启用 PNG/JPEG/PDF 导出并返回路径/hash，示例工作区保持禁用。先执行 IPC Red 再实现；export 场景/IPC、LibraryPages、lint、typecheck 通过。分层素材合成、ICC/字体、归档包流式导出、Windows 仍开放。
2026-09-12：M08 诊断包导出（变更 ID M08-20260912-02）。新增受信 `diagnostics:export` IPC/preload 合约和原生 JSON 保存；设置页启用本地诊断包导出，仅允许脱敏 `runtime/errorCode` 字段。先执行 IPC Red 再实现；diagnostics IPC、LibraryPages、lint、typecheck 通过。取消/磁盘错误恢复、Windows 和人工扫描仍开放。
2026-09-12：M05 初始场景引导（变更 ID M05-20260912-08）。真实项目文档首次打开且无场景文件时，`CanvasWorkspace` 通过受控 bridge 保存初始有限场景，使未编辑项目也能导出；已有场景继续只读加载。先新增空场景保存 Red，再 Green；CanvasWorkspace 3/3、lint、typecheck 通过。影响 M07 导出消费者，已完成直接回归。
2026-09-12：M07 native codec 启动回归（变更 ID M07-20260912-04）。将 Sharp/pdf-lib 从主进程顶层导入改为导出调用懒加载，修复打包 Electron storage smoke 启动超时；更新 bridge 白名单并重打包。macOS arm64 `pnpm test:native` 3/3、build、lint、typecheck 通过。
2026-09-12：M03 作品集分析桥接（变更 ID M03-20260912-02）。权利确认且输入来源非空时，DesignerLibrary 通过 `designer-draft` 来源提交分析任务，再进入候选审阅；未连接模型时仍保留诚实失败状态。先新增 bridge Red，再 Green；DesignerLibrary focused、lint、typecheck 通过。真实模型候选生成、授权来源下载与跨平台仍开放。
2026-09-12：最终整体验证（变更 ID REL-20260912-02）。最新树执行 `pnpm test:unit` 73 files/231 tests、`pnpm test:integration` 22 files/96 tests、`pnpm test:e2e` 24/24、macOS arm64 packaged `pnpm test:native` 3/3、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`git diff --check`，全部通过。开放项仍为真实 provider/模型质量、原生系统钥匙串、Windows、签名/公证、项目 ZIP 跨设备闭包、ICC/字体与人工图像质量。

2026-09-12：M02 workspace management UI/bridge（变更 ID M02-20260912-02）。新增项目废纸篓与工作区备份的受信 IPC/preload 合约；Storage 页面接入真实废纸篓列表、恢复/永久删除确认、备份创建和备份恢复后重新打开工作区。先执行 IPC/UI Red，再 Green；focused IPC 4/4、Storage UI 1/1、lint/typecheck 通过。计划中的定时备份、Windows/打包恢复与原生文件对话框门禁仍开放。

2026-09-12：M04 project operations UI/duplication（变更 ID M04-20260912-03）。新增项目复制存储与受信 `project:duplicate` bridge；项目详情页接入重命名、归档、复制，保留只读工作区禁写约束。先执行存储/Studio Red，再 Green；focused project storage/IPC/Studio 31 tests、lint、typecheck、build 通过。跨工作区项目包、流式归档与完整历史闭包仍按 M07 开放。

2026-09-12：M07 project package ZIP/export（变更 ID M07-20260912-05）。采用 `fflate` 0.8.2；新增包清单编解码、受信 `project:package-export` bridge、项目目录闭包导出和交付页入口。先执行 codec/IPC/UI Red，再 Green；focused 22 tests、lint、typecheck、build 通过。导入解包、流式大文件、跨设备闭包与 Windows 原生对话框仍开放。
2026-09-12：M07 project package ZIP/import（变更 ID M07-20260912-07）。新增受信 `project:package-import` bridge、原生 ZIP 选择、包清单验证、项目元数据/文档场景/受管素材提取与来源包去重标记；项目库加入导入入口。先执行 storage/IPC/Studio Red，再 Green；focused 21 tests、unit 77/249、integration 22/97、lint、typecheck、build、diff check 全部通过。流式大包、Windows 对话框、跨设备闭包与人工扫描仍开放。

2026-09-12：M07 offline resize tool（变更 ID M07-20260912-06）。新增 `resizeScene` 比例缩放契约并接入 Workbench 工具面板，离线调整画布尺寸后通过现有 scene bridge 持久化。先执行 transform/Workbench 测试，再 Green；focused 15 tests、lint、typecheck 通过。模型图像编辑、原生 worker、人工质量与大图性能仍开放。
2026-09-12：M04/M05 workspace-backed revision history（变更 ID M04-20260912-04）。新增按文档落盘的修订状态、受信 load/commit/finalize IPC/preload 合约，并在 Workbench 历史面板接入保存版本与定稿。先执行 storage/IPC/Workbench Red，再 Green；focused 18 tests、unit 79/254、integration 22/97、lint、typecheck、build、diff check 全部通过。跨文档历史比较、进程崩溃恢复、Windows 与真实 provider 结果仍开放。
2026-09-12：revision bridge native regression（变更 ID M01-20260912-02）。因新增项目包与修订 API 更新 Electron preload bridge 白名单测试；`pnpm test:native` 2 passed、1 skipped（未配置 packaged executable），lint/typecheck 通过。Windows 与 packaged path 仍开放。
2026-09-12：真实工作区状态文案（变更 ID UI-20260912-04）。目标文件为 `src/app/studio/Studio.tsx`、`src/app/studio/Workbench.tsx`、`src/app/studio/LibraryPages.tsx`；影响 M04 项目/素材状态、M05 工作台历史、M07 交付相邻页面。持久项目显示 `Local`/`Saved`，示例预览保留 `Example`/`Unsaved preview`，并同步真实项目历史与素材说明。unit 77 files/245 tests、integration 22 files/97 tests、lint、typecheck、build、diff check 全部通过；无数据契约变化，直接消费者已完成回归。
2026-09-12：真实项目交付/品牌/素材说明（变更 ID UI-20260912-05）。目标文件为 `src/app/studio/LibraryPages.tsx`；真实项目不再显示示例原稿/示例元数据说明，品牌快照、受管素材和导出状态按工作区语义展示；示例预览仍保留只读提示。LibraryPages focused 17 tests、lint、typecheck、diff check 通过。

2026-09-12：M04 workspace-backed brand CRUD（变更 ID M04-20260912-05）。品牌状态新增 `.designhub/brands.json` 原子存储与受信 `brand:load-state`/`brand:save-state` bridge；品牌页在真实工作区支持加载、新建、编辑、删除，示例预览仍使用只读内置数据。先写 storage/IPC/UI Red，再 Green；focused 4 files/26 tests、lint、typecheck、diff check 通过。项目已有品牌快照不随品牌库编辑自动升级；字体二进制、M06 分析和 Windows/打包门禁仍开放。

2026-09-12：M04 designer attribution/switching（变更 ID M04-20260912-06）。项目列表/详情贯穿 `activeDesignerVersionId` 与设计师快照，工作区项目可显式切换设计师，修订提交记录当前设计师版本和名称快照。修改影响 M04 项目元数据与 M05 工作台历史，Studio/Workbench 直接回归 2 文件/30 测试、lint/typecheck 通过；多贡献者交接和自定义人物图像解析仍开放。

2026-09-12：M04/M05 revision continuation（变更 ID M04-20260912-07）。修订可携带不可变场景快照，工作台历史支持“比较”和“继续”，继续编辑会以旧修订为父版本保存新分支；旧记录无快照时明确不可恢复。模型、持久化修订存储与 Workbench 直接回归 3 文件/26 测试、lint/typecheck/diff check 通过。

2026-09-12：M05/M04 managed image previews（变更 ID M05-20260912-09）。画布和素材详情通过现有 `asset:read` bridge 加载受管图像字节并使用本地对象 URL 预览，外部引用保持不下载；影响 CanvasWorkspace、素材库和导出前预览。直接回归 2 文件/23 测试、lint/typecheck 通过；复杂格式解码和大图性能仍开放。

2026-09-12：M05–M08 implementation pass。M05 canvas recovery follow-up、M06 agent/provider contracts and secure-origin hardening、M07 tools/delivery boundaries、M08 local search/settings/release gates were implemented as independent commits and full unit/integration/lint/typecheck/build/e2e/native smoke gates were rerun. Current aggregate evidence: unit 53 files/143 tests, integration 22 files/96 tests, browser E2E 24/24, native Electron 2 passed/1 skipped. Remaining open gates are explicitly listed in each module record and RELEASE.md: real provider/model capability, native system keychain, Windows host, signed/notarized installer, packaged storage test, large-image/manual quality and cross-device closure.

选择回归范围的规则：

- 改依赖、宿主、公共类型或原生桥接：测试所有直接消费者，必要时跑完整关键旅程。
- 改数据格式、资源清单或删除：回归移动、备份、恢复、包导入导出和历史引用。
- 改画布序列化：回归历史、工具基版本绑定、导出像素/文字和定稿。
- 改提供方/任务：回归创建前对话、设计师分析、项目生成、取消/中断、成本提示与重复结果。
- 改过滤/展示：回归命中字段、旧署名、空态、双语与键盘；不无理由重跑收费生成。
- 改窗口材质、主题、字体、基础组件、断点、按钮文案或浮层：回归两平台窗口行为、UI01–UI10、画布色彩/性能及直接消费者。

## 发布前检查

先查登记中是否还有需回归状态，再核对主计划最终闸门。失败不能用“后面整体测一下”关闭；缺失外部条件只阻塞相关验收，并记录负责人需要提供的是网络、平台设备还是发布凭据。
