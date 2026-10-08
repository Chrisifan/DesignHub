# DesignHub 整体代码优化实施计划

## 目标

在不改变 `libraryId`、typed IPC、`TaskRecord`、候选修订和受管素材协议的前提下，降低任务、图像工具、Studio、主进程和项目包代码复杂度，改善首屏包体、任务性能、批量作业和项目包内存表现，并缩短测试反馈周期。

## 执行顺序

1. 冻结基线，补齐聚焦测试入口、共享测试工厂和性能基准。
2. 将任务执行链拆为 TaskRecord factory、状态机、executor、recovery、candidate service、error policy 和 runtime adapter，保留 `task-service.ts` facade。
3. 将 `ImageToolsPage` 拆为 shell、configurator、scan preview、job list/details、commands 和 view-model；将批量后端拆为 scanner、worker、scheduler、publisher 和 job-store。
4. 收口 Studio、Workbench、LibraryPages 的场景、候选、选择、工具提交和任务订阅状态。
5. 将主进程复杂业务下沉到 desktop service，registrar 只负责边界校验和转发。
6. 优化项目包、大图和临时目录生命周期，记录内存和耗时证据。
7. 继续拆分 renderer 首屏 chunk 与 CSS 域，确保非首屏功能懒加载。
8. 统一测试 fixture、性能命令和独立临时资源，保持覆盖率与门禁强度。
9. 运行全量验证并更新验证文档和外部门禁状态。

## 不变约束

- 公共运行时身份只使用 `libraryId`；`workspaceId` 仅保留在持久化兼容层。
- 不修改 typed IPC channel、preload 白名单和 renderer bridge 形状。
- provider 不自动切换、不静默重试可能计费的请求；`unknown` 不自动重发或创建修订。
- 大图、mask 和结果图二进制不进入长期 renderer state 或 `TaskRecord`。
- 浏览器 E2E、native source smoke 和离线 provider 契约不替代真实 provider、Windows、签名、公证、Keychain、packaged native 和人工视觉质量证据。

## 阶段门禁

每个阶段先写 Red 回归测试，再实现 Green；完成后运行聚焦测试、`pnpm lint`、`pnpm typecheck` 和 `git diff --check`。每两个阶段运行 unit、integration、E2E、native、provider 和 build；最终运行 `pnpm release:check`。

## 性能目标

- 100 条任务历史加载 `<500ms`。
- 1000 项批量作业索引 `<1s`。
- 100 项目搜索 `<500ms`。
- 项目包峰值内存不超过归档大小的 `2x`。
- renderer 初始 chunk `<500 kB`；无法拆分的第三方 chunk 必须有实际证据并明确记录。

## 外部 blocked 项

Windows 真机、签名/公证、安装升级、Keychain、packaged native、真实 provider 费用/质量/远端取消、跨设备恢复、ZIP 严格流式固定内存和人工视觉质量继续单独登记，不伪装为本地通过。
