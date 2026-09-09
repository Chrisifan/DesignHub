# M01：Tauri 可行性初验

> 历史记录：本报告完成后，用户于 2026-09-09 决定改用 Electron；当前决策见 [ADR 0024](../adr/0024-electron-react-desktop-runtime.md)。下文的 Tauri 候选状态和建议保留为当时结论，不再指导当前实现。

日期：2026-09-09。结论：**Tauri 在本机已经跑通原生宿主、IPC 和大图后台处理，技术方向可行；目前保持候选，不批准正式采用，也不判定为技术不可行。**

本轮完成 Tauri 专项资料核验和 macOS 一次性实验。未执行 Electron 对照、Windows、真实系统凭据、正式画布交互、原生业务 E2E 或签名发布。M01 工程模块仍未完成。UI 设计与已确认产品范围未改变。

## 1. 哪些结论已经有证据

| 问题 | 结论及产品影响 |
| --- | --- |
| Tauri 能否承担本地桌面宿主 | 本机 Tauri 2.11.5 已编译并启动真实 WKWebView，官方 `greet` Rust 命令调用成功。不能由此推断文件、SQL、凭据等插件均已集成 |
| 大图处理是否一定卡住 UI | 6000×4000 合成图的 10 轮 Worker 解码/合成/PNG 编码/重解码完成，期间主线程定时心跳最大间隔 23ms；说明本次任务可以放到后台。不能推广到 HEIC/PSD、原生图像库或任意大图 |
| macOS 是否无法做原生自动化 | 不是。当前官方文档推荐 WebdriverIO `embedded` 驱动，可运行在 macOS/Windows/Linux；直接使用外部 `tauri-driver` 才仍限 Windows/Linux。本轮查到并核验路径，尚未执行该驱动 |
| SQLite 是否支持便携项目 | 引擎层面的中文路径、打开 WAL 时一致性备份、关闭后移动、失败/进程中断迁移回滚、写锁竞争全部通过；项目业务文件和 Tauri 桥接尚未验证 |
| 官方 SQL 插件是否直接满足项目原子提交 | 当前查看的 TS 接口没有固定连接的事务句柄；Rust 侧按调用使用连接池。不能把多次 IPC 的 BEGIN、写入、COMMIT 当成一个可靠事务。需由同一后端连接/事务对象拥有整个提交 |
| Stronghold 是否等于系统钥匙串 | 不是；它是加密文件保险库。已查到系统 keyring 社区插件候选，但 JS 读取接口会把秘密返回前端；若要求 Key 不进入 renderer，必须在后端完成读取及提供方请求 |
| 是否必须为了兼容箭头函数加 Node sidecar | 不推荐仅为语法要求引入额外进程。Tauri 支持 sidecar，但需额外处理生命周期、协议、按架构打包、签名和故障恢复；本轮未证明它比小型原生后端更简单 |

## 2. 实测前提

| 项目 | 本次实际值 |
| --- | --- |
| 机器 | MacBookPro18,3，Apple M1 Pro，16GiB RAM；独立 GPU 核心数/负载未采集 |
| 系统 | macOS 26.6.2，build 25G83，arm64 |
| WebKit | 系统框架 CFBundleVersion `21624.5.1.11.3`；UA 兼容字符串不代表实际系统版本 |
| 屏幕/窗口 | 浏览器 API 返回 1512×982、devicePixelRatio=2；样例窗口 1200×800、画布 backing store 1100×680；未实施 Retina 全分辨率 UI 压测 |
| 工具链 | rustc/cargo 1.94.0，Node 22.19.0，pnpm 10.23.0，Xcode CommandLineTools；未安装完整 Xcode，本次普通桌面编译成功 |
| 成功构建版本 | Tauri 2.11.5，tauri-build 2.6.3；Cargo.lock 中 runtime 2.11.3、runtime-wry 2.11.4、wry 0.55.1；debug 构建，不是 release 包体或性能基准 |
| 版本可重现性 | Cargo.lock SHA-256 `53e924587f9f18721bdfc9ab78dee22754d349e4b0b221f929f5da1179647fab`；复现使用 `--locked` |
| 素材/范围 | 自行合成 PNG；一个 24MP 背景、18 个矩形、1 个中文文字绘制层；不是 20 张全尺寸栅格图，也不是 Konva/Fabric/React 项目 |
| 系统访问 | 原生探针只访问本机 loopback；SQLite 只写随机临时目录；未读取真实项目、API Key、账户或发布证书 |

网络默认沙箱 DNS 失败，本轮经权限升级后 GitHub API 和 crates.io 可用。`raw.githubusercontent.com` 曾出现 TLS 主机名不匹配/超时，改用正常校验 TLS 的 GitHub contents API，未关闭证书校验。此前“完全无法联网”的规划状态已不适用于本轮。

## 3. 实验结果与局限

先写 [M01 用例/checklist](../verification/M01.md)，再编写 [一次性探针](../../experiments/runtime/README.md)。以下命令退出码均为 0：

```sh
node experiments/runtime/sqlite-probe.mjs
cargo build --manifest-path experiments/runtime/tauri-probe/examples/helloworld/Cargo.toml
node experiments/runtime/tauri-probe/run.mjs
```

### 3.1 原生图像探针 P04

[完整输出](../../experiments/runtime/tauri-native-result.json)。宿主通过真实 IPC 返回 `Hello DesignHub 探针, You have been greeted from Rust!`，未用浏览器 mock。后台执行 10 轮：PNG 解码 → 20 层合成绘制 → PNG 编码 → 再解码并核对尺寸；注入 Worker 错误后，主线程收到预期错误。

| 指标 | 本轮值 | 解释 |
| --- | --- | --- |
| 成功轮数 | 10/10 | 无崩溃；不是内存泄漏证明 |
| 每轮处理时间 | 1468–2487ms | 后台完成一次整图流程的耗时，不是交互延迟 |
| 每轮 PNG 大小 | 约 26.1MB | 仅内存产物，不是磁盘导出验收 |
| 120 个合成平移/缩放帧的帧间隔 p95 / 最大 | 18ms / 19ms | 通过 requestAnimationFrame 观察，位于处理轮次之间；无真实鼠标输入，不能据此给 R01 的输入 p95 打勾 |
| 处理期间主线程心跳最大间隔 | 23ms | setInterval 间隔采样，支持后台处理没有长期阻塞主线程的判断；未同时测真实画布拖动 |
| drawImage 调用时间 p95 | 输出为 0ms | 计时精度与异步提交限制，不能解读为绘制零耗时 |

尚缺：可编辑对象命中/选择、中文输入法与字体视觉检查、真实导入文件、色彩/透明度像素验收、GPU 与 WebContent 总内存峰值/回落、任务取消、历史一致性、Windows。脚本调用 `fillText` 成功不等于中文排版已验收。

合成输入 PNG 的准备发生在心跳计时之前，23ms 不包含该准备开销；正式导入流程仍需端到端测量。

### 3.2 SQLite 引擎探针 P01–P03

[完整输出](../../experiments/runtime/sqlite-result.json)，6 项通过：

1. 中文/空格项目路径；连接保持打开且 WAL 存在时调用 SQLite backup，恢复数据哈希一致且 integrity_check=ok。
2. 失败迁移的 DDL 与 user_version 在同一连接事务中回滚，无部分列残留。
3. 子进程开启迁移事务后直接退出，重查无未提交 DDL/user_version 残留。该实验模拟进程中断，不模拟断电/存储硬件故障。
4. 连接 A 持有写锁时连接 B 收到 locked；释放后 B 可写。不代表 DesignHub 的单写者工作区锁已实现。
5. A 执行 BEGIN/ROLLBACK，B 写入依然保留。这是跨连接事务失效的反例验证；不是 Tauri SQL 插件的直接复现，也不是事务正确性的通过项。
6. 关闭后移动完整项目目录，再打开数据哈希一致、integrity_check=ok。

Node 22 的 `node:sqlite` 在本次输出中标 experimental，只作为现成 SQLite 引擎探针。没有因此采用该 API 作生产存储。未测 Tauri SQL 连接 URL、Windows 盘符、资源文件闭包、应用多表提交、活跃写入中的业务级备份和恢复。

### 3.3 构建中的真实问题

| 尝试 | 结果 | 处理及判定 |
| --- | --- | --- |
| 缓存 Tauri 2.10.3，offline 构建 | 退出 101；本地唯一可用 unicode-segmentation 1.13.1 已 yanked | 不是应用编译失败；切换正常仓库解析，未强行采用已撤回版本 |
| Tauri 2.10.3 + 新解析的 runtime 2.11.3 | 退出 101；new_window_handler 的 Send/Sync trait 类型不匹配 | 已定位为这组核心/间接依赖组合不兼容；未改第三方源码 |
| 官方 release latest 返回的 Tauri 2.11.5 + tauri-build 2.6.3 | 退出 0；该轮构建 28.87 秒，复用前次编译缓存 | 正常启动并完成 P04。28.87 秒不能当作完整冷构建耗时 |

实际影响：应一起验证并提交完整依赖锁文件，升级 Tauri/插件后回归宿主集成；只固定顶层版本不足以重复得到同一可用组合。这是本次排查产生的工程约束，不是对所有 Tauri 版本的泛化判断。

完成后以相同 Cargo.lock 再执行 `cargo build --locked --offline --manifest-path experiments/runtime/tauri-probe/examples/helloworld/Cargo.toml`，退出 0。本次依赖缓存已齐全；不表示首次安装可以免下载依赖。

## 4. R01–R08 采用门槛

| 门槛 | 当前状态 | 正式采用前剩余证据 |
| --- | --- | --- |
| R01 大图交互 | macOS 合成绘制部分通过 | 同一真实画布在双平台验证选择/拖拽/缩放、中文编辑、导出；记录真实输入延迟 |
| R02 连续处理与内存 | 10 轮完成，内存尚未验证 | 采集整个应用、WebContent、GPU 的峰值/释放后回落；两平台长循环与不同复杂度素材 |
| R03 项目 SQLite | 引擎部分通过，Tauri 链路未验证 | 原生同连接事务、工作区路径/锁、备份/资源一致性、迁移与移动后的真实应用重开 |
| R04 原生凭据 | 资料核验，未实测 | 两平台系统安全存储、拒绝访问/重连、新设备、Key 不进 renderer/项目/日志；不拿 Stronghold 替代 |
| R05 后台处理 | macOS Worker 与失败回传部分通过 | 正式图像库、进度/取消、结果版本落盘、故障不污染历史；双平台真实交互 |
| R06 原生自动化 | 查到可行的维护中路径，未执行 | `@wdio/tauri-service` embedded + 所需测试插件，在真实 macOS/Windows 应用完成项目/画布/导出；原生文件对话框、IME 等另外核验 |
| R07 安装与更新 | 资料核验，未打包/签名 | 双平台无签名安装试验，再补正式签名/公证/更新签名与升级保留数据；Windows 离线 WebView2 策略 |
| R08 函数规则 | 正式实现尚未满足 | 当前未证明“完全不自写 Rust”能够覆盖项目需求。自写 Rust 方案与现有箭头语法规则冲突，不得默认豁免 |

没有 Windows 设备证据表示未验证，不表示 Windows 失败。本轮不具备接受或全面拒绝 Tauri 的证据。

## 5. 如果后续采用 Tauri，最小合理边界

这是有条件的后续建议，不是新增批准的实现范围。

- React/TypeScript 负责交互、画布文档状态、设计师对话及能力展示；继续使用箭头函数。
- 小型原生后端集中负责项目路径校验、连接/原子事务、系统凭据、带凭据的提供方请求及需要本机库的处理。不要从 renderer 散落发 SQL 或先取 Key 再 fetch。
- 可由 Web Worker 正确完成的解码/合成/编码走现有浏览器能力；特殊格式、复杂蒙版、ICC 等仍按 M04/M07 调研并实测，不能凭此探针宣布全部支持。
- 测试构建才启用 WDIO 内嵌服务及执行权限，发布构建剔除。核验原生系统对话框覆盖，避免测试插件制造“发布版也通过”的错觉。
- 自动更新包签名与 Apple/Windows 应用签名是不同层。Windows 默认 WebView2 bootstrapper 可能要联网；核心离线使用与完全离线首次安装应分别记录，不从“小安装包”推导离线可用。

**首要决策前提是函数规则。** 用户原话是“所有函数都要用箭头函数”，现有 [开发守则](../DEVELOPMENT-GUARDRAILS.md) 和 [ADR 0018](../adr/0018-tauri-react-desktop-runtime.md) 明确未授予原生代码例外。Rust 不能使用 JS/TS 箭头语法。本次上游原样宿主不改变这一点。若后来明确允许必要的原生 Rust 函数，Tauri 仍是值得继续验证的方案；若坚持所有自写代码均为箭头语法，应优先做 Electron 同条件对照，不能未经验证自动切换。

本轮无需为研究另行取得用户业务数据或 API Key，也未要求修改产品范围。正式签名证书和 Windows 执行环境在对应验收阶段再补；不把发布条件缺失当作当前 Mac 编译失败。

## 6. 已访问的资料

来源内容 SHA 和日期完整记录在 [research-sources.json](../../experiments/runtime/research-sources.json)。本轮读取公开 GitHub API，以下文档入口便于后续阅读；采用插件前仍需锁定对应发布版本、完整许可证及传递依赖。资料核验不等于样例验证。

| 来源 | 本轮支持的判断 |
| --- | --- |
| [Tauri 仓库](https://github.com/tauri-apps/tauri)、[2.11.5 发布](https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.11.5) | 仓库未归档，检索日有维护活动；latest API 发布日期 2026-07-01；源码 MIT OR Apache-2.0。维护活动不是稳定性保证 |
| [WebView](https://v2.tauri.app/reference/webview-versions/) | macOS 系统 WKWebView、Windows WebView2；平台表现需分测。未采用该页旧兼容表作为首版最低 OS 承诺 |
| [SQL 插件](https://v2.tauri.app/plugin/sql/)、[TS 接口](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/guest-js/index.ts)、[连接池源码](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs) | TS 无固定连接事务接口，Rust pool.execute/pool.fetch_all；文档中的迁移原子事务不等于任意多次 JS 调用原子。相对路径默认 app config；不能据此断言绝对路径不支持 |
| [Stronghold](https://v2.tauri.app/plugin/stronghold/)、[社区 keyring](https://github.com/charlesportwoodii/tauri-plugin-keyring) | 保险库与系统凭据库不同；社区候选 README 示例版本 0.2.0、MIT/Apache-2.0 标识，尚未采用。getPassword/getSecret 会返回秘密到调用 JS |
| [官方 WebDriver](https://v2.tauri.app/develop/tests/webdriver/)、[WDIO 服务](https://github.com/webdriverio/desktop-mobile/tree/main/packages/tauri-service)、[插件设置](https://github.com/webdriverio/desktop-mobile/blob/main/packages/tauri-service/docs/plugin-setup.md) | embedded 可覆盖 macOS，服务 README 标 MIT；测试插件注册、能力权限与 release 排除仍需实测。未把浏览器模式计入原生 E2E |
| [Sidecar](https://v2.tauri.app/develop/sidecar/) | 可捆绑外部二进制，按目标架构命名；JS 启动需最小 shell 权限 |
| [macOS 签名](https://v2.tauri.app/distribute/sign/macos/)、[Windows 安装器](https://v2.tauri.app/distribute/windows-installer/)、[Updater](https://v2.tauri.app/plugin/updater/) | 发布能力有官方路径；Windows MSI 在 Windows 构建，NSIS 交叉编译有 caveat；更新签名不能禁用 |

## 7. 记录影响

[ADR 0018](../adr/0018-tauri-react-desktop-runtime.md) 保留 proposed，并链接本报告；[依赖门槛](DEPENDENCY-GATES.md) 更新联网状态；[模块登记](../verification/MODULE-REGISTER.md) 将 M01 标部分验证。M02–M08 尚未实现，无已通过模块需要假装回归。将来运行时/桥接决定影响这些消费者时，按已确认回归协议重新验证。
