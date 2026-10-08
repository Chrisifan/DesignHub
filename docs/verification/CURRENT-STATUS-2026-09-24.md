# DesignHub 当前完成度与推进基线（2026-09-27）

## 2026-10-05 remaining IPC 续推进

- 将 project-library lifecycle、credential store/delete/status 和 document export IPC 注册从 src/desktop/main.ts 抽出到独立 registrar；保留可信窗口、活动 libraryId、可写库、keyring、归档副本和导出历史语义。
- 新增对应注册完整性测试；project-library 8/8，credentials/export 5/5；pnpm lint、pnpm typecheck 通过。
- 本轮尚未重新宣称完整 E2E、native packaged 或真实 provider 通过。

## 2026-10-05 remaining IPC 合并验证

- pnpm test:focused：38 files / 164 passed / 8 skipped。
- pnpm test:unit：164 files / 933 passed / 8 skipped。
- pnpm test:integration：30 files / 131 passed。
- pnpm build、pnpm lint、pnpm typecheck、git diff --check：通过。
- renderer 初始 chunk 仍为 824.91 kB，Vite warning 尚未关闭；完整 browser E2E 仍需稳定 preview server 后重跑。

## 2026-10-04 content IPC 续推进

- 将 designer、brand、asset、scene、revision IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-content-handlers.ts，保持 libraryId 绑定、可写库边界、scene/revision 校验和 workspaceId 持久化映射不变。
- 新增 register-content-handlers.test.ts，并纳入 pnpm test:focused；聚焦验证 6 files / 12 passed。
- pnpm lint、pnpm typecheck 通过；完整 E2E、native packaged 和真实 provider 仍未在本轮重新验证。

## 2026-10-04 content 后合并验证

- pnpm test:focused：32 files / 151 passed / 8 skipped。
- pnpm test:unit：161 files / 929 passed / 8 skipped。
- pnpm test:integration：30 files / 131 passed。
- pnpm build、pnpm lint、pnpm typecheck、git diff --check：通过。
- renderer 初始 chunk 仍为 824.91 kB，Vite warning 尚未关闭；完整 browser E2E 仍需稳定 preview server 后重跑。

## 2026-10-03 project IPC 续推进

- 将项目列表、创建/复制、metadata、designs、canvas layout 与 trash 生命周期 IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-projects.ts，保持活动 libraryId、可写库检查、输入校验和 project-store 回调不变。
- 新增 register-projects.test.ts，并纳入 pnpm test:focused；聚焦验证 2 files / 4 passed。
- pnpm lint、pnpm typecheck 通过；完整 E2E、native packaged 和真实 provider 仍未在本轮重新验证。

## 2026-10-03 project 后合并验证

- pnpm test:focused：26 files / 139 passed / 8 skipped。
- pnpm test:unit：160 files / 928 passed / 8 skipped。
- pnpm test:integration：30 files / 131 passed。
- pnpm build、pnpm lint、pnpm typecheck、git diff --check：通过。
- renderer 初始 chunk 仍为 824.91 kB，Vite warning 尚未关闭；完整 browser E2E 仍需稳定 preview server 后重跑。

## 2026-10-03 profile IPC 续推进

- 将 profile load/save IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-profile.ts，保持可信发送方、profile schema、头像归一化和 profile store 行为不变。
- 新增 register-profile.test.ts，并纳入 pnpm test:focused；聚焦验证 2 files / 6 passed。
- pnpm lint、pnpm typecheck 通过；完整 E2E、native packaged 和真实 provider 仍未在本轮重新验证。

## 2026-10-03 profile 后合并验证

- pnpm test:focused：24 files / 135 passed / 8 skipped。
- pnpm test:unit：159 files / 927 passed / 8 skipped。
- pnpm test:integration：30 files / 131 passed。
- pnpm build、pnpm lint、pnpm typecheck、git diff --check：通过。
- renderer 初始 chunk 仍为 824.91 kB，Vite warning 尚未关闭；完整 browser E2E 仍需稳定 preview server 后重跑。

## 2026-10-03 代码优化续推进

- 将项目包导入/导出 IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-project-package.ts，保持活动 libraryId、可信发送方、可写库边界、对话框和归档存储语义不变。
- 新增 register-project-package.test.ts，并将项目包合约套件纳入 pnpm test:focused；聚焦验证 2 files / 3 passed。
- pnpm lint、pnpm typecheck 通过；本轮未重新宣称完整 E2E、native packaged 或真实 provider 通过。
- Task 5 仍为 partial，agent/project/export/search/backup 等注册组尚待拆分。

## 2026-10-03 合并验证

- pnpm test:focused：18 files / 123 passed / 8 skipped。
- pnpm test:unit：157 files / 925 passed / 8 skipped。
- pnpm test:integration：30 files / 131 passed。
- pnpm build、pnpm lint、pnpm typecheck、git diff --check：通过。
- renderer 初始 chunk 仍为 824.91 kB，Vite 500 kB warning 尚未关闭；完整 browser E2E 仍等待稳定 preview server 后重跑。

## 2026-10-03 支持型 IPC 续推进

- 将 backup、export-history、diagnostics IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-support-handlers.ts，保持可信发送方、活动 libraryId、备份存储生命周期、导出目标可用性和诊断文件写入语义不变。
- 新增 register-support-handlers.test.ts，并纳入 pnpm test:focused；聚焦验证 4 files / 6 passed。
- pnpm lint、pnpm typecheck 通过；本轮未重新宣称完整 E2E、native packaged 或真实 provider 通过。

## 2026-10-03 支持型 IPC 合并验证

- pnpm test:focused：22 files / 129 passed / 8 skipped。
- pnpm test:unit：158 files / 926 passed / 8 skipped。
- pnpm test:integration：30 files / 131 passed。
- pnpm build、pnpm lint、pnpm typecheck、git diff --check：通过。
- renderer 初始 chunk 仍为 824.91 kB，Vite warning 尚未关闭；完整 browser E2E 仍需稳定 preview server 后重跑。

## 2026-10-03 搜索 IPC 续推进

- 将 search rebuild/query IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-search.ts，保留活动 libraryId、可信发送方和索引 store 关闭语义。
- 新增 register-search.test.ts，并纳入 pnpm test:focused；聚焦验证 2 files / 3 passed。
- pnpm lint、pnpm typecheck 通过；完整 E2E、native packaged 和真实 provider 仍不在本轮证据内。
## 当前结论（2026-09-27）

本地完整性闭环已收口：单项目库迁移、首次启动引导/启动屏、App/Studio/native/E2E 契约和布局回归均已完成本地可验证闭环。`pnpm release:check` 最终为 `passed-with-blockers`，所有本地命令和 package scan 通过；剩余阻塞均为未在当前 macOS 环境中可诚实验证的外部门禁。

当前可复核数字：unit 138 files / 825 passed / 8 skipped，integration 29 files / 129 passed，E2E 41/41，native source 2 passed / packaged 1 skipped，provider 3/3，lint/typecheck/build/diff-check 全部通过。build 仍有 Vite bundle size warning。

本地完成不等于发布完成。Windows 真机/打包、签名、公证、安装升级卸载、Keychain 持久化、live provider、跨设备恢复、高级编解码、大图性能和人工视觉质量继续保持 blocked。

## 历史基线（2026-09-24）

当前工作树不能标记为“整体完成”或“可发布”。核心本地优先功能已经形成可运行的实现路径，但单项目库迁移、首次启动引导接入后的回归、端到端/原生入口更新和外部发布门禁尚未收口。

本记录是 2026-09-24 对当前工作树的最新快照。它优先于此前的历史回归记录（包括 2026-09-15 的实机走查）；历史记录仍保留，用于说明当时的证据范围，不能覆盖本记录中的失败结果。

如果需要用单一数字沟通进度，这只是便于排期的估算，不是产品验收指标：

- 按代码功能落地范围：约 80%。
- 按可稳定验收和发布范围：约 55%–60%。
- 按模块验证协议：M01–M08 均为“部分验证”，0 个模块达到“已验证”。

## 历史基线：已落地范围

| 范围 | 当前判定 | 说明 |
| --- | --- | --- |
| M01–M08 核心能力 | 有实现路径，均部分验证 | Electron 外壳、项目/素材/设计师、画布、模型任务、图像工具、导出、搜索、诊断等主路径均有代码和自动化覆盖。 |
| 单项目库 | 代码迁移进行中 | 已加入项目库存储、路径持久化、生命周期 IPC、消费者迁移和移除工作区切换入口的代码；迁移后的完整回归和 E2E 仍未完成。 |
| 首次启动引导 | 主要功能已实现 | profile 存储、头像处理、项目库选择、模型配置步骤、启动屏和 Studio 头像/昵称读取已经提交。最终全量验证和 Windows 打包检查仍未完成。 |
| 离线 provider 契约 | 已通过 | `pnpm test:provider`：1 个文件、3 个测试通过。真实 provider smoke 仍需显式配置，不能据此宣称真实模型可用。 |

## 历史验证结果（2026-09-24）

以下结果均来自 2026-09-24 当前工作树的实际执行，不是历史记录复用。

| 检查 | 结果 | 解释 |
| --- | --- | --- |
| 首次启动/资料/头像/profile 聚焦套件 | 7 个文件、32 个测试通过 | 新增引导路径本身的聚焦行为目前为绿。测试中仍有少量 React `act(...)` 警告。 |
| `pnpm test:unit` | 135 个文件；736 通过、61 失败、8 跳过 | 失败集中在旧 workspace 上下文断言、Studio/Workbench 旧页面结构、artwork protocol 和部分布局契约；不能标记为全量回归通过。 |
| `pnpm test:integration` | 29 个文件；128 通过、3 失败 | 失败集中在 `tests/integration/layout-contract.test.ts` 的旧 token/selector/玻璃控件契约。 |
| `pnpm test:e2e` | 未通过 | 多个用例仍寻找“新建工作区/打开工作区”，而当前应用先进入“设置你的资料”引导；出现 30 秒超时，因此未形成完整 E2E 证据。 |
| `pnpm test:native` | 1 通过、1 失败、1 跳过 | 存储 smoke 通过；旧 welcome shell 断言失败；打包可执行文件用例因未设置 `DESIGNHUB_PACKAGED_APP_PATH` 跳过。 |
| `pnpm test:provider` | 3/3 通过 | 仅是离线适配器契约，不包含真实网络调用、费用、质量或远端取消。 |
| `pnpm lint` | 通过 | 当前没有 lint 错误。 |
| `pnpm typecheck` | 通过 | 当前没有 TypeScript 类型错误。 |
| `pnpm build` | 通过，但有 bundle 体积警告 | renderer 产物约 790 KB，超过 Vite 500 KB 提示阈值。 |
| `git diff --check` | 通过 | 当前差异没有空白错误。 |

## 历史主线记录

### 单项目库迁移

已完成的代码方向包括：

- 项目库 manifest、初始化、目录身份和单写者锁。
- `userData` 中唯一项目库路径的持久化。
- 项目库状态/选择/恢复 IPC。
- 存储和 IPC 消费者从 `WorkspaceHandle` 向项目库上下文迁移。
- App 和窗口栏移除用户可见的工作区切换。

尚未完成的验收闭环包括：

- 清理或更新仍使用旧 workspace 契约的 unit/integration/native 测试。
- 更新 E2E fixture，使其先创建/选择临时项目库再进入 Studio。
- 增加项目库恢复、旧工作区隔离、跨项目任务和统一回收站的完整集成证据。
- 将 ADR、模块登记和计划 checkbox 与实际实现同步。

实施计划见 [单项目库计划](../superpowers/plans/2026-09-23-single-project-library.md)。其中未勾选的任务不能因为已有部分代码提交而视为完成。

### 首次启动引导与启动屏

已提交的实现阶段包括 profile store、可信 profile IPC、ProfileStep、ModelStep、App splash/onboarding 状态机和 Studio profile 展示。当前工作树还包含启动进度展示和新的 splash 资源，处于未提交状态。

剩余事项主要是：

- 更新全量 App/Studio/E2E/native 入口测试以适配新的首次启动流程。
- 完成 Windows 打包 dry check 和完整回归。
- 将实际结果写回 [首次启动计划](../superpowers/plans/2026-09-24-first-launch-onboarding-and-splash.md)，不要保留全部未勾选但代码已提交的模糊状态。

## 外部发布阻塞项（仍有效）

以下项目仍不能按“本地测试通过”关闭：

- Windows 打包和真实运行。
- 签名、公证、安装/升级/卸载及用户数据保留。
- 系统 Keychain 持久化的真实证据。
- 真实模型质量、费用、远端取消和部分失败语义。
- 跨设备项目包恢复和完整资源闭包。
- 高级编解码、大图性能、IME/原生对话框和人工视觉质量。

## 已完成推进项（2026-09-25）

1. 已将公共运行时身份统一为 `libraryId`，并保留持久化 `workspaceId` 兼容字段。
2. 已完成 profile → 项目库 → 可选模型 → Studio 的 App、E2E fixture 和 native source smoke 接入。
3. 已完成布局契约、启动屏进度、Konva 画布 resize 和浏览器浮点布局回归。
4. 已执行完整 `release:check`；下一步只处理外部平台、凭据和真实 provider 门禁。

## 2026-09-27 功能闭环推进

本轮补齐了 provider 模型元数据闭环：conversation、design-generation、image-generation 和 image-editing 请求从已配置连接读取能力对应模型；任务记录保存 `providerId`、`capability` 和实际 `model`，重试沿用已记录模型，IPC 对可选模型字段执行非空校验。新增 task-service 回归验证聊天和设计生成请求实际携带所选模型，并保留项目包导入失败后再次恢复的 E2E bridge 旅程。

本轮复核证据：`pnpm exec vitest run --config vitest.config.ts src/features/agent/task-service.test.ts src/desktop/ipc/agent.test.ts` 62/62；`pnpm exec vitest run --config vitest.config.ts src/app/Studio.test.tsx src/app/studio/Workbench.test.tsx` 101 passed、8 skipped；完整 `pnpm release:check` 最终为 `passed-with-blockers`：unit 135 files/800 passed/8 skipped、integration 29 files/129 passed、E2E 41/41、native source 2 passed/1 skipped、lint/typecheck/build/diff-check/package scan 全部通过。build 仍有 Vite bundle size warning。

## 2026-09-28 功能完善推进

本轮将生成稿接入候选画布分支：设计生成任务加载后按 `primary → composition → expressive` 选择首个完成候选，候选素材立即以隔离的临时图像场景显示在画布中；画布预览模式不会 hydrate 或写回正式文档场景。候选支持切换、确认、放弃和继续编辑，确认使用任务 `requestId` 作为修订操作 ID。CanvasWorkspace 同时报告真实选中图层，图像工具提交不再回退到文档第一张图片。

任务恢复语义改为 `unknown`：重启时 queued/running 任务及未完成生成槽保留未知结果标记，不自动重发或落版；显式重试才重新排队。IPC/存储校验已接受该状态，并保留 provider 远端请求与取消/状态查询元数据字段。

图像工具结果新增 `ToolCandidate` 和 `unknown` 结果拒绝落版契约；新增独立 ImageToolJob/ImageToolItem 域模型，覆盖相对路径安全校验、输出根目录隔离、聚合状态和失败/取消/未知项显式重试。当前仍未完成原生文件选择器、批处理 worker、真实 mask 素材、具体 provider tool capability、完整 remove-background UI 结果确认和真实 provider 质量验证。

本轮可复核证据：

- `pnpm test:unit`：136 files / 809 passed / 8 skipped。
- `pnpm exec vitest run --config vitest.config.ts src/features/canvas/CanvasWorkspace.test.tsx src/app/studio/Workbench.test.tsx src/features/image-tools src/features/tasks src/desktop/ipc/tasks.test.ts src/desktop/storage/task-store.test.ts`：12 files / 120 passed / 8 skipped。
- `pnpm typecheck`、`pnpm lint`、`git diff --check`：通过。

上述数字是本轮聚焦回归，不替代 2026-09-27 的全量门禁数字；全量 unit/integration/E2E/native、Windows、签名、公证、Keychain、live provider 和人工视觉质量仍按外部阻塞项处理。

## 维护规则

- 历史“全量通过”记录保留原日期和环境，不回写成当前结果。
- 任何影响已验证模块的改动，都要在 [模块验证与回归登记](MODULE-REGISTER.md) 追加变更、命令、结果和开放边界。
- 只有全量命令和适用平台证据都重新执行后，才能把模块从“部分验证”改为“已验证”。

## 2026-09-28 全功能闭环推进（当前工作树）

本轮新增并验证了候选与图像工具基础：`TaskRecord.result.toolCandidate` 持久化 `beforeScene`、`candidateScene`、源/结果素材、工具参数和 provider 元数据；Workbench 的图像结果先进入候选画布，支持原图/结果切换，只有确认才通过 `applyToolResult` 创建修订。实际选中图片图层仍通过 `targetLayerId` 传入，旧候选格式保持兼容。

已完成 mask 基础：矩形/笔刷栅格化为 grayscale PNG，支持越界裁剪和空 mask 拒绝；任务记录只保留 `maskAssetId`/`hasMask`，主进程可从受管素材重载，历史 `hasMask=true` 但缺少 ID 的任务不可自动重试。

已完成 provider 具体工具能力矩阵：能力声明、重复工具检测、mask/透明度/尺寸/参数范围校验和 adapter 请求前拒绝；未配置矩阵时使用兼容默认值，不自动切换连接。

已新增独立图像作业域模型和原子 JSON 存储，覆盖作业聚合状态、相对路径安全校验、失败/取消/未知项显式重试和重启恢复基础；`ImageToolsPage` 已提供作业管理 UI 组件，但原生文件/目录选择器、批处理 worker、暂停/公平调度和真实结果导入 IPC 尚未接通。

本轮聚焦证据：

- `src/features/agent/task-service.test.ts`、`src/features/image-tools/result-application.test.ts`、`src/app/studio/Workbench.test.tsx`：107 passed / 8 skipped。
- mask、provider、task storage/IPC、job store 聚焦套件：相关 116 passed；image-tool/provider 综合聚焦：171 passed / 8 skipped。
- `pnpm typecheck`、`pnpm lint`、`git diff --check`：通过。

仍未完成：真实 provider 样本质量/费用/远端取消、独立图像工具原生执行链、完整 remove-background 真实导出闭环、项目包大文件回滚、结构化智能编排、样机模板渲染、导出 codec 人工验收以及 Windows/签名/公证/Keychain 等外部门禁。上述项目继续单独标记为 blocked，不得按本轮聚焦测试关闭。

## 2026-09-25 本地完整性收口

本轮工作树已完成单项目库公共身份、存储/IPC/preload、App/Studio 和布局契约的回归收口，并将浏览器/native 入口迁移到首次启动和 project-library 流程。最新可复核结果：

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| `pnpm test:unit` | 135 个文件通过，796 passed、8 skipped | 仅保留明确 skip；无 unit failure。 |
| `pnpm test:integration` | 29 个文件通过，129 passed | 无 integration failure。 |
| `pnpm test:e2e` | 39/39 通过 | fixture 使用 bridge，不代表真实文件系统。 |
| `pnpm test:native` | source smoke 2 passed，packaged case 1 skipped | packaged skip 因未设置 `DESIGNHUB_PACKAGED_APP_PATH`；不宣称 packaged 通过。 |
| `pnpm test:provider` | 3/3 通过 | 仅离线 provider 契约；live provider 未执行。 |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | 通过 | build 保留 Vite bundle size warning。 |
| `git diff --check` | 通过 | 无空白错误。 |
| `pnpm exec electron-forge package --platform win32 --arch x64` | 在 macOS 上进入 win32 x64 finalization 后长时间无输出并中断 | 记录为 Forge/macOS dry-check 未完成；不能等同 Windows 运行证据。 |
| `pnpm release:check` | `passed-with-blockers`；8 个本地命令通过，package scan 通过 | blocked 仅包含 Windows、签名/公证、packaged native、Keychain、installer upgrade 和 live provider。 |

已新增 [ADR 0026](../adr/0026-single-project-library.md)。当前仍 blocked：Windows 真机/打包行为、签名公证、安装升级卸载、真实 Keychain 持久化、真实 provider 质量/费用/远端取消、跨设备恢复、高级编解码、大图性能和人工视觉质量。历史段落中的全绿数字仍只代表其原始日期和工作树，不能覆盖本节最新证据。
## 2026-09-28 门禁复核补充

在本轮候选、mask、provider 和 job-store 改动后重新执行：`pnpm test:unit` 138 files / 825 passed / 8 skipped；`pnpm test:integration` 29 files / 129 passed；`pnpm test:e2e` 41/41；`pnpm test:native` source 2 passed / packaged 1 skipped；`pnpm test:provider` 3/3；`pnpm lint`、`pnpm typecheck`、`pnpm build`、`git diff --check` 通过。build 仍有 bundle size warning。此数字替代本文件前文的旧日期数字，但不关闭任何外部发布门禁。
## 2026-09-28 继续推进记录

- 修复 Workbench 生成候选在 revision 尚未 hydrate 时不显示的回归。
- 修复 smart-crop 默认参数额外写入 `safeArea: 0` 的契约回归。
- 批量页面新增扫描预检和拒绝项展示；创建作业必须有可处理输入且无拒绝项。
- 批量结果新增打开、显示位置、打开输出目录和显式导入受管素材动作；导入由主进程校验输出根目录、结果路径和当前活动 `libraryId`。
- 当前聚焦验证：13 files / 139 passed / 8 skipped；typecheck 通过。全量门禁尚未在本轮完成，旧日期数字不代表本工作树现状。
- 外部/高风险门禁仍保持 blocked：真实 provider、Windows、签名、公证、Keychain、native packaged、项目包大文件/跨设备和人工视觉质量。

本轮最终门禁：`pnpm release:check` = `passed-with-blockers`；unit 144/843（8 skipped）、integration 29/129、E2E 41/41、native source 2 passed/packaged 1 skipped，lint/typecheck/build/diff-check/package scan 通过。live provider smoke 因未显式授权而 blocked。

## 2026-10-01 当前工作树推进

本轮关闭了两个本地功能缺口：

1. 新建项目抽屉接入标准设计、智能构图和样机模式。智能构图候选保留核心/可选/参考素材角色；样机模式接入内置手机屏幕、海报画框、包装袋模板及颜色/最小尺寸校验。所有结果以候选场景打开 Workbench，确认前不落正式修订。
2. 项目包新增存储层导出服务和跨项目库交接集成测试，验证源库隔离后仍可导入、重开、编辑、提交新修订并再次导出；外部 ZIP 使用临时文件和 no-replace 发布，目标冲突不覆盖且临时文件清理。

新鲜聚焦验证：21 个文件，247 passed、8 skipped；`pnpm typecheck`、`pnpm lint`、`pnpm build`、`git diff --check` 通过。尚未重新执行全量 unit/integration/E2E/native/provider/release-check，因此历史全量数字不作为本轮全量证据。

仍保持 blocked：ZIP 流式/固定内存大包处理、批量 native 文件选择器实机、真实 provider 质量/费用/远端取消、Windows 真机、签名/公证、Keychain、跨设备恢复、packaged native 和人工视觉质量。

## 2026-10-01 候选恢复与当前全量门禁

智能构图和样机候选现已由任务存储持久化。重启后 Workbench 会恢复同一项目、同一文档中尚未解决的候选；确认或放弃会写入 `confirmed` / `discarded` 审计状态，避免候选在下一次启动重复出现。发布边界校验活动 `libraryId`、可写 lease、项目/文档归属、正式 scene schema 和受管素材引用。

本轮新鲜结果：unit 148 files / 905 passed / 8 skipped；integration 30 files / 131 passed；E2E 47/47；native source 2 passed / packaged 1 skipped；provider offline 3/3；lint、typecheck、build、diff-check 通过。浏览器 E2E 仍是 bridge fixture，native packaged 仍因未配置 `DESIGNHUB_PACKAGED_APP_PATH` 跳过。

本地仍未关闭：ZIP 流式/固定内存大包处理和 benchmark。外部或授权门禁仍为真实 provider、Windows、签名/公证、Keychain、安装升级、跨设备恢复、packaged native 和人工视觉质量。

## 2026-10-01 代码优化推进

- 任务服务新增纯函数 task error policy，保持原有错误优先级和公共 AgentTaskService facade；新增候选确认幂等回归测试，确认重复 resolve 不重复写入持久化状态。
- 批量图像工具页面抽出 view-model helpers，集中处理作业过滤、进度、内容名、路径冲突、结果预览路径和 active/unknown 状态判断；页面继续保留现有 bridge 与交互契约。
- 主进程批量图像工具 IPC 注册抽为独立、可测试的 register-image-tools 模块，频道名称和 handler 入参保持不变。
- 本轮聚焦证据：unit 151 files / 914 passed / 8 skipped；integration 30 files / 131 passed；聚焦 image-tools/candidate E2E 4/4；native source 2 passed / packaged 1 skipped；provider offline 3/3；lint、typecheck、build、git diff --check 通过。
- 完整 browser E2E 首次重跑中途出现 18 个 ERR_CONNECTION_REFUSED，已确认聚焦 image-tools/candidate E2E 通过；该环境性失败不能标记全量 E2E 通过，需在稳定 web server 后单独重跑。
- build 仍有 renderer bundle size warning；ZIP 大包流式、真实 provider、Windows、签名/公证、Keychain、packaged native 和人工视觉质量继续 blocked。

## 2026-10-02 设置与 provider IPC 续推进

- 将 settings 与 provider 配置 IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-settings-provider.ts，保持活动 libraryId 绑定、可信发送方校验、设置 schema 校验和 provider 配置归一化不变。
- 新增 register-settings-provider.test.ts，并将 settings/provider 合约套件纳入 pnpm test:focused；聚焦验证 3 files / 5 passed。
- pnpm lint、pnpm typecheck 通过；本轮未重新宣称全量 E2E、native packaged 或真实 provider 通过。
- Task 5（主进程 IPC 与存储分层）仍为 partial，agent/package/export/search/backup 等注册组继续保留在 main.ts，后续按相同兼容策略增量拆分。

## 2026-10-02 代码优化续推进

- 将任务列表与候选构图发布/决议的 IPC 注册从 src/desktop/main.ts 抽出到 src/desktop/ipc/register-task-handlers.ts，保持频道名、活动 libraryId 校验、可写项目库边界和候选素材校验不变。
- 新增 src/desktop/ipc/register-task-handlers.test.ts，并纳入 pnpm test:focused；聚焦 IPC 套件 2 files / 4 passed。
- pnpm lint、pnpm typecheck 通过；本轮未重新宣称全量 E2E、native packaged 或真实 provider 通过。
- Task 5（主进程 IPC 与存储分层）仍为 partial，agent/settings/package/export 等注册组继续保留在 main.ts，后续按相同兼容策略增量拆分。

## 2026-10-02 代码优化推进续记

- Workbench 候选选择、候选场景解析和未解决候选恢复已抽为 `src/app/studio/candidate-controller.ts`；任务刷新/清理生命周期已抽为 `src/app/studio/task-polling.ts`。公共 props、bridge 和候选修订语义保持不变。
- `pnpm test:focused` 已扩展到候选控制器、任务轮询和 Workbench 回归；本轮 9 files / 108 passed / 8 skipped。
- 新鲜全量本地证据：`pnpm test:unit` 153 files / 921 passed / 8 skipped；`pnpm test:integration` 30 files / 131 passed；`pnpm lint`、`pnpm typecheck`、`pnpm build`、`git diff --check` 通过。
- 构建后 renderer 初始 chunk 824.91 kB，ImageToolsPage 独立 chunk 28.70 kB；Vite 仍报告 500 kB 以上 warning，后续继续处理。
- 完整 browser E2E 仍未重新形成全绿证据；此前重跑在 29 个通过后出现 18 个 `ERR_CONNECTION_REFUSED`，需稳定 preview server 后重跑。

## 2026-10-05 code optimization continuation

- Main-process IPC registration is now fully separated from `main.ts`: portfolio channels use `register-portfolio.ts`; agent/task/conversation/image channels use `register-agent.ts`.
- Public typed IPC names, `libraryId` authorization, writable-library checks, provider selection, task cancellation/retry and portfolio source behavior were preserved.
- Fresh focused verification: `pnpm test:focused` 41 files / 182 passed / 8 skipped; `pnpm test:unit` 166 files / 937 passed / 8 skipped; `pnpm test:integration` 30 files / 131 passed; `pnpm lint`, `pnpm typecheck`, and `git diff --check` passed.
- This is not a full release gate result. Renderer initial chunk remains 824.91 kB with the Vite warning; storage/domain split, package large-file memory evidence, stable full E2E, packaged native, live provider, Windows, signing/notarization, Keychain, ZIP streaming and human visual QA remain open or blocked.

补充：本轮随后完成稳定 preview server 下的完整门禁，`pnpm test:e2e` 47/47 通过；`pnpm test:native` source 2 passed / packaged 1 skipped；`pnpm release:check` 为 `passed-with-blockers`，package scan 433 files。此前 connection-refused 的 E2E 记录仅保留为历史环境失败，不再代表当前 E2E 结果。

离线 provider 契约随后复核为 3/3 通过；live provider smoke 仍未执行并保持 blocked。

## 2026-10-05 ImageTools preview state continuation

- Extracted result preview hydration and lifecycle protection into `src/features/image-tools/use-image-tool-previews.ts` without changing bridge payloads or fallback behavior.
- Focused verification: 42 files / 184 passed / 8 skipped; lint, typecheck and diff-check passed.
- Remaining optimization work includes the rest of the ImageTools page/backend split and the 824.91 kB renderer chunk warning.

## 2026-10-06 代码优化推进

- 已完成：TaskRecord factory、任务状态机 facade、批量图像命令 facade、独立任务/批量性能门槛测试。
- 最新聚焦证据：45 files / 191 passed / 8 skipped；性能测试 2/2；unit 170 files / 946 passed / 8 skipped；integration 30 files / 131 passed；lint/typecheck/build/diff-check 通过。
- 仍未完成：任务 executor/recovery/candidate/runtime adapter 全量拆分，ImageTools 页面和批量后端完整职责拆分，Studio/Workbench 状态继续收口，desktop service/storage 深拆，项目包固定内存优化，renderer 初始 chunk <500 kB。
- 外部 blocked：Windows、签名/公证、Keychain、packaged native、真实 provider 质量/费用/远端取消、ZIP 严格流式和人工视觉质量。

## 2026-10-07 剩余优化状态

本轮完成任务链拆分、批量页面/后端边界、Workbench 选中图层提交控制器、task service factory、项目包重复 copy 优化、共享 fixture 和独立 package/image-tools 性能命令。公共 `libraryId`、typed IPC、TaskRecord 和候选修订协议未改变。

实际聚焦证据：任务链 6 files / 98 passed；image-tools 17 files / 62 passed；Workbench/controller 3 files / 60 passed；package/image-tools perf 2/2；项目包 handoff 8/8。renderer 初始 chunk、严格 ZIP 固定内存、其余 desktop service 下沉和外部发布门禁仍未关闭。

## 2026-10-07 剩余优化本地关账

本轮继续完成 desktop service 与 renderer 构建边界：`provider-service.ts` 负责批量 provider adapter 调用，`image-tool-service.ts` 负责批量素材导入与 provider service 组装，`project-package-service.ts` 负责项目包选择器、归档写入和导入入口；main 只保留服务装配，公共 typed IPC、preload 白名单和 `libraryId` 运行时身份不变。

Vite 构建使用函数式 `manualChunks` 分离画布依赖，实际产物为入口 `index` 499.19 kB、`canvas` 325.60 kB、`ImageToolsPage` 30.15 kB，未再出现 >500 kB warning。该结果只证明 chunk 阈值与构建稳定性，不等价于首屏网络加载 profile 完成。

最新 `pnpm release:check`：unit 176 files / 965 passed / 8 skipped；integration 30 files / 131 passed；E2E 47/47；native source 2 passed / packaged 1 skipped；provider offline 3/3；lint、typecheck、build、diff-check、package scan 435 files 通过。严格 ZIP streaming/fixed-memory、Windows、packaged native、签名/公证、Keychain、live provider、跨设备恢复、安装升级和人工视觉质量仍为 `blocked`。
