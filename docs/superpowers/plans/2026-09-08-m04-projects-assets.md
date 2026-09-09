# M04 项目、素材与修订 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建两条创建路径、多文档项目、品牌快照、受管素材及统一历史。

**Architecture:** 消费 M02 原子存储和 M03 档案版本，输出后续画布/Agent/工具共用的文档与修订接口。正式项目和创建草稿分开。

**Tech Stack:** React、schema 校验、M02 存储；G06 图像解码，模型创建依赖 M06；准确依赖版本在研究采用记录中锁定。

**Spec:** [首版架构](../specs/2026-09-08-designhub-v1-design.md)，[UI 说明书](../../product/APPLICATION-GUIDE-FOR-UI.md)，[主计划](2026-09-08-designhub-v1.md)。

## Global Constraints

- Electron 中项目创建、素材落盘和修订提交通过 platform 到 main 的同一受控用例；批量解码走 M07 的后台能力。renderer 的设计师/文档切换不得重新创建数据库连接或绕过 M02 事务。

- 先调研成熟框架或第三方库，再写对应功能实现；未核验候选不等于选型。
- 按模块先写测试用例和 checklist，再实现并对照验证；改到已验证模块必须记录影响并回归。
- 所有自写函数遵守用户“箭头函数”要求；不能默许原生代码例外。
- 核心浏览、编辑、历史、检索、导出、备份离线可用；云请求不在重连后静默提交。
- 无平台账户；提供方密钥只存系统安全存储，不进项目、包、备份、日志。
- 主计划的其余全局约束和模块记录协议全部适用。先创建 `docs/verification/M04.md`，再实现下列目标文件。
- 下列代码是计划中的行为测试及核心规则片段；完整用例还必须覆盖每项验收场景，不以片段替代模块交付。

## Task 1: 两种简报入口与创建确认

**Files:**
- Create: `src/features/projects/brief.ts`, `src/features/projects/brief.test.ts`
- Create: `src/features/projects/NewProject.tsx`, `src/features/projects/CreationConversation.tsx`
- Create: `src/features/projects/create-project.ts`, `tests/e2e/project-creation.spec.ts`

**Interfaces:** `confirmBrief: (draft: {name:string; workspaceId:string}, confirmed:boolean) => {name:string; workspaceId:string}`；调用 M02 createProjectContainer 并保存简报/设计师/品牌快照。M06 形成的草稿走同一函数。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { confirmBrief } from './brief';

it('对话建议不能代替明确创建确认', () => {
  const draft = { name: '春间市集', workspaceId: 'w1' };
  expect(() => confirmBrief(draft, false)).toThrow('CONFIRM_REQUIRED');
  expect(confirmBrief(draft, true)).toEqual(draft);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/projects/brief.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const confirmBrief = (
  draft: { name: string; workspaceId: string }, confirmed: boolean,
) => {
  if (!confirmed) throw new Error('CONFIRM_REQUIRED');
  if (!draft.name.trim() || !draft.workspaceId) throw new Error('INVALID_BRIEF');
  return { ...draft, name: draft.name.trim() };
};
```

建立手动表单和本地创建对话草稿，包含 UI P03 字段；无连接可手动开始，不自动图像生成。明确确认后使用幂等操作键创建，初始对话入时间线。补齐项目活跃/归档、重命名、复制以及多文档入口；复制生成新 ID 并记录来源。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/projects/brief.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 手动空白项目不需 Key；取消创建没有正式项目目录。
- [ ] 两入口相同简报得到相同领域数据；创建失败重试不重复。
- [ ] M06 前对话入口只验证草稿编辑契约；接入后验证真实整理简报、确认和转入项目。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 2: 不可变版本、分支、定稿与贡献

**Files:**
- Create: `src/features/revisions/model.ts`, `src/features/revisions/model.test.ts`
- Create: `src/features/revisions/commit-revision.ts`, `src/features/revisions/Timeline.tsx`, `src/features/revisions/CompareRevisions.tsx`
- Create: `tests/integration/revisions.test.ts`

**Interfaces:** `branchRevision: (base:{id:string; documentId:string}, id:string) => {id:string; documentId:string; parentId:string}`；`commitRevision` 存资源、场景、设计师贡献、本机操作者名称快照及唯一 operationId，返回新 revisionId。定稿由 `setFinalRevision(documentId, revisionId)` 用例校验同文档后更新指向。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { branchRevision } from './model';

it('迟到生成基于原始版本分支，不改写原版本', () => {
  const base = { id: 'r1', documentId: 'd1' };
  expect(branchRevision(base, 'r3')).toEqual({ id: 'r3', documentId: 'd1', parentId: 'r1' });
  expect(base).toEqual({ id: 'r1', documentId: 'd1' });
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/revisions/model.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const branchRevision = (
  base: { id: string; documentId: string }, id: string,
) => ({ id, documentId: base.documentId, parentId: base.id });
```

实现架构中的结果提交事务，operationId 唯一确保重发不重复落版。场景快照、父版本、设计师版本/角色和适用的本机操作者名称快照是显式字段。定稿改变记录事件但不改作品；新编辑不移走定稿。时间线汇集消息、工具、版本及交接。当前版本通过祖先关系追溯贡献，直接工具不自动伪造设计师贡献。项目跨设备后旧操作者快照保持，新手工操作使用当前设备档案。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/revisions/model.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 重复完成回调只生成一版；引用跨文档父版本/定稿被拒绝。
- [ ] r1 开始生成、用户完成 r2、到达 r3 时当前 r2 和定稿保持；r3 可独立选择。
- [ ] 署名不随设计师重命名/归档变化；切换无贡献不会自动署名。
- [ ] 本机操作者档案变更或跨设备打开不改写旧操作记录；它不参与权限判断或冒充设计师贡献。
- [ ] 历史比较、从旧版继续、两个关联尺寸文档独立定稿均可交互。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 3: 品牌快照、覆盖与关联尺寸

**Files:**
- Create: `src/features/brands/constraints.ts`, `src/features/brands/constraints.test.ts`, `src/features/brands/BrandEditor.tsx`
- Create: `src/features/projects/related-document.ts`, `tests/integration/brand-snapshots.test.ts`

**Interfaces:** `resolveConstraint: (input:{instruction?:string; document?:string; brand?:string; designer?:string; global?:string}) => string | undefined`；关联文档复制来源 ID/版本，尺寸和场景为独立状态。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { resolveConstraint } from './constraints';

it('当前明确指令优先，空字符串是明确清空', () => {
  expect(resolveConstraint({ instruction: '白色', brand: '黑色' })).toBe('白色');
  expect(resolveConstraint({ document: '', brand: '品牌标题' })).toBe('');
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/brands/constraints.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const resolveConstraint = (input: {
  instruction?: string; document?: string; brand?: string;
  designer?: string; global?: string;
}) => input.instruction ?? input.document ?? input.brand ?? input.designer ?? input.global;
```

品牌 CRUD 包含 Logo/色板/字体/语气/固定文案/尺寸，项目采用深复制快照。覆盖显示来源与差异；用户主动采用新版才影响后续工作。建立尺寸/简报预设和关联文档，转换提示裁切与文字溢出，不添加响应式排版引擎。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/brands/constraints.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 编辑品牌库不改变既有项目或历史；显式采用有差异记录。
- [ ] 同活动方图与竖图尺寸/布局/定稿独立，引用来源可查看。
- [ ] 字体文件不默认塞入包；字体要求和缺字检测交 M05/M07 验证。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 4: 受管素材、格式导入与依赖闭包

**Files:**
- Create: `src/features/assets/retention.ts`, `src/features/assets/retention.test.ts`
- Create: `src/features/assets/import-assets.ts`, `src/features/assets/AssetLibrary.tsx`
- Create: `tests/integration/assets-import.test.ts`, `tests/fixtures/images/README.md`

**Interfaces:** `referencedAssetIds: (revisions: {assetIds:string[]}[]) => string[]` 输出去重的完整资源集合；importAssets 逐项返回成功/错误，成功保存完整原图与解码元数据。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { referencedAssetIds } from './retention';

it('备份和打包保留旧版本仍引用的素材', () => {
  expect(referencedAssetIds([{ assetIds: ['old', 'logo'] }, { assetIds: ['new', 'logo'] }]))
    .toEqual(['old', 'logo', 'new']);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/assets/retention.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const referencedAssetIds = (revisions: { assetIds: string[] }[]) =>
  [...new Set(revisions.flatMap((revision) => revision.assetIds))];
```

G06 通过后实现 PNG/JPEG/WebP/HEIC/SVG、动图首帧、PDF 选页与 PSD 合成预览。受管原图按内容去重，验证尺寸与哈希，不改原文件。高级外部引用明确标识并提供转为受管副本。闭包还包含品牌/设计师归档资源，字体遵循许可携带规则。项目包由 M07 收集闭包，M02 的清空引用保护使用同一结果。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/assets/retention.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 所有声明格式在两平台各有许可样本；不能解码的 PSD 明确失败，不声称导入图层。
- [ ] 动图首帧、PDF 扁平化/SVG 安全处理在 UI 明确；部分失败保留其他成功项。
- [ ] 工作区移动后资源可用；旧修订和归档项目引用不能被清空。
- [ ] 磁盘满、重复导入、外部引用失效可恢复；回归 M02 备份与废纸篓。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。
