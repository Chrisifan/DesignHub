# 模块测试、checklist 与回归登记

创建：2026-09-08；更新：2026-09-13。本文件是实施与回归协议。Electron 框架已选；M01–M08 的可验证契约已落地，未覆盖的平台、真实模型、签名与人工质量前提继续单列。

| 模块 | 当前状态 | 实现前测试/清单文件 | 必须回归的直接消费者 |
| --- | --- | --- | --- |
| M01 | 部分验证；基础外壳、bridge、规则、构建与 macOS 原生 smoke 已完成，双平台/发布门禁开放 | [M01 记录](M01.md) | M02–M08 |
| M02 | 部分验证；工作区格式、单写者锁、项目/废纸篓/备份存储、Electron 入口与项目包导入导出已完成；Windows 与发布验证开放 | [M02 记录](M02.md) | M03、M04、M06、M07、M08 |
| M03 | 部分验证；设计师发布/默认/归档、作品集候选审阅、工作区持久化、只读/内置/不可变回归与有界轮询已完成；真实分析、素材生成与历史集成仍开放 | `docs/verification/M03.md` | M04、M06、M07、M08 |
| M04 | 部分验证；简报确认、项目容器、项目元数据快照、品牌/设计师归属、修订与图像候选定稿已完成；跨设备包闭包、崩溃恢复与实时提供方仍开放 | `docs/verification/M04.md` | M02 的完整备份校验、M05、M06、M07、M08 |
| M05 | 部分验证；画布 schema、Konva 编辑、中文文本、遮罩、撤销/恢复与工作区文档场景持久化已实现；大图、IME、跨平台原生与视觉性能开放 | `docs/verification/M05.md` | M06、M07、M08 |
| M06 | 部分验证；连接边界、上下文隔离、任务状态/幂等、重试/取消、设计师交接、草稿任务与图像候选审阅已实现；真实提供方、系统钥匙串与远端取消语义开放 | `docs/verification/M06.md` | M03、M04、M07、M08 |
| M07 | 部分验证；工具目标、选区/遮罩、版本绑定导出、项目/只读包策略已实现；真实编码器、归档闭包、原生 worker 与人工图像质量开放 | `docs/verification/M07.md` | M02、M04、M08 |
| M08 | 部分验证；本地检索、诊断白名单、设置、候选审阅与发布验收入口已实现；原生双平台、签名、真实模型和全链路证据开放 | `docs/verification/M08.md` | 改动涉及的基础模块与整条交付旅程 |

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

2026-09-13：M08 工作区备份设置持久化新增 `src/features/workspace/settings.ts`、settings storage/IPC channels and Storage UI hydration. The change uses existing Node atomic file primitives and no new dependency. Direct consumers M01 (preload/bridge/build), M02 (workspace internal allowlist/backup closure), M07 (backup/export boundary) and M08 were revalidated with focused tests; full regression follows the module commit. Windows, concurrent external writers and signed release remain open.

2026-09-13：M08 持久化本地检索索引新增 SQLite `search-index.sqlite` 存储、受信 rebuild/query channels and Studio consumer. It reuses `better-sqlite3` and existing substring/filter contracts; no new dependency or cloud index is introduced. Direct consumers M01 (bridge/build), M02 (workspace backup allowlist), M04 (project metadata), M08 (library UI) require focused and full regression; large-workspace, Windows and crash-rebuild evidence remain open.

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

2026-09-13：M03 portfolio completion polling（变更 ID M03-20260913-01）。作品集分析任务在首次查询仍为 `running` 时，使用 500ms 有界轮询读取同一任务；完成结果才解析候选，失败、查询异常、超时和组件卸载都会清理状态/计时器并显示恢复文案。先补 fake-timer Red 回归，再 Green；`DesignerLibrary` focused 15/15、`pnpm lint`、`pnpm typecheck`、`git diff --check` 通过。真实 provider、授权来源传输、原生人物素材和跨平台图像质量仍开放。

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

2026-09-12：M08 local search integration（变更 ID M08-20260912-03）。Studio 项目搜索接入现有 allowlisted 内存索引，覆盖标题、简报、品牌快照、尺寸和贡献者标签，并按工作区隔离；新增 Studio 回归，相关 unit/integration、lint/typecheck 通过。持久 FTS 索引和压力基准仍开放。

2026-09-12：M07 workbench background tools（变更 ID M07-20260912-08）。工作台工具面板新增“去除背景”和“替换背景”入口，均明确显示模型依赖并转到连接设置，不伪造离线结果；Workbench focused 17 tests、lint/typecheck 通过。真实 provider 执行、输出修订提交与图像质量仍开放。

2026-09-12：M04 multi-document project flow（变更 ID M04-20260912-08）。项目元数据中的文档 ID/名称/尺寸贯穿项目详情、工作台和交付，第二及后续文档可打开独立场景并显示自己的画布尺寸；新增 Studio/Workbench/LibraryPages 回归，53 tests、lint/typecheck 通过。关联尺寸布局转换和独立定稿仍待 M07 全链路验证。

2026-09-12：native bridge regression（变更 ID M01-20260912-03）。品牌 load/save API 加入 preload 白名单后更新 Electron smoke 期望并重跑；`pnpm test:native` 2 passed、1 skipped（未配置 packaged executable）。

2026-09-12：M06 secure provider credentials（变更 ID M06-20260912-09）。主进程使用 Electron `safeStorage` 保存/读取连接密钥并供 Agent adapter 使用，renderer 仍无读回 API；integration credential、agent IPC、lint/typecheck/build/native smoke 均通过。系统钥匙串可用性、真实 provider 和 Windows 仍开放。

2026-09-12：M05–M08 implementation pass。M05 canvas recovery follow-up、M06 agent/provider contracts and secure-origin hardening、M07 tools/delivery boundaries、M08 local search/settings/release gates were implemented as independent commits and full unit/integration/lint/typecheck/build/e2e/native smoke gates were rerun. Current aggregate evidence: unit 53 files/143 tests, integration 22 files/96 tests, browser E2E 24/24, native Electron 2 passed/1 skipped. Remaining open gates are explicitly listed in each module record and RELEASE.md: real provider/model capability, native system keychain, Windows host, signed/notarized installer, packaged storage test, large-image/manual quality and cross-device closure.

选择回归范围的规则：

- 改依赖、宿主、公共类型或原生桥接：测试所有直接消费者，必要时跑完整关键旅程。
- 改数据格式、资源清单或删除：回归移动、备份、恢复、包导入导出和历史引用。
- 改画布序列化：回归历史、工具基版本绑定、导出像素/文字和定稿。
- 改提供方/任务：回归创建前对话、设计师分析、项目生成、取消/中断、成本提示与重复结果。
- 改过滤/展示：回归命中字段、旧署名、空态、双语与键盘；不无理由重跑收费生成。
- 改窗口材质、主题、字体、基础组件、断点、按钮文案或浮层：回归两平台窗口行为、UI01–UI10、画布色彩/性能及直接消费者。

2026-09-13：最终整体验证（变更 ID REL-20260913-01）。在最新主分支串行完成 `pnpm test:unit`（83 files/294 tests）、`pnpm test:integration`（23 files/100 tests）、`pnpm test:e2e`（24/24）、`pnpm test:native`（2 passed/1 skipped，未设置 `DESIGNHUB_PACKAGED_APP_PATH`）、`pnpm lint`、`pnpm typecheck`、`pnpm build` 与 `git diff --check`，全部退出 0。native 必须在 build 完成后单独执行；并行 build/native 的一次尝试出现启动时序失败，单独重跑确认无代码回归。`.idea/` 为用户已有未跟踪目录，未纳入提交。

2026-09-13：M04 关联尺寸创建（变更 ID M04-20260913-01）。Studio 在已定稿文档上提供 `新建尺寸` 入口，创建独立文档并记录源文档/定稿修订来源；无定稿源时拒绝创建，原有文档元数据在更新时保留。先新增 Studio Red 回归，再 Green；focused Studio/metadata 2 files/22 tests、lint、typecheck、diff check 通过。关联布局转换、跨文档比较、独立定稿的 M07/M05 全链路质量验证仍开放。

2026-09-13：M04 多贡献者署名与关联场景转换（变更 ID M04-20260913-02）。项目元数据新增去重贡献者 ID 列表，详情页提供多选署名（活跃设计师固定为主署名）；Workbench 保存版本/候选定稿写入 lead/direction/revision 贡献。关联尺寸创建读取源定稿场景并按目标尺寸缩放后保存为独立场景。先观察 Workbench/Studio Red，再 Green；受影响 project storage/IPC、metadata、Studio、Workbench 5 files/53 tests、lint、typecheck、diff check 通过。语义排版转换、跨文档比较、真实模型/图像质量和平台发布门禁仍开放。

2026-09-13：M03 自定义人物形象项目展示（变更 ID M03-20260913-04）。项目详情 `DesignerHero` 现在消费工作区加载的自定义设计师档案，不再因非内置 ID 回退默认人物；缺少 artwork 仍显示明确待生成状态。先新增自定义档案 Red，再 Green；focused `DesignerHero` 1/1、lint、typecheck、diff check 通过。原生人物位图生成与真实模型质量仍开放。

2026-09-13：M03 新建设计自定义人物（变更 ID M03-20260913-05）。新建设计页接收工作区设计师档案列表，允许选用自定义档案并在选择器/人物 Hero 使用其 artwork；缺少图像仍显示待生成状态。先新增 NewDesignPage Red，再 Green；focused 3/3、lint、typecheck、diff check 通过。真实人物素材生成和跨平台图像质量仍开放。

2026-09-13：M07 WebP 交付格式（变更 ID M07-20260913-09）。交付页格式选择器补齐底层已有的 WebP 编码能力，沿用现有导出 bridge、尺寸和失败语义。先新增 LibraryPages Red，再 Green；delivery/Library focused 6 files/39 tests、lint、typecheck、diff check 通过。颜色管理、打包 codec 与人工图像质量仍开放。

2026-09-13：M07 定稿修订交付选择（变更 ID M07-20260913-10）。交付页来源选择器在存在 `finalizedRevisionId` 时提供“已定稿”，导出前读取对应修订的不可变场景快照；缺少修订或场景时明确失败，不伪造定稿结果。先新增 `LibraryPages` Red，再 Green；focused 22/22、lint、typecheck、diff check 通过。改动影响 M04 修订定稿与 M07 导出，已完成直接回归；归档流式包、颜色管理、Windows 与人工质量仍开放。

2026-09-13：M07 定稿交付全量回归（变更 ID REL-20260913-04）。M07 交付页改动后串行执行 unit 84 files/303 tests、integration 23 files/100 tests、browser E2E 24/24、native 2 passed/1 skipped、lint、typecheck、build 与 diff check，全部退出 0。未配置 packaged executable；Windows、签名/公证、真实 provider、颜色管理和人工图像质量仍开放。

2026-09-13：M04 素材拖放与剪贴板导入（变更 ID M04-20260913-03）。工作区素材主区域新增拖放和剪贴板图像导入，统一走受管 `asset:import` bridge；无名剪贴板图像生成 `clipboard.<ext>` 名称，示例/只读仍不写入。先新增 LibraryPages Red，再 Green；focused 24/24、lint、typecheck、diff check 通过。原生拖放、解码质量、Windows 与大图性能仍开放。

2026-09-13：M05 多文档尺寸场景初始化（变更 ID M05-20260913-02）。工作台空白场景初始化改用当前文档持久化宽高，避免关联方图显示正确元数据但编辑场景仍为海报尺寸。先新增 Workbench Red，再 Green；focused 23/23、lint、typecheck、diff check 通过。进程恢复、原生字体/IME、Windows 与大图性能仍开放。

2026-09-13：M07 多文档交付选择（变更 ID M07-20260913-11）。交付页在多文档项目中提供文档选择，所选文档统一驱动预览尺寸、当前/定稿修订读取和导出请求，并在切换文档时重置来源选择。先新增 LibraryPages Red，再 Green；focused 25/25、lint、typecheck、diff check 通过。批量导出、归档流式包、Windows 与人工图像质量仍开放。

2026-09-13：M07 项目归档副本（变更 ID M07-20260913-12）。交付页“同时归档到项目”选项接入平台导出契约，Electron 主进程在当前可写项目 `exports/` 目录独占写入导出副本，外部目标仍为主产物；只读工作区拒绝归档写入。先新增 LibraryPages/IPC Red，再 Green；focused 27/27、lint、typecheck、diff check 通过。归档索引、流式包、Windows 与碰撞恢复体验仍开放。

2026-09-13：M07 归档副本全量回归（变更 ID REL-20260913-06）。归档选项接入主进程后串行执行 unit 84 files/309 tests、integration 23 files/100 tests、browser E2E 24/24、native 2 passed/1 skipped、lint、typecheck、build 与 diff check，全部退出 0。未配置 packaged executable；Windows、签名/公证、真实 provider、颜色管理和人工图像质量仍开放。

2026-09-13：M05 图层管理操作（变更 ID M05-20260913-03）。CanvasWorkspace 图层列表新增上下移、复制、删除，所有操作生成新校验场景并通过既有 scene bridge 持久化，复制自动生成唯一 ID 并选中副本。先新增 CanvasWorkspace Red，再 Green；focused 5/5、lint、typecheck、diff check 通过。多选语义编辑、遮罩质量、Windows 与大图性能仍开放。

2026-09-13：M05 图层命名与语义多选（变更 ID M05-20260913-04）。场景层支持可选持久化名称，图层列表与检查器可重命名；Shift 多选改为可切换成员，检查器支持多选图层的不透明度、可见性与锁定批量编辑并保持混合状态安全。先新增 scene/CanvasWorkspace Red，再 Green；focused 2 files/13 tests、lint、typecheck、diff check 通过。框选、组变换、遮罩与原生字体/IME 仍开放。

2026-09-13：M04/M05/M07 素材详情动作与画布接入（变更 ID M04-20260913-04）。素材详情新增“放入画布”“作为参考”“替换选中图像”三个独立动作，Studio 路由到当前项目文档并通过 scene bridge 持久化；参考图层显式标记并从 SVG 交付排除。先新增 scene/CanvasWorkspace/LibraryPages/Studio/export Red，再 Green；focused 5 files/60 tests、lint、typecheck、diff check 通过。外部引用下载、解码器尺寸、栅格合成、Windows 与人工图像质量仍开放。

2026-09-13：M05 图层命名与语义多选全量回归（变更 ID REL-20260913-07）。共享场景模型支持可选图层名称与多选属性编辑后，串行执行 unit 84 files/316 tests、integration 23 files/100 tests、browser E2E 24/24、lint、typecheck、build 与 diff check，全部退出 0；native 未在本提交重复执行，既有 native 门禁仍按当前 packaged 前提记录。

2026-09-13：M05/M07 组合回归（变更 ID REL-20260913-05）。图层管理与多文档交付改动后串行执行 unit 84 files/308 tests、integration 23 files/100 tests、browser E2E 24/24、native 2 passed/1 skipped、lint、typecheck、build 与 diff check，全部退出 0。未配置 packaged executable；Windows、签名/公证、真实 provider、颜色管理和人工图像质量仍开放。

2026-09-13：M04 持久化文档卡片元数据（变更 ID M04-20260913-05）。项目详情卡片改用 `documentEntries` 的名称与尺寸，保留无元数据示例回退，点击仍绑定对应文档 ID。先新增 Studio Red，再 Green；focused Studio/Library 2 files/47 tests、lint、typecheck、diff check 通过。语义排版转换、跨文档比较与平台门禁仍开放。

2026-09-13：macOS packaged native 回归（变更 ID REL-20260913-02）。使用现有 `out/designhub-darwin-arm64/designhub.app/Contents/MacOS/designhub` 设置 `DESIGNHUB_PACKAGED_APP_PATH` 执行 `pnpm test:native`，source smoke、main storage 与 packaged storage 共 3/3 通过；Windows、签名/公证、升级卸载与钥匙串持久化仍开放。

2026-09-13：M03 描述建师任务闭环（变更 ID M03-20260913-02）。工作区内按描述创建设计师时提交 `designer-draft` 任务，消息包含风格说明与创作原则；完成任务解析为候选，运行中复用 500ms/12 次有界轮询，失败或不可用不展示伪造候选；无工作区示例仍保持离线预览。先新增描述路径 Red 回归，再 Green；`DesignerLibrary` focused 16/16、lint、typecheck、diff check 通过。真实 provider、授权来源传输、人物位图和跨平台图像质量仍开放。

2026-09-13：M03 描述建师全量回归（变更 ID REL-20260913-03）。实现提交后串行执行 unit 83 files/295 tests、integration 23 files/100 tests、browser E2E 24/24、lint、typecheck、build、diff check；源码 native 2 passed/1 skipped，使用现有 macOS arm64 packaged executable 后 native 3/3 passed。Windows、签名/公证、钥匙串持久化、真实 provider 和人工图像质量仍开放。

2026-09-13：M03 即时完成任务回归（变更 ID M03-20260913-03）。提交接口直接返回 `completed` 时现在立即解析候选，不依赖二次任务列表查询；新增回归后 `DesignerLibrary` 17/17 通过，最新全量 unit 83 files/296 tests、integration 23 files/100 tests、E2E 24/24、lint/typecheck/build/diff check 及 native smoke 均通过。现有 packaged executable 冒烟 3/3 通过；该包未因本次 renderer 修复重新打包，Windows、签名/公证、真实 provider 与人工质量仍开放。

2026-09-13：M07 工作台完整图像工具入口（变更 ID M07-20260913-13）。工具面板新增“移除对象”“局部重绘”“扩展画布”“放大图像”，统一复用现有 `ImageTool` 任务提交与连接回退语义；先观察 Workbench Red，再 Green，Workbench 24/24、lint、typecheck、diff check 通过。真实 provider、选区/遮罩交互、原生 worker、输出落版和人工图像质量仍开放。

2026-09-13：M04/M05 修订署名可见性（变更 ID M04-20260913-14）。工作台历史显示修订中冻结的设计师贡献者、角色和本机操作者快照；无名称时回退版本 ID，不读取当前设计师库覆盖历史。先观察 Workbench Red，再 Green，Workbench 25/25、lint、typecheck、diff check 通过。旧历史迁移、项目级完整署名视图和真实 provider 署名仍开放。

2026-09-13：M08 历史贡献者检索（变更 ID M08-20260913-04）。本地全文匹配纳入 `contributorIds`，Studio 索引使用活跃与历史贡献者 ID 的去重并集，避免只按当前设计师命中。先观察 filter Red，再 Green；filter 3/3、Studio 搜索回归、lint、typecheck 通过。持久 FTS、贡献者名称快照索引和大工作区压力验证仍开放。

2026-09-13：M02 工作区备份目标与周期（变更 ID M02-20260913-15）。Storage 持久化工作区级备份目标、上次成功产物和手动/每日/每周周期；应用运行期间按到期策略复用原目标执行，不可用时失败并保留恢复入口。先观察周期策略 Red，再 Green；backup schedule 与 LibraryPages focused 30/30、lint、typecheck、diff check 通过。进程外调度、崩溃耐久、Windows 与打包恢复仍开放。

2026-09-13：M04 设计师主署名归一化（变更 ID M04-20260913-15）。项目元数据创建与更新现在始终将活跃设计师放在去重贡献者列表首位；切换活跃设计师不会丢弃已有方向贡献，后续修订署名可稳定继承主署名。先新增 metadata Red，再 Green；metadata 6/6、project-store/Studio/Workbench 30/30、lint、typecheck、diff check 通过。历史旧数据迁移、真实提供方署名和跨设备验证仍开放。

2026-09-13：M04 项目复制/导入关联链路（变更 ID M04-20260913-16）。项目复制与项目包导入保留文档的 `sourceDocumentId`、`sourceRevisionId` 和 `finalizedRevisionId`，不再丢失关联尺寸来源。先新增 project-store Red，再 Green；project-store/metadata 12/12、lint、typecheck、diff check 通过。跨设备包闭包和大包流式处理仍属 M07 发布门禁。

2026-09-13：M04 项目多设计师展示（变更 ID M04-20260913-17）。项目卡片和详情页展示贡献者去重并集及对应人物形象；主设计师仍保留版本号，缺少当前档案时使用历史 ID 回退，读写权限不改变署名可见性。先新增 Studio Red，再 Green；Studio/DesignerHero/Workbench 47/47、lint、typecheck、diff check 通过。历史名称迁移和真实提供方署名仍开放。

2026-09-13：M04 项目包刷新映射（变更 ID M04-20260913-18）。Studio 初次打开与项目包导入后的刷新统一消费完整 `ActiveProject` 元数据，保留贡献者、设计师/品牌快照、文档尺寸及关联来源，避免导入后回退到示例占位。先新增 Studio Red，再 Green；Studio 导入回归 1/1、静态检查通过。

2026-09-13：M07 非主文档定稿选择修复（变更 ID M07-20260913-14）。交付页定稿资格改为依据当前选中文档的 `finalizedRevisionId`，不再错误依赖项目顶层 `documentId`；多文档项目可正确导出第二及后续文档的定稿修订。先新增 `LibraryPages` Red，再 Green；focused 交付/导出 48/48、lint、typecheck、diff check 通过。归档流、颜色管理、Windows 与人工图像质量仍开放。
2026-09-13：M07 项目包条目分类（变更 ID M07-20260913-15）。主进程项目包遍历复用路径分类策略，区分输出、预览、对话、凭据、字体与普通项目文件，确保只读交付白名单不会因默认标记而携带私有内容。先新增 package-policy Red，再 Green；package/IPC/export focused 10/10、lint、typecheck、diff check 通过。归档流、跨设备闭包、Windows 与人工扫描仍开放。
2026-09-13：M07 工作台区域工具选择（变更 ID M07-20260913-16）。工作台局部工具在提交前显示现有遮罩编辑器并要求有效选区，应用区域后通过 typed image-task 回调传递，取消/清除不创建任务。先新增 Workbench Red，再 Green；Workbench/MaskEditor/target focused 30/30、lint、typecheck、diff check 通过。provider 遮罩栅格化、真实模型执行、Windows 与人工质量仍开放。
2026-09-13：M05/M07 工作台会话状态文案（变更 ID UI-20260913-08）。工作台底部状态根据是否绑定工作区显示“本地会话”或“示例会话”，修正真实项目仍显示预览状态的问题。先新增 Workbench Red，再 Green；Workbench focused 回归通过，lint、typecheck、diff check 通过。进程恢复、打包存储、Windows 与人工视觉门禁仍开放。
2026-09-13：M06/M07 图像工具任务溯源（变更 ID M06-20260913-10）。图片编辑任务贯穿保存所选工具与有限区域，Studio、可信 IPC 与任务存储共同校验，避免局部操作参数在桥接处丢失。先新增 task-service Red，再 Green；task-service/IPC/task-store focused 17/17、lint、typecheck、diff check 通过。provider 遮罩栅格化、真实模型、Windows 与人工质量仍开放。
2026-09-13：M06 provider 图像编辑元数据（变更 ID M06-20260913-11）。OpenAI-compatible image-edit adapter 在 multipart 请求中携带工具与区域元数据，和任务记录保持一致；原图、遮罩与凭据边界不变。先新增 adapter Red，再 Green；adapter/task-service focused 16/16、lint、typecheck、diff check 通过。真实 provider 对自定义字段的支持、遮罩栅格化与跨平台验证仍开放。

2026-09-13：M08 工作区设置与持久化检索索引（变更 ID M08-20260913-12）。新增 `.designhub/settings.json` 和 `search-index.sqlite`，并通过受信 IPC 接入 Storage/Projects 页面；M02 备份 allowlist 与集成用例同步更新。focused storage/IPC/Studio/backup 17+25+35 tests、lint、typecheck、diff check 通过；真实 Windows、并发写者、崩溃恢复和大工作区基准仍开放。

2026-09-13：M05/M06/M07 候选定稿场景同步（变更 ID M07-20260913-17）。工作台定稿图像候选时同时更新当前场景、持久化文档并将同一场景快照写入不可变修订，修复“历史已定稿但画布仍显示旧图”偏差。先新增 Workbench Red，再 Green；focused Workbench、lint、typecheck、diff check 通过。真实 Provider 输出、栅格质量和跨平台视觉证据仍开放。

2026-09-13：M08 检索启动顺序修复（变更 ID M08-20260913-13）。Projects 页面等待持久化索引重建完成后再查询，避免首次打开时查询竞态造成项目短暂消失。先新增 Studio Red，再 Green；focused Studio 1/1、lint、typecheck、diff check 通过。崩溃恢复与大工作区基准仍开放。

2026-09-13：M01/M08 检索 IPC 输入校验（变更 ID M08-20260913-14）。重建通道拒绝 malformed records before storage invocation, preserving the trusted bridge contract. 先新增 search IPC Red，再 Green；focused 2/2、lint、typecheck 通过。

2026-09-13：M08 持久化检索索引损坏恢复（变更 ID M08-20260913-15）。可写工作区检测到损坏的 `search-index.sqlite` 或 sidecar 时会移除并重建，源项目数据不受影响；只读工作区对缺失/损坏索引 fail-closed 返回空结果。先执行真实文件损坏 Red，再 Green；storage 3/3、integration search-index 100/100、lint、typecheck、diff check 通过。影响 M01 bridge/build、M02 备份内部清单和 M08 Studio 检索，事务中断、Windows 与大工作区压力证据仍开放。

2026-09-13：M08 工作区设置符号链接边界（变更 ID M08-20260913-16）。`settings.json` 读取和写入拒绝符号链接/非普通文件，避免跨工作区读取或替换外部目标；外部文件保持不变。先执行真实 symlink Red，再 Green；settings/IPC 346/346、backup integration 100/100、lint、typecheck、diff check 通过。影响 M01 bridge、M02 备份设置闭包和 M08 Storage，Windows reparse point 与最终检查后的竞态仍开放。

2026-09-13：M08 检索索引符号链接边界（变更 ID M08-20260913-17）。`search-index.sqlite` 被替换为外部符号链接时，可写模式只移除链接并在工作区内重建，只读模式 fail-closed，外部 SQLite 目标保持不变。先执行真实 symlink Red，再 Green；storage 4/4、integration search-index 100/100、lint、typecheck、diff check 通过。影响 M01 bridge、M02 备份清单和 M08 检索，Windows reparse point 与最终检查后的竞态仍开放。

2026-09-13：M06 能力感知任务重试（变更 ID M06-20260913-12）。失败图片生成任务按原能力重新调用 image adapter；缺少可恢复原图的图片编辑任务明确不重试，避免错误路由到 chat 或伪造输入。先新增 task-service Red，再 Green；focused task-service 13/13、lint、typecheck、diff check 通过。影响 M06 task runtime/IPC/UI 的重试语义，图片编辑可恢复源资产绑定、真实 provider 与远端幂等仍开放。

2026-09-13：M04 受管素材符号链接边界（变更 ID M04-20260913-18）。`readAsset` 读取前校验资产文件为项目内普通文件，拒绝外部符号链接并保持外部目标不变。先执行真实 symlink Red，再 Green；asset-store 6/6、assets/scene integration 100/100、lint、typecheck、diff check 通过。影响 M04 素材存储、M05 画布预览和 M07 导出前读取，Windows reparse point 与大图解码仍开放。

2026-09-13：M04 新建项目尺寸预设（变更 ID M04-20260913-19）。新增受限尺寸解析契约并让本地项目/预览创建实际使用所选 `1080 × 1440`、`1080 × 1080` 或 `1920 × 1080` 文档尺寸；无效/超大值在创建前拒绝。先新增 size Red，再 Green；size/Studio 2 files/353 tests、lint、typecheck、diff check 通过。影响 M04 创建、M05 场景初始化与 M07 交付尺寸，任意自定义尺寸仍通过工作台调整工具处理。

2026-09-13：M06 任务状态符号链接边界（变更 ID M06-20260913-13）。`tasks.json` 读取/写入拒绝符号链接，避免跨工作区加载或替换外部任务状态；外部目标保持不变。先执行真实 symlink Red，再 Green；task-store/IPC 4/4、task-recovery integration 100/100、lint、typecheck、diff check 通过。影响 M06 任务恢复、M08 任务列表及 M02 备份清单，Windows reparse point 与最终检查后的竞态仍开放。
2026-09-13：M03 设计师状态符号链接边界（变更 ID M03-20260913-04）。`designers.json` 读取和写入拒绝外部符号链接，避免跨工作区读取或替换设计师库状态；先执行真实 symlink Red，再 Green；designer-store focused 3/3、lint、typecheck 通过。影响 M03/M04/M06 设计师消费者，Windows reparse point 与最终检查后的竞态仍开放。
2026-09-13：M04 品牌与修订状态符号链接边界（变更 ID M04-20260913-20）。`brands.json` 与按文档保存的修订状态拒绝外部符号链接，避免跨工作区读取；先执行真实 symlink Red，再 Green；brand-store 4/4、revision-store 3/3、lint、typecheck 通过。影响 M04/M05/M06/M07 历史与导出消费者，Windows reparse point 与最终检查后的竞态仍开放。
2026-09-13：M07 项目包路径唯一性边界（变更 ID M07-20260913-18）。项目包创建和 ZIP 解码拒绝重复 manifest 路径，避免同一路径 payload 的歧义覆盖；先执行 duplicate-path Red，再 Green；project-package focused 5/5、lint、typecheck 通过。影响 M04 导入和 M08 发布流程，大包流式与跨设备闭包仍开放。
2026-09-13：M04/M07 项目包素材闭包校验（变更 ID M04-20260913-21）。导入前验证受管素材路径、唯一哈希、压缩包存在性和字节哈希，缺失素材在创建项目之前以 `INVALID_PACKAGE` 拒绝；先执行缺失素材 Red，再 Green；project-store focused 7/7、typecheck 通过。影响 M04 导入、M05 素材读取与 M07 项目包，流式大包、跨设备和 Windows 仍开放。
2026-09-13：M05 画布草稿项目隔离（变更 ID M05-20260913-08）。`EditSession` 默认草稿键同时包含项目与文档 ID，避免同名文档跨项目恢复；先执行跨项目恢复 Red，再 Green；canvas recovery integration 5/5、canvas unit 18/18、typecheck 通过。影响 M06/M07 项目上下文消费者，崩溃耐久、IME 与跨平台存储仍开放。
2026-09-13：M04/M07 导入历史身份闭包（变更 ID M04-20260913-22）。项目包导入改写复制的修订 `projectId` 为新项目身份，保留修订 ID、场景和贡献；先执行历史身份 Red，再 Green；project-store focused 8/8、lint、typecheck 通过。影响 M05 历史读取和 M07 交付，历史迁移与跨设备验证仍开放。
2026-09-13：M04/M07 项目包文件预检（变更 ID M04-20260913-23）。项目包导入在创建项目之前预检全部声明 payload 与修订 JSON，格式错误不会遗留空项目；先执行 malformed-history Red，再 Green；project-store focused 9/9、lint、typecheck 通过。磁盘满回滚、大包流式与跨设备仍开放。
2026-09-13：M04 文档身份校验（变更 ID M04-20260913-24）。项目元数据拒绝重复文档 ID 及路径样式 ID，避免产生不可打开的场景文件；先执行 duplicate/traversal Red，再 Green；metadata focused 7/7、lint、typecheck 通过。历史异常数据迁移仍开放。
2026-09-13：M07 导出目标迟到冲突保护（变更 ID M07-20260913-19）。导出在渲染/编码后再次检查目标路径，目标在初次检查后出现时返回 `TARGET_EXISTS`，不写入或重命名临时文件；先执行迟到目标 Red，再 Green；export-document focused 6/6、lint、typecheck 通过。目标盘故障、原子 no-replace 和 Windows 仍开放。
2026-09-13：M06 图片任务空结果保护（变更 ID M06-20260913-14）。图片生成/编辑适配器返回空列表时任务失败并记录 `IMAGE_RESULT_EMPTY`，不产生伪候选。先执行空结果 Red，再 Green；task-service focused 12/12、lint、typecheck 通过。真实提供方部分成功语义、远端取消与跨平台仍开放。
2026-09-13：M06 对话成本持久化（变更 ID M06-20260913-15）。对话任务完成时保存适配器报告的 `cost`（未知保留 `null`），避免任务列表丢失费用上下文；先执行成本丢失 Red，再 Green；task-service focused 13/13、lint、typecheck 通过。真实提供方账单和 usage 对账仍开放。
2026-09-13：M06 图片重试参数保留（变更 ID M06-20260913-16）。任务记录持久化图片生成的 model/size/count，能力感知重试复用原请求参数；先执行参数丢失 Red，再 Green；task-service/task-store focused 18/18、lint、typecheck 通过。提供方幂等与计费仍开放。
2026-09-13：M02/M04 项目文件符号链接边界（变更 ID M02-20260913-16）。项目 manifest、内容清单、SQLite 与废纸篓元数据读取前验证为项目目录内普通文件；外部同身份 manifest 以 `PROJECT_NOT_FOUND` fail-closed。先执行真实 symlink Red，再 Green；project-store integration 16/16、lint、typecheck 通过。Windows reparse point 与最终检查后的竞态仍开放。
2026-09-13：M01/M02 工作区 manifest 符号链接边界（变更 ID M01-20260913-05）。工作区打开在普通格式与未来格式只读路径均拒绝 symlink manifest，避免外部身份被接受；先执行真实 symlink Red，再 Green；workspace-open integration 11/11、lint、typecheck 通过。Windows reparse point 与最终检查后的竞态仍开放。
2026-09-13：M01 工作区 manifest 异步竞态回归（变更 ID M01-20260913-06）。symlink 校验保留异步 `readFile` 路径，恢复目录替换故障注入；workspace-open/open-identity 12/12、lint、typecheck 通过。
2026-09-13：M04 项目包导入发布原子性（变更 ID M04-20260913-25）。导入 payload 复制移入项目临时目录，在发布和索引之前完成；注入复制失败不会留下 active 项目，原 operationId 可重试。先观察 project-store Red，再 Green；project-store focused 10/10、lint、typecheck 通过。磁盘满、进程终止、大包流式和跨设备仍开放。
2026-09-13：M05 只读画布写入边界（变更 ID M05-20260913-09）。只读工作区禁用 Workbench/CanvasWorkspace 场景、图层、修订和 provider 任务写入；先观察 Workbench Red，再 Green；Workbench focused 29/29、lint、typecheck 通过。原生只读窗口、Windows 与打包恢复仍开放。
2026-09-13：M06 终态任务重启幂等（变更 ID M06-20260913-17）。任务运行时加载已完成/失败/取消记录后直接保持终态，不因内存去重表丢失而重复提交修订；先观察 runtime Red，再 Green；runtime focused 6/6、lint、typecheck 通过。真实跨进程回调、远端幂等与打包恢复仍开放。
2026-09-13：M04 项目包元数据预检（变更 ID M04-20260913-26）。导入前通过共享项目 schema 校验 metadata，畸形文档列表统一返回 `INVALID_PACKAGE` 且不创建项目；先观察 project-store Red，再 Green；project-store focused 11/11、lint、typecheck、diff check 通过。历史迁移、磁盘满和跨设备仍开放。

## 发布前检查

先查登记中是否还有需回归状态，再核对主计划最终闸门。失败不能用“后面整体测一下”关闭；缺失外部条件只阻塞相关验收，并记录负责人需要提供的是网络、平台设备还是发布凭据。
