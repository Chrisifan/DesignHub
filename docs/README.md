# DesignHub 文档入口

更新：2026-09-13。DesignHub V1 的 Q1–Q66 决策、应用说明、UI 基线、Electron 方向与八模块实施规划已经确认冻结；M01–M08 的本地优先功能路径已实现并回归，状态和外部发布门槛见[模块验证与回归登记](verification/MODULE-REGISTER.md)与[发布验证](verification/RELEASE.md)。

最新进展：[实机功能进度检查（2026-09-15）](verification/UI-PROGRESS-2026-09-15.md)；[Electron 选型报告](research/M01-electron-runtime-results.md)；macOS 打包 smoke、业务 E2E 和本地工作流均有记录。Windows、签名/公证、真实提供方与系统钥匙串、性能和人工视觉质量仍待验证。[Tauri 历史探针](research/M01-runtime-results.md)不计入 Electron 通过证据。

## 给 UI 设计师

先读 [应用说明书](product/APPLICATION-GUIDE-FOR-UI.md)：产品定位、术语、20 个页面/功能区域、创建与创作流程、全部工具、版本署名、错误恢复、离线、平台差异和 UI 交付清单。再读 [UI 基础规范](product/UI-FOUNDATIONS.md)：Figma 取稿范围、明暗主题、无标题栏与毛玻璃、布局、四字按钮、国际化、抽屉、动效和验收矩阵。UI 设计师可在这些边界内完成具体页面设计，并按模块交付相关页面、状态、双语及响应式确认。

## 给开发者

1. [开发守则](DEVELOPMENT-GUARDRAILS.md)：调研、测试/checklist、回归、范围与函数风格。
2. [UI 基础规范](product/UI-FOUNDATIONS.md)：组件、窗口、主题、布局、语言和 UI01–UI10 验收边界。
3. [架构与功能基线](superpowers/specs/2026-09-08-designhub-v1-design.md)：模块边界、存储所有权、任务与版本一致性。
4. [全模块实施计划](superpowers/plans/2026-09-08-designhub-v1.md)：八个模块、27 个任务、依赖顺序、Q1–Q66 覆盖及发布闸门。
5. [依赖研究门槛](research/DEPENDENCY-GATES.md)：Electron 当前门槛与各模块依赖研究标准。
6. [模块验证与回归登记](verification/MODULE-REGISTER.md)：实施前测试记录要求、M01–M08 当前验证状态与回归范围。

## 决策来源

领域词汇见 [CONTEXT.md](../CONTEXT.md)，架构决策在 `docs/adr/`。当前桌面基础决策见 [ADR 0024](adr/0024-electron-react-desktop-runtime.md)；ADR 0018 仅为被替代的 Tauri 历史记录。

若文档与已确认产品规则冲突，以用户最新决定为准，修订相关规格和测试。Figma 只使用 UI 基础规范明确允许的 DesignHub Frame；其他页面和示例内容不是产品事实源。
