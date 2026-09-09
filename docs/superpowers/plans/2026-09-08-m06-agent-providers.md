# M06 Agent 与模型连接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成可配置能力、受限项目上下文、透明任务执行/恢复，并接通创建简报和作品集分析。

**Architecture:** 固定内置适配器暴露真实能力，任务绑定来源与基版本；统一 runtime 为聊天和工具服务。Electron main 通过经 G07 验证的系统凭据适配器读取 Key 并发起提供方请求，UI 获得连接标识和状态；用户输入 Key 后发送并清空，已存 Key 不读回 UI。

**Tech Stack:** G07 系统安全存储；G08 提供方 SDK/HTTP；不选任意脚本框架；准确依赖版本在研究采用记录中锁定。

**Spec:** [首版架构](../specs/2026-09-08-designhub-v1-design.md)，[UI 说明书](../../product/APPLICATION-GUIDE-FOR-UI.md)，[主计划](2026-09-08-designhub-v1.md)。

## Global Constraints

- 先调研成熟框架或第三方库，再写对应功能实现；未核验候选不等于选型。
- 按模块先写测试用例和 checklist，再实现并对照验证；改到已验证模块必须记录影响并回归。
- 所有自写函数遵守用户“箭头函数”要求；不能默许原生代码例外。
- 核心浏览、编辑、历史、检索、导出、备份离线可用；云请求不在重连后静默提交。
- 无平台账户；提供方密钥只存系统安全存储，不进项目、包、备份、日志。
- 主计划的其余全局约束和模块记录协议全部适用。先创建 `docs/verification/M06.md`，再实现下列目标文件。
- 下列代码是计划中的行为测试及核心规则片段；完整用例还必须覆盖每项验收场景，不以片段替代模块交付。

## Task 1: 安全连接、能力与告知

**Files:**
- Create: `src/features/providers/connection.ts`, `src/features/providers/connection.test.ts`
- Create: `src/features/providers/ProviderSettings.tsx`, `src/platform/credentials.ts`
- Create: `src/desktop/security/credentials.ts`；platform 只负责 store/delete 桥接，desktop 才持有系统凭据实现
- Create: `tests/integration/credential-boundary.test.ts`

**Interfaces:** `connectionSummary: (input:{id:string; label:string; apiKey:string}) => {id:string; label:string}`。`storeCredential(connectionId, secret)` / `deleteCredential(connectionId)` 为宿主能力；禁止提供向 UI 返回明文的通用 getSecret 接口。

ADR 0015 的系统凭据存储要求仍有效：先研究成熟 Node keyring 绑定的 macOS/Windows 支持、维护和打包行为。safeStorage 返回应用管理的密文，不直接充当系统凭据条目；不得因为切换 Electron 就改变存储语义。提供方适配器的网络执行入口归 main，renderer 只传 connectionId/能力/已批准素材，不负责解密或拼带 Key 的请求。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { connectionSummary } from './connection';

it('可持久化摘要按白名单排除密钥', () => {
  const summary = connectionSummary({ id: 'p1', label: '工作连接', apiKey: 'test-secret' });
  expect(summary).toEqual({ id: 'p1', label: '工作连接' });
  expect(JSON.stringify(summary)).not.toContain('test-secret');
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/providers/connection.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const connectionSummary = (input: { id: string; label: string; apiKey: string }) =>
  ({ id: input.id, label: input.label });
```

选择至少满足对话/视觉分析/图像生成/编辑实际需求的内置适配器组合，逐个列能力矩阵。原生凭据失败不落明文。连接设置、检测与能力分配支持离线/凭据错误恢复；云首次连接、提供方变更和首次原图上传显示已确认产品告知，任务持续显示范围。未知成本显示未知。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/providers/connection.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 项目、备份、包和诊断扫描均无测试密钥；系统存储拒绝时不会降级明文。
- [ ] 本地服务连接不下载模型；退出本地服务后正确报错，不切云端。
- [ ] 每项模型能力有真实文档与测试证据；缺能力的工具提供恢复入口。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 2: 上下文隔离与工具白名单

**Files:**
- Create: `src/features/agent/context.ts`, `src/features/agent/context.test.ts`
- Create: `src/features/agent/tool-contracts.ts`, `tests/integration/agent-boundaries.test.ts`

**Interfaces:** `selectContextAssets: (assets:{id:string; projectId:string}[], projectId:string, currentAssetIds:string[], explicitlyAttached:string[]) => string[]`；currentAssetIds 仅为当前文档所需资源，不能含本项目素材库全集。简报/品牌/设计师与相关时间线通过独立明确字段加入。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { selectContextAssets } from './context';

it('不隐式读取同工作区其他项目', () => {
  const assets = [{ id: 'a', projectId: 'p1' }, { id: 'b', projectId: 'p2' }];
  expect(selectContextAssets(assets, 'p1', ['a', 'b'], [])).toEqual(['a']);
  expect(selectContextAssets(assets, 'p1', [], ['b'])).toEqual(['b']);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/agent/context.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const selectContextAssets = (
  assets: { id: string; projectId: string }[],
  projectId: string, currentAssetIds: string[], explicitlyAttached: string[],
) => assets.filter((asset) =>
  (asset.projectId === projectId && currentAssetIds.includes(asset.id))
  || explicitlyAttached.includes(asset.id)
).map((asset) => asset.id);
```

当前文档所需图像由调用端展开到 currentAssetIds；跨项目需用户授权附加后才进入 explicitlyAttached，函数不能自行推断用户授权。真实上下文编排校验来源权限并生成可查看上传清单。工具仅限 M04/M05/M07 的能力接口，校验目标、参数和能力；外部资料里的命令不获得额外权限。用 M04 resolveConstraint 合并规则，显著品牌冲突可见。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/agent/context.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 没有附加的本项目素材同样不会上传；跨项目未经显式附加拒绝。
- [ ] 恶意作品集文本不能触发 shell、全盘读取或新提供方连接。
- [ ] 只保存用户可见最终指令和参数；不日志凭据/隐藏提示词。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 3: 持久任务、取消、恢复及幂等落版

**Files:**
- Create: `src/features/tasks/state.ts`, `src/features/tasks/state.test.ts`, `src/features/tasks/runtime.ts`
- Create: `src/features/tasks/TaskDetails.tsx`, `tests/integration/task-recovery.test.ts`

**Interfaces:** `TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'`；`mayTransition: (from:TaskState,to:TaskState) => boolean`。任务来源 `{kind:'project'|'creation-draft'|'designer-draft'; id:string}`；图像任务另绑定 documentId/baseRevisionId/designerVersionId。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { mayTransition } from './state';

it('取消后迟到完成不能覆盖状态，终态不能自动重跑', () => {
  expect(mayTransition('cancelled', 'completed')).toBe(false);
  expect(mayTransition('completed', 'running')).toBe(false);
  expect(mayTransition('running', 'completed')).toBe(true);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/tasks/state.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export type TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
const transitions: Record<TaskState, TaskState[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['completed', 'cancelled', 'failed'],
  completed: [], failed: [], cancelled: [],
};
export const mayTransition = (from: TaskState, to: TaskState) => transitions[from].includes(to);
```

重试创建新的 attempt/task 并关联原请求，终态不回退。取消请求先标单独 cancelRequested，确认后终止；不支持远端取消时说明只停止等待。重启优先查 request ID，结果未知不重发。成功用 M04 commitRevision(operationId) 原子落版；保留实际提供方、参数、引用、用量、时间与结果。元数据中的 operationId/remoteRequestId 不替代提供方真实幂等保证。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/tasks/state.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 同回调重复到达、崩溃发生在下载/落版/完成登记三个位置均不重复出版本。
- [ ] 离线排队项重连不自动上传；未知远端结果不自动收费重试。
- [ ] 取消不支持/取消失败/超时/限流/坏图片/部分候选失败都有具体恢复。
- [ ] 提供方无法查询历史时如实显示结果未知；用户可明确另建尝试。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 4: 统一对话、交接和候选接入

**Files:**
- Create: `src/features/agent/handoff.ts`, `src/features/agent/handoff.test.ts`, `src/features/agent/ProjectConversation.tsx`
- Create: `src/features/agent/analyze-portfolio.ts`, `src/features/agent/draft-brief.ts`
- Modify: M03 `PortfolioReview.tsx`, M04 `CreationConversation.tsx`
- Create: `tests/e2e/agent-workflow.spec.ts`

**Interfaces:** `switchDesigner: (state:{activeDesignerVersionId:string}, next:string) => {activeDesignerVersionId:string}`，只更改未来请求。`analyzePortfolio({sourceIds, designerDraftId, connectionId})` 返回 `Promise<{taskId:string; designerDraftId:string}>`；`draftBrief({text, creationDraftId, connectionId})` 返回 `Promise<{taskId:string; creationDraftId:string}>`。两者的结果通过 Task 3 持久任务写入可审阅草稿，签名与架构说明第 6.1 节一致。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { switchDesigner } from './handoff';

it('切换不修改已提交任务的设计师快照', () => {
  const project = { activeDesignerVersionId: 'a-v1' };
  const task = { designerVersionId: project.activeDesignerVersionId };
  expect(switchDesigner(project, 'b-v1').activeDesignerVersionId).toBe('b-v1');
  expect(task.designerVersionId).toBe('a-v1');
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/agent/handoff.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const switchDesigner = (
  state: { activeDesignerVersionId: string }, next: string,
) => ({ ...state, activeDesignerVersionId: next });
```

切换后将目标/固定文案/已选方向/待处理事项形成可见摘要并入项目时间线。流式消息、停止文本与图像任务取消分开。清晰请求按可见数量产生 2–4 候选，含糊目标先问；费用和能力限制不静默隐藏。图像生成使用当前可编辑场景的明确渲染/选区输入，结果为新栅格层或候选文档，不承诺自动拆分文字图层。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/agent/handoff.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] M03 真实图片选择→分析草稿→编辑→发布闭环通过并更新其部分验证状态。
- [ ] M04 真实对话→简报卡→用户确认→项目→生成闭环通过，不提前建项目。
- [ ] A 生成→B 接手→新版本中历史贡献可追溯；A 进行中任务不会被 B 接管。
- [ ] 候选失败部分重试不重复成功项，成本未知不显示 0；缺连接可继续手动工作。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。
