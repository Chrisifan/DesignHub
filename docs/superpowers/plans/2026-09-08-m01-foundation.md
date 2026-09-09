# M01 基础与运行时 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 验证桌面可行性，建立可离线打开、可访问、可测试且符合编码守则的应用入口。

**Architecture:** Electron main process 只通过 typed preload/contextBridge 提供权限受控能力；UI 与业务代码保持 TypeScript/React。先锁定 Electron 依赖与安全边界，再建立工程。

**Tech Stack:** React/TypeScript renderer；Electron main/preload；Vite、Vitest、ESLint、WebdriverIO Electron/Playwright Electron 等候选；UI 推荐 shadcn/ui Radix 版本、Radix UI Primitives、Tailwind CSS、Lucide React；准确依赖版本在研究采用记录中锁定。

**Spec:** [首版架构](../specs/2026-09-08-designhub-v1-design.md)，[UI 说明书](../../product/APPLICATION-GUIDE-FOR-UI.md)，[UI 基础规范](../../product/UI-FOUNDATIONS.md)，[主计划](2026-09-08-designhub-v1.md)。

## Global Constraints

- 先调研成熟框架或第三方库，再写对应功能实现；未核验候选不等于选型。
- 按模块先写测试用例和 checklist，再实现并对照验证；改到已验证模块必须记录影响并回归。
- 所有自写函数遵守用户“箭头函数”要求；不能默许原生代码例外。
- 核心浏览、编辑、历史、检索、导出、备份离线可用；云请求不在重连后静默提交。
- 无平台账户；提供方密钥只存系统安全存储，不进项目、包、备份、日志。
- 主计划的其余全局约束和模块记录协议全部适用。先创建 `docs/verification/M01.md`，再实现下列目标文件。
- 下列代码是计划中的行为测试及核心规则片段；完整用例还必须覆盖每项验收场景，不以片段替代模块交付。

## Task 1: 桌面与开发链路采用门槛

进展（2026-09-09）：用户已选择 Electron；[Electron 资料报告](../../research/M01-electron-runtime-results.md) 已补齐，Tauri 资料/探针保留为历史。Electron 原生样例和 R01–R08 仍未全部验证；Tasks 2–3 尚未开始。

**Files:** 创建 `docs/research/M01-electron-runtime-results.md`、`docs/verification/M01.md`；更新 `docs/adr/0024-electron-react-desktop-runtime.md`。Tauri 资料和探针留在历史文件，临时实验仅在 `experiments/runtime/`，不直接迁入正式源码。

**Interfaces:** 输入已接受的 Electron 决策与 [R01–R08](../../research/DEPENDENCY-GATES.md)；输出依赖准确版本、OS/机器配置、实际证据与剩余交付门槛。无需再次选择 Tauri/Electron。

- [ ] 补齐 G01/G02/G03/G07/G10 版本级研究，尤其 main/preload、系统凭据绑定、原生模块二进制与自动化；Forge 优先评估，Playwright Electron experimental 需实测。
- [ ] 锁定 shadcn/ui Radix 版本、Radix UI、Tailwind CSS、Lucide React 的准确版本、许可证、维护状态、Electron Chromium 兼容和最小打包体积；没有证据时保持候选。
- [ ] 用最小 Electron 窗口分别验证 macOS vibrancy、Windows Mica/Acrylic、实色降级、隐藏标题栏、原生控制按钮、drag/no-drag、调整尺寸、贴靠、最大化和全屏；不得用 `transparent: true` 的不可调整样例替代。
- [ ] 用同一 6000×4000 图像、20 图层与中文文本完成 R01–R08；两平台分开记录。
- [ ] 在 Electron 真宿主上完成 R01–R08；缺 Windows、签名或内存证据时保持未验证并阻止相应交付门槛。
- [ ] 核对真实结果后更新 ADR 0024；缺 Windows、网络或签名条件写明未验证，不打勾平台门槛。
- [ ] 将采用后的安装/运行/构建精确命令写入实验记录。项目初始化前锁定包管理器与兼容版本，不猜“最新版本”。

## Task 2: 建立首个离线入口及可访问测试

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`
- Create: `src/app/App.tsx`, `src/app/App.test.tsx`, `src/app/main.tsx`, `src/app/i18n.ts`
- Create: `src/app/locales/zh-CN.json`, `src/app/locales/en.json`, `tests/setup.ts`, `.gitignore`
- Create: `src/app/shell/WindowBar.tsx`, `src/app/shell/WindowBar.test.tsx`, `src/app/styles/tokens.css`, `src/app/styles/window.css`
- Create: `src/desktop/main.ts`, `src/desktop/preload.ts`, `src/desktop/window-options.ts`, `src/desktop/ipc/workspace.ts`
- Create: `src/platform/desktop.ts`, `src/platform/contracts.ts`, `tests/integration/desktop-boundary.test.ts`
- Create: 打包器与 main/preload 构建配置，名称及准确命令按 Task 1 锁定的一套工具链记录

**Interfaces:** 输出 `App: () => JSX.Element` 和不依赖 Key 的欢迎入口；宿主 `chooseWorkspaceDirectory: () => Promise<string | null>`，取消返回 null，不返回伪路径。

preload 暴露固定命名空间 `window.designhub`，renderer facade 只调用该 API。主进程注册 `workspace:choose-directory`，校验发起窗口/主 frame/origin 后调用原生 dialog；当前只授权返回选中目录，不允许 renderer 传入任意 IPC channel。新功能按所属模块扩展契约，不一次暴露完整文件系统。

```ts
// src/platform/contracts.ts：实现前的最小契约
export type DesktopApi = {
  chooseWorkspaceDirectory: () => Promise<string | null>;
};
```

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';

it('未连接模型也能进入本地工作区入口', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: '新建工作区' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '打开工作区' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '必须登录' })).toBeNull();
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/app/App.test.tsx`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

入口的最小内容使用语义按钮；后续 M02 接入真实操作，当前必须明确只是未连接业务的空壳阶段，不作为完整可用入口交付。

```tsx
export const App = () => (
  <main aria-label="DesignHub">
    <h1>DesignHub</h1>
    <button type="button" aria-label="新建工作区">新建</button>
    <button type="button" aria-label="打开工作区">打开</button>
  </main>
);
```

通过后提取文案到本地语言文件，建立语言切换测试；接入系统目录选择的宿主冒烟验证。按 UI 基础规范建立语义 token、自定义窗口栏和跨平台材质降级；此阶段只生成实际使用的最少组件，不批量导入组件库。包脚本按主计划命令契约配置；.gitignore 覆盖依赖、构建、测试产物、.superpowers 临时屏幕和本地凭据。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/app/App.test.tsx`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] 断网、无 Key、取消目录选择均不崩溃；主路径键盘可达。
- [ ] 中文/英文切换后语义标签一致；读取语言资源不访问 CDN。
- [ ] 中文按钮可见动作文案不超过 4 个汉字；中英文在 1024×720、1280×800 及 100/125/150% 缩放下无按钮、标签或窗口控制异常换行/重叠。
- [ ] macOS/Windows 真窗口中的隐藏标题栏、原生控制按钮、拖动、最大化、贴靠、全屏、毛玻璃与实色降级均留独立证据；减少透明和减少动态设置有效。
- [ ] 暗色、明亮、跟随系统只切换 token 与材质，不重建业务状态、改变焦点顺序或影响画布颜色。
- [ ] 浏览器测试与已选宿主窗口启动分别留证据；不把空壳按钮当 M02 已完成。
- [ ] 真实 renderer 无 Node require、无 raw IPC；三个窗口安全标志保持启用，未知/外部 frame 调用被拒绝，非法参数不进入文件操作。
- [ ] main/preload/renderer 的构建入口分开，所有应用 JS/TS 用箭头；远程作品集内容不能成为应用主窗口的可执行页面。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。

## Task 3: 编码与公共错误规则

**Files:**
- Create: `eslint.config.js`, `src/shared/errors.ts`, `src/shared/errors.test.ts`
- Create: `tests/fixtures/lint/arrow-valid.ts`, `tests/fixtures/lint/declaration-invalid.ts`

**Interfaces:** 输出 `userMessage: (code: 'DISK_FULL' | 'READ_ONLY' | 'UNKNOWN') => string`；用 ESLint AST 规则约束自写 JS/TS 函数形式，库/生成代码不修改。

- [ ] **Step 1：先将下列场景写入模块记录和测试文件，确认前置与预期。**

```tsx
import { expect, it } from 'vitest';
import { userMessage } from './errors';

it('保存失败给出恢复动作', () => {
  expect(userMessage('DISK_FULL')).toBe('磁盘空间不足，请释放空间后重试保存。');
});
```

- [ ] **Step 2：运行失败测试。**

Run: `pnpm test:unit -- src/shared/errors.test.ts`
Expected: 目标行为尚未实现导致失败；若首先因依赖/导入缺失失败，补齐最小导出后确认行为 Red，不能将环境错误当验证结果。

- [ ] **Step 3：实现最小完整用例。**

建立有限错误码到本地文案的映射，不把堆栈/系统路径直接投进 UI。

```ts
const messages = {
  DISK_FULL: '磁盘空间不足，请释放空间后重试保存。',
  READ_ONLY: '当前内容为只读，请在可写工作区中继续。',
  UNKNOWN: '操作未完成，请重试或查看诊断。',
};
export const userMessage = (code: keyof typeof messages) => messages[code];
```

ESLint 禁止 FunctionDeclaration、FunctionExpression、对象方法简写和类方法（含构造器）；要求使用 const 箭头。规则覆盖 main/preload/renderer、配置、worker 与测试，排除第三方/生成代码；禁止 UI 依赖 `src/desktop` 或 Node 原生库，仅允许纯类型契约共享。按 feature 保持导出边界，禁止组件直接导入凭据实现。

- [ ] **Step 4：运行同一测试并完成以下验收；记录真实结果。**

Run: `pnpm test:unit -- src/shared/errors.test.ts`，并运行 `pnpm lint`、`pnpm typecheck`。
Expected: 当前测试通过；下列场景逐条给出证据，未执行不得打勾。

- [ ] lint 允许箭头函数，拒绝声明/表达式/方法简写；两份 fixture 按预期产生相反结果。
- [ ] 内部异常只写脱敏诊断，用户文案无凭据/堆栈。
- [ ] 执行主计划所有已建立的 lint/typecheck/unit/build 命令，记录没有建立的后续入口。

- [ ] **Step 5：核对改动与回归范围，更新模块记录。** 有 Git 后仅暂存本任务明确文件并提交一个可独立验收的更改；未完成用例保留开放，禁止用提交代替验证。
