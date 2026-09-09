# M01：Electron 基础框架选型记录

日期：2026-09-09。结论：按用户决定，Electron 取代 Tauri 成为 DesignHub 的桌面基础框架；本记录完成官方资料核验，但尚未完成应用工程、Windows、Electron 原生宿主性能和签名发布实验。

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

不为 Electron 预建插件市场、通用 RPC、微服务或第二套运行时抽象。包管理和打包器准确版本在 M01 工程启动时通过依赖门槛锁定。

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

## 公开来源与版本前提

本次实际读取 Electron 官方 GitHub API。资料正文为 main 分支快照，准确 blob SHA 与 API 快照在 [来源清单](../../experiments/runtime/research-sources.json)。首次采用时重新核对版本、LICENSE、依赖二进制许可和修复记录；没有安装 Electron 或运行测试。

- [仓库](https://github.com/electron/electron)：未归档，API 许可证为 MIT；维护活动只说明仍在维护。
- [v44.3.0 发布](https://github.com/electron/electron/releases/tag/v44.3.0)：latest API 返回非预发布，时间 `2026-09-08T19:21:28Z`；不是已锁定的项目版本。
- [进程模型](https://github.com/electron/electron/blob/main/docs/tutorial/process-model.md)、[安全与 IPC](https://github.com/electron/electron/blob/main/docs/tutorial/security.md)、[safeStorage](https://github.com/electron/electron/blob/main/docs/api/safe-storage.md)。
- [原生 Node 模块](https://github.com/electron/electron/blob/main/docs/tutorial/using-native-node-modules.md)、[自动化](https://github.com/electron/electron/blob/main/docs/tutorial/automated-testing.md)、[打包分发](https://github.com/electron/electron/blob/main/docs/tutorial/application-distribution.md)。
