# DesignHub 产品资料入口

更新：2026-10-14。当前唯一 V1 基线是[项目级图片画布发布规格](superpowers/specs/2026-10-14-designhub-v1-release-baseline-design.md)与[整体完成计划](superpowers/plans/2026-10-14-designhub-v1-completion.md)。旧多文档、修订、品牌包与 Workbench 资料仅保留为 superseded 历史记录。[当前验证状态](verification/CURRENT-STATUS-2026-10-14.md)是 M01–M08 状态入口。

历史进展与证据继续保留在[旧完成度基线](verification/CURRENT-STATUS-2026-09-24.md)、[实机功能检查](verification/UI-PROGRESS-2026-09-15.md)和[发布验证](verification/RELEASE.md)，但不替代当前门禁。Windows、签名/公证、真实提供方与系统钥匙串、性能和人工视觉质量仍待验证。[Tauri 历史探针](research/M01-runtime-results.md)不计入 Electron 证据。

## 给 UI 设计师

先读 [应用说明书](product/APPLICATION-GUIDE-FOR-UI.md)：产品定位、术语、20 个页面/功能区域、创建与创作流程、全部工具、版本署名、错误恢复、离线、平台差异和 UI 交付清单。再读 [UI 基础规范](product/UI-FOUNDATIONS.md)：Figma 取稿范围、明暗主题、无标题栏与毛玻璃、布局、四字按钮、国际化、抽屉、动效和验收矩阵。UI 设计师可在这些边界内完成具体页面设计，并按模块交付相关页面、状态、双语及响应式确认。

## 给开发者

1. [开发守则](DEVELOPMENT-GUARDRAILS.md)：调研、测试/checklist、回归、范围与函数风格。
2. [UI 基础规范](product/UI-FOUNDATIONS.md)：组件、窗口、主题、布局、语言和 UI01–UI10 验收边界。
3. [V1 发布基线](superpowers/specs/2026-10-14-designhub-v1-release-baseline-design.md)：项目级图片画布、数据边界、Provider 与发布契约。
4. [V1 整体完成计划](superpowers/plans/2026-10-14-designhub-v1-completion.md)：阶段门禁、功能闭环、真模型、性能安全与双平台发布。
5. [依赖研究门槛](research/DEPENDENCY-GATES.md)：Electron 当前门槛与各模块依赖研究标准。
6. [模块验证与回归登记](verification/MODULE-REGISTER.md)：实施前测试记录要求、M01–M08 当前验证状态与回归范围。

## 决策来源

领域词汇见 [CONTEXT.md](../CONTEXT.md)，架构决策在 `docs/adr/`。当前桌面基础决策见 [ADR 0024](adr/0024-electron-react-desktop-runtime.md)；ADR 0018 仅为被替代的 Tauri 历史记录。

若文档与已确认产品规则冲突，以用户最新决定为准，修订相关规格和测试。Figma 只使用 UI 基础规范明确允许的 DesignHub Frame；其他页面和示例内容不是产品事实源。

当前产品术语约束：图像工具直接作用于项目图片或独立图片文件。旧文档/修订 schema 不迁移，检测时返回 `DOCUMENT_SCHEMA_REMOVED` 并保持原目录不变。
# Architecture Decisions

- [ADR 0026: Single project library replaces user-visible workspaces](adr/0026-single-project-library.md)
