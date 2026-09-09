# 依赖研究与桌面运行时验证门槛

创建：2026-09-08；更新：2026-09-09。状态：Electron 已按用户决定选为桌面基础框架；官方资料核验已完成，Electron 工程与双平台样例尚未完成。Tauri 的历史探针见 [Tauri 报告](M01-runtime-results.md)，Electron 当前记录见 [M01 Electron 报告](M01-electron-runtime-results.md)。

## 1. 统一采用步骤

每项实现前记录官方仓库/文档 URL、检索日期、准确版本、许可证、最近发布及修复、支持平台、所需能力、限制、依赖体积、替代方案和实测结果。避免仅以星数或最近提交证明稳定性。许可证以实际引入版本及二进制组合为准。

依赖版本验证状态为：未研究 → 资料核验 → 样例验证 → 采用 / 拒绝。框架方向的用户决策与验证状态分别记录：Electron 已选，但具体版本与平台能力尚未验收。已有安全通用库可缩短验证，不能跳过记录；版本锁定发生在工程采用时。

## 2. 候选与评估矩阵

以下链接是统一研究起点；已实际访问哪些来源，以 [Electron 报告](M01-electron-runtime-results.md) 为准。G01 的 Electron 资料核验完成但样例未执行；其余工程/画布/图像库仍按模块实施前核验。

| 门槛 | 模块 | 候选及官方入口 | 必测能力 / 拒绝条件 |
| --- | --- | --- | --- |
| G01 桌面宿主 | M01 | [Electron](https://github.com/electron/electron)；Tauri 仅历史对照 | 双平台、main/preload/renderer 安全边界、箭头函数要求、原生测试、更新签名；不能因生态成熟忽略 Chromium 版本和包体 |
| G02 工程与校验 | M01 | [Electron Forge](https://github.com/electron/forge)、[Vite](https://github.com/vitejs/vite)、[TypeScript](https://github.com/microsoft/TypeScript)、[ESLint](https://github.com/eslint/eslint)、[Zod](https://github.com/colinhacks/zod) | Forge 为官方推荐的优先研究路线；核验 main/preload/renderer 构建、Vite 集成成熟度与 pnpm 兼容性；只采用一套打包链路 |
| G03 交互与状态 | M01/M05 | [React Aria](https://github.com/adobe/react-spectrum)、[Radix](https://github.com/radix-ui/primitives)、[Zustand](https://github.com/pmndrs/zustand)、[i18next](https://github.com/i18next/i18next) | 键盘/读屏/中文；状态库仅在本地 React 状态不足时增加；不引入完整视觉模板 |
| G04 数据与文件 | M02 | [SQLite](https://sqlite.org/docs.html)、[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)、Electron main/utility | 原子事务、WAL 备份、中文路径、迁移和移动恢复；验证匹配的预编译件，缺失/不兼容时按 Electron 重建 |
| G05 画布 | M05 | [Konva](https://github.com/konvajs/konva)、[react-konva](https://github.com/konvajs/react-konva)、[Fabric.js](https://github.com/fabricjs/fabric.js) | 输入法、可编辑文字、序列化、遮罩、大图、WebView 性能；不把任一库内置 JSON 当项目永久格式 |
| G06 图像解码/输出 | M04/M07 | [Sharp](https://github.com/lovell/sharp)、[PDF.js](https://github.com/mozilla/pdf.js)、[ag-psd](https://github.com/Agamnentzar/ag-psd)、[pdf-lib](https://github.com/Hopding/pdf-lib) | 查 Node-API/平台预编译件及打包加载；需要时重建，不泛化为所有库都要 ABI 重编译；逐一验证格式/字体/透明度/ICC 与许可 |
| G07 凭据 | M06 | 成熟 Node 系统凭据绑定（实施前研究）；[safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) 为对照 | 继续满足系统凭据存储要求；safeStorage 的应用密文并非凭据条目；拒绝时无明文回退，已存 Key 不回传 renderer |
| G08 模型能力 | M03/M06/M07 | 所选提供方官方 SDK / HTTP 文档；[ComfyUI](https://github.com/Comfy-Org/ComfyUI) 等本地服务仅作候选 | 文本/视觉/生成/编辑/选区、查询取消、用量、幂等、跨平台；不用统一接口虚构供应商支持能力 |
| G09 压缩/包/备份 | M02/M07 | [fflate](https://github.com/101arrowz/fflate)、SQLite 官方备份 API、宿主原生文件 API | 大文件流式、校验、路径穿越拒绝、引用闭包、部分写失败与恢复；避免一次读入整个大工作区 |
| G10 测试 | M01/M08 | [Vitest](https://github.com/vitest-dev/vitest)、[Testing Library](https://github.com/testing-library/react-testing-library)、[Playwright Electron](https://playwright.dev/docs/api/class-electron)、[WebdriverIO Electron](https://webdriver.io/docs/desktop-testing/electron)、[axe-core](https://github.com/dequelabs/axe-core) | 原生 Electron 覆盖与浏览器替身分离，中文 IME、文件对话框和主进程边界单独验证 |
| G11 本地检索 | M08 | [SQLite FTS5](https://sqlite.org/fts5.html)、先评估本地普通查询 | 中文分词/子串匹配样本必须通过；不能仅英文测试判定中文全文可用 |

G01/G07/G10 补充（2026-09-09）：Electron 官方文档确认进程/桥接模型、safeStorage 的系统加密保护与原生模块适配方法；自动化给出 WebdriverIO 和仍标 experimental 的 Playwright Electron。main 分支文档的新 API 需要再次核对目标稳定版本。本轮未执行 Electron 样例。

模型供应商品牌尚未确定；不将某个商业 SDK 锁进基础实体。每项能力至少一个真实验证路径才可称支持；其中基本离线画布/尺寸/格式操作不得要求云 Key。

## 3. 网络恢复后的只读核验示例

```sh
gh api repos/electron/electron --jq '{name: .full_name, archived, pushed_at, license: .license.spdx_id}'
gh api repos/electron/electron/releases/latest --jq '{tag_name, published_at, html_url}'
gh api repos/electron/forge --jq '{name: .full_name, archived, pushed_at, license: .license.spdx_id}'
gh api repos/konvajs/konva --jq '{name: .full_name, archived, pushed_at, license: .license.spdx_id}'
```

将相应仓库替换为矩阵中的精确官方目标；读取目标版本 LICENSE、支持矩阵和关键问题，记录可引用 URL。调用失败只登记失败，不填造数据。真正安装依赖前再核验准确版本，网络研究只访问公开资料，不需要项目上传。

## 4. G01 平台试验方案

Electron 实验输出是验收证据，不是可直接交付的应用。使用同一组许可测试素材和既有 R01–R08 标准；历史 Tauri 合成探针只能参考，不能记作 Electron 结果。除非重新决定选型，不再要求并行维护两套宿主。

| 验证编号 | 操作 | 通过条件 / 证据 |
| --- | --- | --- |
| R01 | 6000×4000 图像、20 图层、中文文字，平移缩放选择及导出 | 在指定基准机器上记录 CPU/内存/延迟；交互 p95 目标 <100ms，拖动不出现持续 >1s 无响应；数值可经证据校准 |
| R02 | 连续导入导出 10 次大图 | 无崩溃，峰值内存和回落记录明确，无随次数无界增长；解码在后台 |
| R03 | SQLite 创建、并发拒绝、WAL 中备份、移动目录、迁移中断 | 还原前后实体/资源校验一致；无完成状态指向缺文件 |
| R04 | 系统密钥保存、读取、拒绝访问、新设备打开项目 | Key 不在项目/包/日志；拒绝时无明文回退 |
| R05 | 后台图像处理及模拟失败 | UI 可操作，失败不污染历史，取消/进度对应真实能力 |
| R06 | 自动打开项目、编辑画布、导出 | 浏览器测试及原生宿主证据分别记录；macOS/Windows 均有可维护方案 |
| R07 | 两平台安装、启动、升级、卸载保留用户数据 | 先无签名实验验证结构；正式发布前签名/公证和更新链路必须补实证 |
| R08 | 清点所有自写源码的函数形式 | Electron main/preload/renderer 与测试中的 JS/TS 函数、回调、组件使用箭头；第三方 native addon 不计为自写，但须保留来源与 ABI 记录 |

记录实际 OS、CPU、RAM、GPU、缩放与运行版本；未拿到基准设备时标记未验证，不用模拟浏览器代替 Windows 原生结果。对包体/内存只作测量比较，未经测量不宣称 Tauri 必然优于 Electron。

## 5. 采用 / 回退判定

Electron 已按用户决定作为基础框架；仍须满足 R01–R08 才能宣称首版平台验收通过。若关键条件失败，记录原因并调整实现边界或重新评估运行时，不以旧 Tauri 探针或浏览器 mock 代替 Electron 证据。

运行时决定写回 [ADR 0024](../adr/0024-electron-react-desktop-runtime.md)；[ADR 0018](../adr/0018-tauri-react-desktop-runtime.md) 仅保留为被替代的历史决策。
