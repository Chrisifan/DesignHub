# M07 图像工具与交付 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成全部首版图像工具、明确版本导出与可独立交接的项目/只读交付包。

**Architecture:** 工具检查器和 Agent 复用 M06 任务与 M04 修订提交；本地变换不强制调用模型。交付只读取已确认版本，按资源闭包生成项目包。

**Tech Stack:** G06 图像/PDF/元数据；G08 真实工具能力；G09 流式归档与校验；准确依赖版本在研究采用记录中锁定。

Electron 接入：浏览器图像操作使用 Web Worker；需要 Node codec 的任务由 main 启动 `src/desktop/workers/image-worker.ts`（utility/worker 方案在 G06 样例中择一），仅在本模块需要时创建。进度与结果只含任务 ID、资源标识和必要参数；大图不反复编码为 base64 穿过 IPC。任务崩溃/取消、native 模块加载及安装包内资源路径纳入本模块验证。

**Spec:** [首版架构](../specs/2026-09-08-designhub-v1-design.md)，[UI 说明书](../../product/APPLICATION-GUIDE-FOR-UI.md)，[主计划](2026-09-08-designhub-v1.md)。

## Global Constraints

- 先调研成熟框架或第三方库，再写对应功能实现；未核验候选不等于选型。
- 按模块先写测试用例和 checklist，再实现并对照验证；改到已验证模块必须记录影响并回归。
- 所有自写函数遵守用户“箭头函数”要求；不能默许原生代码例外。
- 核心浏览、编辑、历史、检索、导出、备份离线可用；云请求不在重连后静默提交。
- 无平台账户；提供方密钥只存系统安全存储，不进项目、包、备份、日志。
- 主计划的其余全局约束和模块记录协议全部适用。先创建 `docs/verification/M07.md`，再实现下列目标文件。
- 下列代码是计划中的行为测试及核心规则片段；完整用例还必须覆盖每项验收场景，不以片段替代模块交付。

## Task 1: 统一工具目标、参数与能力

**Files:**
- Create: `src/features/image-tools/target.ts`, `src/features/image-tools/target.test.ts`
- Create: `src/features/image-tools/ToolInspector.tsx`, `src/features/image-tools/execute-tool.ts`
- Create: `tests/integration/image-tools.test.ts`

**Interfaces:** `needsRegion: (tool: 'remove-object' | 'inpaint' | 'remove-background' | 'resize') => boolean`。统一 `executeTool` 输入 documentId/baseRevisionId/targetLayerId/tool/params/region/connectionId，本地工具 connectionId 可省略。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { needsRegion } from './target';

it('局部修改要求区域，直接尺寸转换不要求模型选区', () => {
  expect(needsRegion('remove-object')).toBe(true);
  expect(needsRegion('inpaint')).toBe(true);
  expect(needsRegion('resize')).toBe(false);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/image-tools/target.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const needsRegion = (
  tool: 'remove-object' | 'inpaint' | 'remove-background' | 'resize',
) => tool === 'remove-object' || tool === 'inpaint';
```

按 UI 第 14 节为所有工具建立各自 schema 和能力检测，不用一个泛化参数 JSON 跳过验证。包含去背景、换背景、对象增删/局部重绘、扩图、智能裁切、放大修复、尺寸与格式转换。M05 校验目标/区域，M06 调模型并保留状态，M04 提交新版本。对象添加同样需要明确目标区域或定位参数；未明确先询问。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/image-tools/target.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 每个声明工具有真实适配器支持和许可样本验收；不支持的参数不显示为可用。
- [ ] 局部工具无选区/越界拒绝；纯尺寸/格式转换离线可完成且可回退。
- [ ] 所有工具前后可比较、失败不落假修订、取消/迟到结果遵守 M06。
- [ ] 测试主体透明边缘、细发丝/半透明物、对象重绘边界、扩图接缝和裁切主体保留，记录人工质量判定与模型限制。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 2: 图像和普通 PDF 导出

**Files:**
- Create: `src/features/delivery/export-policy.ts`, `src/features/delivery/export-policy.test.ts`
- Create: `src/features/delivery/ExportDialog.tsx`, `src/features/delivery/export-document.ts`
- Create: `tests/integration/export-formats.test.ts`

**Interfaces:** `needsBackground: (format:'png'|'jpeg'|'webp'|'pdf', hasTransparency:boolean) => boolean`；exportDocument 绑定 revisionId、参数、目标句柄、archiveCopy，成功后记录哈希/位置/版本。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { needsBackground } from './export-policy';

it('JPEG 透明合成要求可见的背景选择', () => {
  expect(needsBackground('jpeg', true)).toBe(true);
  expect(needsBackground('png', true)).toBe(false);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/delivery/export-policy.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
export const needsBackground = (
  format: 'png' | 'jpeg' | 'webp' | 'pdf', hasTransparency: boolean,
) => format === 'jpeg' && hasTransparency;
```

用户明确选当前版或定稿，输出 sRGB PNG/JPEG/WebP 与普通 PDF；尺寸、透明度、质量、页尺寸、安全/出血辅助按格式显示。冻结导出来源版本；当前画布后续变化不改变任务。PDF 不默认嵌字体，可用已验证栅格化外观，界面说明文字不可编辑。先临时写文件并校验再最终发布；外部目标与可选项目归档分开，写入失败不记成功。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/delivery/export-policy.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 校验真实文件 magic、像素尺寸、透明度、颜色和 PDF 页尺寸，不只看扩展名。
- [ ] 中文/缺字体/文字栅格化外观与画布一致；没有暗示 PDF/X 或 CMYK。
- [ ] 默认外部导出不重复归档；同名文件不默覆盖，目标盘失败保留作品和重试入口。
- [ ] 署名元数据支持则写入，不能支持则随附清单；输出不默认烧录名字。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 3: 项目包与只读交付包

**Files:**
- Create: `src/features/delivery/package-policy.ts`, `src/features/delivery/package-policy.test.ts`
- Create: `src/features/delivery/project-package.ts`, `src/features/delivery/DeliveryPackageDialog.tsx`
- Create: `tests/integration/project-package.test.ts`, `tests/e2e/project-handoff.spec.ts`

**Interfaces:** `deliveryEntries: (entries:{path:string; kind:'output'|'preview'|'manifest'|'conversation'|'credential'|'font'}[]) => string[]`；项目包独立用完整闭包，不复用只读交付白名单。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { deliveryEntries } from './package-policy';

it('只读交付只带输出预览清单，排除内部对话密钥字体', () => {
  expect(deliveryEntries([
    { path: 'poster.png', kind: 'output' },
    { path: 'delivery.json', kind: 'manifest' },
    { path: 'conversation.json', kind: 'conversation' },
    { path: 'key.txt', kind: 'credential' },
    { path: 'brand.ttf', kind: 'font' },
  ])).toEqual(['poster.png', 'delivery.json']);
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/features/delivery/package-policy.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

```ts
type Entry = {
  path: string;
  kind: 'output' | 'preview' | 'manifest' | 'conversation' | 'credential' | 'font';
};
export const deliveryEntries = (entries: Entry[]) =>
  entries.filter((entry) => ['output', 'preview', 'manifest'].includes(entry.kind))
    .map((entry) => entry.path);
```

项目包遍历 M04 全部历史所需资源、简报、设计师/品牌快照及场景，补齐工作区共享资源到包内；排除凭据、默认字体文件与未归档作品集临时图。只读包清单自身也只列交付字段，不能通过 manifest 嵌进聊天或 Key。导入先校验格式、哈希、安全路径、大小，再解到新目录，冲突生成新身份并记录来源。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/features/delivery/package-policy.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 仅复制项目包到全新工作区即可打开、编辑、历史比较和导出；删除原工作区后再验证。
- [ ] 新设备缺字体/模型连接是可恢复提示；Key 绝不随包恢复。
- [ ] Zip 路径穿越、损坏资源、磁盘满、重复包 ID 不覆盖当前项目。
- [ ] 只读包不带聊天、提示词、无关原图；清单署名仍完整。
- [ ] 回归 M02 备份恢复/M04 资源去重与引用，确认被历史引用的共享原图全部入包。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。
