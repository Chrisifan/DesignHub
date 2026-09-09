# DesignHub 一次性运行时实验

2026-09-09。仅用于技术可行性取证，不是应用实现、UI 方案或可发布工程。结论与边界见 [M01 报告](../../docs/research/M01-runtime-results.md)。所有素材和数据库均为合成数据，不读取用户项目或提供方凭据。

当前桌面框架已切换为 Electron，见 [ADR 0024](../../docs/adr/0024-electron-react-desktop-runtime.md)。下面的 Tauri 命令仅用于复现历史实验，不是 Electron 开发入口；本次切换未修改或删除探针源码与原始结果。

## 复现

需要 Node 22.19.0（本次 `node:sqlite` 仍标 experimental）、Rust 1.94.0 和 macOS Command Line Tools。本次锁定 Tauri 2.11.5、tauri-build 2.6.3；完整间接依赖在样例 Cargo.lock 中。不要把 Node SQLite 探针当作生产依赖选择。

在仓库根目录运行：

```sh
node experiments/runtime/sqlite-probe.mjs
node experiments/runtime/tauri-probe/prepare-icon.mjs
cargo build --locked --manifest-path experiments/runtime/tauri-probe/examples/helloworld/Cargo.toml
node experiments/runtime/tauri-probe/run.mjs
```

首轮下载依赖需要正常访问 crates.io；缓存齐全后可在构建命令加 `--offline`。原生运行需要桌面 GUI 会话以及空闲的 `127.0.0.1:18764`，不能用普通浏览器替代。运行器只提供三个固定静态资源和一个结果接口，最长运行 90 秒，结果返回后关闭自己启动的宿主和临时服务。

SQLite 探针把小型合成数据库保留在随机临时目录，路径写入输出，便于检查；不清理或覆盖现有文件。图像探针输出留在内存，生成和解码 PNG，不代表文件系统导出。`prepare-icon.mjs` 只生成构建要求的 1×1 RGBA 占位图标，不是视觉设计。

## 原生源码来源

为了不默认放宽“所有自写函数用箭头”的约束，实验宿主只引用以下两份**未经修改**的上游源码。已通过 Git blob SHA 核对字节一致；这并不证明 DesignHub 正式后端可以零自写 Rust。

| 文件 | 上游来源 | Git blob SHA |
| --- | --- | --- |
| `tauri-probe/examples/helloworld/main.rs` | [Tauri 2.11.5 官方 helloworld](https://github.com/tauri-apps/tauri/blob/tauri-v2.11.5/examples/helloworld/main.rs)；保留 MIT/Apache-2.0 SPDX | `ee822803b95ca41f90f213c146e43c144331491d` |
| `tauri-probe/examples/helloworld/build.rs` | [create-tauri-app 模板](https://github.com/tauri-apps/create-tauri-app/blob/890e6208661617b2e86a21f662b6efe9e3035788/templates/_base_/src-tauri/build.rs) | `d860e1e6a7cac333c3cc0bc9cb67faf286b07d69` |

目录保留 `examples/helloworld` 是为原样满足官方 main.rs 中的配置相对路径，不是拟定的应用目录结构。自写 JS/MJS 函数、回调均为箭头形式。构建生成代码及依赖属于第三方/生成产物。

## 证据

- [SQLite 输出](sqlite-result.json)：6 项引擎检查通过；跨连接回滚项通过表示成功复现事务失效反例。
- [原生宿主输出](tauri-native-result.json)：真实 Tauri IPC、WKWebView、Worker 和合成图处理结果。
- [公开资料来源](research-sources.json)：检索日期、URL、源码 blob SHA；分支文档会变动，不能当作永远成立的能力保证。

不把帧间隔当作真实输入延迟；不把 `drawCallP95Ms: 0` 当作零耗时，计时精度和异步 GPU 提交都会影响此值。UA 是 WebKit 兼容字符串，不能据它判断实际 CPU 或 OS。
