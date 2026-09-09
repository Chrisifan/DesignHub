# M08 检索、设置与发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成本地分类检索、偏好与本地诊断包，并验证完整首版双平台可用。

**Architecture:** 索引可重建、源数据仍属于项目；设置分本机/工作区/项目。发布验收使用所有模块真实集成，不用浏览器假文件后端代替原生。

**Tech Stack:** G10 UI/Electron 原生自动化；G11 SQLite FTS5 或已验证本地查询；Electron Forge（或经研究通过的打包器）签名链路；准确依赖版本在研究采用记录中锁定。

**Spec:** [首版架构](../specs/2026-09-08-designhub-v1-design.md)，[UI 说明书](../../product/APPLICATION-GUIDE-FOR-UI.md)，[主计划](2026-09-08-designhub-v1.md)。

## Global Constraints

- 先调研成熟框架或第三方库，再写对应功能实现；未核验候选不等于选型。
- 按模块先写测试用例和 checklist，再实现并对照验证；改到已验证模块必须记录影响并回归。
- 所有自写函数遵守用户“箭头函数”要求；不能默许原生代码例外。
- 核心浏览、编辑、历史、检索、导出、备份离线可用；云请求不在重连后静默提交。
- 无平台账户；提供方密钥只存系统安全存储，不进项目、包、备份、日志。
- 主计划的其余全局约束和模块记录协议全部适用。先创建 `docs/verification/M08.md`，再实现下列目标文件。
- 下列代码是计划中的行为测试及核心规则片段；完整用例还必须覆盖每项验收场景，不以片段替代模块交付。

## Task 1: 本地全文检索与贡献筛选

**Files:**
- Create: `src/features/library/filter.ts`, `src/features/library/filter.test.ts`
- Create: `src/features/library/indexer.ts`, `src/features/library/LibrarySearch.tsx`
- Create: `tests/integration/search-index.test.ts`

**Interfaces:** `matchesDesigner: (item:{contributorIds:string[]}, designerId:string) => boolean`；索引包含项目/文档元数据、简报、品牌、尺寸、定稿、标签、时间和贡献集合，排除凭据与隐藏提示。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { matchesDesigner } from './filter';

it('按历史贡献者检索，不限当前活跃设计师', () => {
  expect(matchesDesigner({ contributorIds: ['designer-a', 'designer-b'] }, 'designer-a')).toBe(true);
  expect(matchesDesigner({ contributorIds: ['designer-b'] }, 'designer-a')).toBe(false);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/library/filter.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const matchesDesigner = (
  item: { contributorIds: string[] }, designerId: string,
) => item.contributorIds.includes(designerId);
```

G11 用“春间市集”“春间”“市集”“Spring Market”验证中文/英文检索。仅 FTS 英文 tokenizer 可用不算中文通过；评估可维护的中文/子串方案，无需自研语义检索。索引崩溃可重建，结果定位到准确项目文档。筛选返回时保留；无结果与索引未完成区分。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/library/filter.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 归档设计师贡献旧作品仍命中；多个贡献去重，不重复项目卡。
- [ ] 删掉本地索引再重建结果一致；编辑/删除/恢复/导入后结果更新。
- [ ] 未连接网络时所有检索可用，工作区切换不会泄露错误作用域结果。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 2: 设置作用域、操作者、本地诊断包与离线

**Files:**
- Create: `src/features/settings/diagnostics.ts`, `src/features/settings/diagnostics.test.ts`
- Create: `src/features/settings/SettingsView.tsx`, `tests/e2e/offline-settings.spec.ts`

**Interfaces:** `isDiagnosticFieldAllowed: (field:'runtime'|'errorCode'|'projectPath'|'prompt'|'credential') => boolean`；本地诊断包只包含白名单字段，不含创作内容、项目结构、路径、提示或密钥，也没有网络发送入口。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { isDiagnosticFieldAllowed } from './diagnostics';

it('本地诊断包只接受脱敏白名单字段', () => {
  expect(isDiagnosticFieldAllowed('runtime')).toBe(true);
  expect(isDiagnosticFieldAllowed('errorCode')).toBe(true);
  expect(isDiagnosticFieldAllowed('projectPath')).toBe(false);
  expect(isDiagnosticFieldAllowed('prompt')).toBe(false);
  expect(isDiagnosticFieldAllowed('credential')).toBe(false);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/settings/diagnostics.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const isDiagnosticFieldAllowed = (
  field: 'runtime' | 'errorCode' | 'projectPath' | 'prompt' | 'credential',
) => field === 'runtime' || field === 'errorCode';
```

实现中文/英文、全局默认、本机操作者档案、工作区默认、备份设置与本地诊断包；项目覆盖回到项目设置。本机操作者档案只提供可选显示身份，不建立账号或权限。诊断包导出前显示脱敏预览并由用户选择保存位置；首版没有自动发送、遥测开关或接收端，也不因该功能引入平台账户。离线显示云能力不可用，不禁用编辑。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/settings/diagnostics.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 诊断预览与实际导出字段一致；触发预览或导出时网络探针看到零诊断请求。
- [ ] 诊断包无素材、项目结构、路径、提示、隐藏信息和测试 Key，保存取消不会留下误标成功的文件。
- [ ] 项目迁移后保留旧操作者名称快照，新操作使用当前设备档案；操作者资料不参与工作区读写权限。
- [ ] 断网做创建/编辑/历史/检索/导出/备份可完成，重连不自动上传云草稿。
- [ ] 缩放、减少动态、键盘、读屏、语言切换覆盖 P01–P20 的适用状态。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 3: 首版全链路及双平台发布验收

**Files:** 创建 `tests/e2e/full-design-journey.spec.ts`、`tests/e2e/failure-recovery.spec.ts`、`docs/verification/RELEASE.md`、`docs/release/INSTALLATION.md`；修改选定宿主的构建/签名/升级配置和相应 package scripts。

**Interfaces:** 输入全部模块的已验证契约和 UI P01–P20；输出安装包、精确版本/哈希、双平台验证记录及可追踪的发布问题。此任务的代码主要为验收流程及采用宿主的官方配置，不编造尚未选型的签名字段。

Electron 发布回归增加：安装包内 main/preload 正确寻址，native 模块预编译/重建及 ASAR 外置配置有效，窗口隔离设置未被测试配置关闭，签名更新后系统凭据仍可用，升级与卸载保留用户数据。自动化调试配置与最终签名包检查分别记录，不为驱动测试永久开放生产调试入口。每次 Electron 升级按其内置 Chromium/Node 与 native 依赖重新核验。

- [ ] **Step 1：实施前在 RELEASE.md 写清完整用例。** 使用 UI 第 23 节“春间市集”素材：建工作区→描述创建 A→手动项目→导入原图→生成两方向→编辑文字→B 接手换背景→方图→分别定稿→导出/包→另一设备打开。另独立验证对话建项目及作品集建档。
- [ ] **Step 2：写端到端断言并先确认失败。** 测试 ID REL01 检查最终 PNG 像素、两个文档定稿及 A/B 贡献；REL02 检查项目包导入后的历史、原图和离线编辑；REL03 检查首次原图上传同意/费用/取消。浏览器 mock、原生和真模型三种运行结果分别记录。
- [ ] **Step 3：对六类异常增加故障用例。** 第二候选失败、B 模型不可用、生成期间继续编辑、导出盘拔出、新机器缺字体、A 被归档；预期分别是部分成功、明确替代、旧基版分支、失败可重试、替换提示和历史保留。
- [ ] **Step 4：只修复已计划功能的集成缺陷。** 每个缺陷指向所属 M 模块并置需回归；不在发布阶段顺带增加新编辑器能力或服务器。
- [ ] **Step 5：分别运行** `pnpm lint`、`pnpm typecheck`、`pnpm test:unit`、`pnpm test:integration`、`pnpm test:e2e -- tests/e2e/full-design-journey.spec.ts`、`pnpm test:native`、`pnpm build`。所有命令在 M01/M02 已建立；没有可用原生驱动时按 G01 采用的真实方案执行并留证据。
- [ ] **Step 6：两平台安装发布包验收。** 正常安装、首次启动、系统权限/密钥、升级、格式迁移、更新失败恢复、卸载不删除工作区。签名与 macOS 公证依实际证书和官方流程执行，未取得凭据不能标为正式分发完成。
- [ ] **Step 7：检查大图与长历史压力样本。** 使用 G01 基准机器和素材；100 个项目、每项目 10 文档、长会话/大量缩略图作为工程测试样本，记录加载、交互及内存，不将该样本当市场上限。
- [ ] **Step 8：核对需求追踪与回归登记。** 主计划 Q1–Q66 全部有落点，M01–M08 无需回归残留；核对许可清单、版本锁定、UI 状态交付、离线说明和恢复文档。
- [ ] **Step 9：交付可审阅包和证据。** 发布到外部分发渠道是单独动作，在没有用户授权前只准备安装包与记录；本计划不默认上传用户数据或发布商店。

**完成条件：** 上述用例真实通过且有平台证据。若缺 Windows、真实提供方或签名权限，相关行保持未验证；其他已验证工作可交接，但不可称完整首版双平台已发布。
