# M01：Electron 基础框架选型记录

日期：2026-09-09。结论：按用户决定，Electron 取代 Tauri 成为 DesignHub 的桌面基础框架。版本级资料、一个可弃置的 Electron 44.3.0 主机探针和探针源码检查已完成；本机无法下载该版本的官方 macOS arm64 二进制，故未获得 Electron 真宿主、Windows、应用工程、性能或签名发布实证。

## M01 锁定的依赖研究（2026-09-09）

检索命令与 registry 返回的版本、许可证、`engines` 和 integrity 见 [来源清单](../../experiments/runtime/research-sources.json)。这是依赖层面的锁定，不把 npm 的 `latest` 标签当作已验证的产品能力。npm `unpackedSize` 只是压缩包展开大小，**不是** DesignHub 安装包或 UI bundle 测量；最终打包后仍须记录实际体积。

| 门槛 | 锁定或候选包 | 版本 / 许可证 | 维护、兼容性与决定 | 可行替代及取舍 |
| --- | --- | --- | --- | --- |
| G01 宿主 | `electron` | `44.3.0` / MIT | registry 当前稳定版本（非 prerelease）；要求 Node `>=22.12.0`，本机 Node `22.19.0` 满足。Electron 官方仓库、进程/安全/分发文档为依据。用于唯一桌面宿主。 | Tauri 是被 ADR 0024 取代的历史路线，不重新评估。 |
| G02 工程 | `@electron-forge/cli`、`@electron-forge/plugin-vite`、`vite` | `7.11.2`、`7.11.2`、`8.2.2` / MIT | Forge 是 Electron distribution 文档的优先路线；Vite `8.2.2` 声明 Node `^20.19.0 || >=22.12.0`。Task 2 必须以此单一 Forge/Vite 链实建再称采用。 | 不同时引入第二套打包器；拒绝同时维护 electron-builder/Tauri。 |
| G02 工程 | `typescript`、`eslint`、`zod` | `5.9.3` / Apache-2.0；`9.39.2` / MIT；`4.5.4` / MIT | TypeScript 固定成熟 5.9 line，刻意未采用 registry 的 7.0.2，直至 Forge/Vite/ESLint 的真实工程能编译；ESLint 9.39.2 支持本机 Node；Zod schema 由 Task 2 测。 | TypeScript 7.0.2、ESLint 10.10.0 都是已发现但未采纳的新 major，不能只凭 latest 进入工程。 |
| G03 UI | `react`、`react-dom` | `19.2.8` / MIT | Node 22 兼容；仅 renderer 使用，未放宽 renderer 的 Node 隔离。 | 不采用完整视觉模板。 |
| G03 UI | `shadcn`、`radix-ui`、`@radix-ui/react-dialog`、`tailwindcss`、`lucide-react` | `4.21.0` / MIT；`1.6.7` / MIT；`1.1.23` / MIT；`4.3.3` / MIT；`1.43.0` / ISC | 这是生成器/组件/样式/图标的**锁定候选**，不是已生成或已打包的 UI；shadcn 要求 Node `>=20.18.1`。Radix Dialog 覆盖 Sheet/Dialog 的无障碍基础，具体 Electron、键盘、读屏和 bundle 大小尚未实测。 | React Aria Components `1.21.1`（Apache-2.0）保留为可访问组件替代；不同时采用两套 primitives。 |
| G07 凭据 | `@napi-rs/keyring` | `2.0.0` / MIT | 有 darwin arm64、Windows x64/ia32/arm64 optional prebuild；仓库为 `Brooooooklyn/keyring-node`。它是原生系统凭据候选，尚未在 Electron 44 packaged host 加载，故不能称凭据能力通过。 | Electron `safeStorage` 仍只作应用管理密文对照，不满足每个凭据为系统条目的 ADR 0015 语义；不允许明文回退。 |
| G10 测试 | `vitest`、`@testing-library/react` | `5.0.0` / MIT；`16.3.3` / MIT | Vitest 5 要求 Node `^22.12.0 || ^24 || >=26`，并明确 peer 支持 Vite `^6.4 || ^7 || ^8`，故与 Vite 8.2.2 / Node 22.19 的声明范围相交。正式单元测试待 Task 2 实建。 | 不以浏览器单测替代真 Electron。 |
| G10 测试 | `playwright`、`axe-core`、`@axe-core/playwright` | `1.63.0` / Apache-2.0；`4.13.0` / MPL-2.0；`4.13.0` / MPL-2.0 | Playwright Electron 仍属官方标明 experimental 的自动化路径；本探针锁定并尝试该组合，但没有 Electron binary，自动化未运行。axe 只用于 renderer 可访问性，不代替原生窗口/IME。 | WebdriverIO Electron 是官方替代路径；未并行安装或声称其更适合。 |
| 原生模块构建 | `@electron/rebuild` | `4.2.0` / MIT | 需要 Node `>=22.12.0`，与本机匹配；为未来 ABI-bound addon 的工具，未因 Node-API 兼容性而泛化地加入所有模块。 | 每个 SQLite/codec addon 按其 ABI、prebuild 和 packaged-load 证据决定。 |

运行命令 `npm view <package>@<version> version license engines peerDependencies dependencies repository homepage dist.integrity --json` 实际返回的数据用于上表；完整批次命令、退出码和输出摘要在 [Task 1 报告](../../.superpowers/sdd/2026-09-08-m01-foundation/task-1-report.md)。npm 可读取不证明 GitHub 链路或 Electron archive 下载可用。

## 官方资料核验

| 能力 | 证据 | 对 DesignHub 的约束 |
| --- | --- | --- |
| 维护与许可证 | Electron 官方仓库当前未归档、MIT；检索日有推送活动。最新 release API 返回 v44.3.0（2026-09-08） | 版本仅作研究快照；实现前重新核对并锁完整依赖树 |
| 进程模型 | 官方文档定义 main（Node.js）/renderer、多窗口隔离、preload/contextBridge 和 UtilityProcess | 文件、SQLite、凭据和 CPU 密集工作集中在 main/utility；renderer 不开 Node |
| 系统凭据 | `safeStorage` 提供加解密，密文由应用保存；macOS 加密密钥受 Keychain 保护，Windows 使用 DPAPI；不是把每个 API Key 存入系统凭据条目 | 保持 ADR 0015：优先研究成熟 Node 系统凭据绑定。safeStorage 只作对照，不能默许改变存储语义；不向 UI 提供 `getSecret` |
| 原生模块 | ABI 绑定模块需使用匹配的预编译件或按 Electron 重建，官方列出 `@electron/rebuild` 与 Forge 集成 | SQLite、Sharp/codec 等分别查 Electron/Node-API 与平台兼容性，验证打包后真实加载；不无条件重建所有库 |
| 自动化 | 官方给出 WebdriverIO 与 Playwright `_electron.launch`；Playwright Electron 支持仍标 experimental | 先验证一套可维护测试工具再采用；浏览器模式、Electron 窗口、系统对话框/IME 分开验收 |
| 打包 | 官方 application-distribution 推荐 Electron Forge | M01 优先核验 Forge、Vite 集成与 native 模块配置，具体版本尚未采用；M08 补签名、更新与安装器验收 |

## 采用边界

Electron 解决了当前最明确的架构冲突：应用自写宿主逻辑可全部保持 JS/TS 箭头函数，不需要为 Tauri 的 Rust 命令建立例外。它不会自动解决内存、画布、SQLite 事务或密钥生命周期问题；这些仍按 M01–M08 的模块测试和 R01–R08 闸门验证。

首版最小宿主边界：

```text
renderer (React/TypeScript, sandboxed, contextIsolation)
        │ narrow preload API (typed, allow-listed)
main process (window/filesystem/dialogs/OS credential adapter/SQLite transaction owner)
        ├─ utility process or worker_threads (image decode/encode, progress/cancel)
        └─ provider request owner (reads credential, sends request, never returns raw key)
```

不为 Electron 预建插件市场、通用 RPC、微服务或第二套运行时抽象。包管理器固定 pnpm `10.23.0`；工程候选的准确版本已在本记录锁定。Task 2 仍须用 Forge/Vite 创建正式工程、锁提交其完整依赖树，并对实际 build/typecheck 取证。

Electron 自带 Chromium/Node，渲染能力随应用版本发布，跨平台仍需测字体、GPU 和系统交互。代价是需要维护运行时更新并承担安装体积；本轮未测包体或内存，不宣称优于 Tauri。safeStorage 文档来自 main 分支，其中新增 async API 是否进入将采用的稳定版须再核对；Windows DPAPI 也不提供对同用户其他应用的隔离保证。

## 尚未执行的验证

| 门槛 | 状态 | 必须补的证据 |
| --- | --- | --- |
| R01/R02 | 未执行 | Electron 真窗口中的 6000×4000、20 层、中文文本、选择/缩放/导出、10 轮处理、主进程/renderer/GPU/utility 总内存峰值与回落 |
| R03 | 未执行 | Electron 主进程同连接 SQLite 事务、WAL 备份、项目目录移动、迁移中断和锁 |
| R04 | 未执行 | 经 G07 核验的 macOS/Windows 系统凭据实现；拒绝/不可用/新设备重连，项目/日志无 Key，已存 Key 不回传 renderer；手动输入后清空表单 |
| R05 | 未执行 | utility/worker 进度、取消、失败不污染修订历史；退出/崩溃恢复 |
| R06 | 未执行 | WebdriverIO/Playwright 真 Electron 二进制，项目→画布→导出，原生文件对话框与中文 IME |
| R07 | 未执行 | 按最终打包器验证 macOS 安装/签名/公证、Windows 安装/签名/更新和数据保留；安装器格式在 M01 锁定，不同时维护多套 |
| R08 | 设计上可兼容 | JS/TS 及 Node 主进程统一箭头函数；第三方 native addon/generated code 只按许可和构建规则纳入，不把其内部函数伪装成自写代码 |

Tauri 的资料和 macOS 一次性结果保留在 [旧报告](M01-runtime-results.md)；切换后不得把旧结果标为 Electron 通过。

## 一次性 Electron 主机探针（未取得宿主实证）

探针位于 [electron-probe](../../experiments/runtime/electron-probe)，只锁定 Electron `44.3.0` 和 Playwright `1.63.0`，有自己的 `pnpm-lock.yaml`，不进入产品源码。探针定义了一个非透明、可调整尺寸、隐藏标题栏的 `BrowserWindow`，设置 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、macOS `vibrancy: 'sidebar'`，并通过沙箱可用的 CommonJS preload 仅暴露一个 `contextBridge` 操作。自动化会验证 renderer 没有 `require`/`process`、精确 bridge allowlist、drag/no-drag fixture、调整尺寸、最大化和事件有上限的全屏转换；`probe:automation:solid` 明确请求实色 fallback。requested configuration 与实际视觉效果分离，vibrancy/Mica/Acrylic 只能由真宿主人工证据确认。每个自写 JS 函数/回调为箭头；`node_modules` 中的 Electron/Playwright 是明确排除的第三方源码。

| 命令 | 退出码 / 结果 | 可得结论 |
| --- | --- | --- |
| `pnpm install --dir experiments/runtime/electron-probe --frozen-lockfile=false` | `0`；解析 15 个包，锁 Electron 44.3.0、Playwright 1.63.0 | package-level 安装与 lock 完成；pnpm 没有安装 Electron binary。 |
| `pnpm --dir experiments/runtime/electron-probe probe:arrow-check` | `0`；检查 5 个自写文件 | 探针自身满足箭头函数规则；不代表未来应用 R08 通过。 |
| 初次 `probe:arrow-check` | `1`；guard 在自身诊断文本发现一个 `function` token | checklist guard 的可观察失败已记录，后将诊断文本修正并获得 Green；这不是应用功能的 TDD red-green。 |
| `timeout 45s node experiments/runtime/electron-probe/node_modules/electron/install.js` | `1`，在超时前结束，`TypeError: fetch failed` 于 `@electron/get` `FetchDownloader.download` | 官方 Electron 44.3.0 darwin-arm64 binary 未下载；无 `path.txt`、可执行 binary 或 `result.json`。 |

因此没有将窗口、vibrancy、标题栏控制按钮、drag/no-drag、贴靠、调整尺寸、最大化、全屏、preload 安全边界或 Playwright Electron 自动化记为已通过。不存在 Windows 主机，Windows Mica/Acrylic/实色降级及全部 Windows R01–R07 明确未验证。`transparent: true` 没有被使用，也不能用它替代可调整尺寸窗口。R01/R02 canvas、R03 store、R04 credential、R05 worker、R06 完整旅程、R07 签名分发仍由下游模块验证。

## 公开来源与版本前提

本次实际读取 Electron 官方 GitHub API 与 npm registry。资料正文为 main 分支快照，准确 blob SHA、API snapshot 及 package registry 命令记录在 [来源清单](../../experiments/runtime/research-sources.json)。首次采用时重新核对版本、LICENSE、依赖二进制许可和修复记录；安装了 probe 的 package tree，但没有 Electron binary 或运行测试。

- [仓库](https://github.com/electron/electron)：未归档，API 许可证为 MIT；维护活动只说明仍在维护。
- [v44.3.0 发布](https://github.com/electron/electron/releases/tag/v44.3.0)：latest API 返回非预发布，时间 `2026-09-08T19:21:28Z`；不是已锁定的项目版本。
- [进程模型](https://github.com/electron/electron/blob/main/docs/tutorial/process-model.md)、[安全与 IPC](https://github.com/electron/electron/blob/main/docs/tutorial/security.md)、[safeStorage](https://github.com/electron/electron/blob/main/docs/api/safe-storage.md)。
- [原生 Node 模块](https://github.com/electron/electron/blob/main/docs/tutorial/using-native-node-modules.md)、[自动化](https://github.com/electron/electron/blob/main/docs/tutorial/automated-testing.md)、[打包分发](https://github.com/electron/electron/blob/main/docs/tutorial/application-distribution.md)。
