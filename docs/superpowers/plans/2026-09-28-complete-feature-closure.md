# DesignHub 全功能闭环完成计划

日期：2026-09-28

## 目标

将 DesignHub 从本地基础能力推进到“生成候选 → 画布确认 → 图像工具处理 → 批量处理 → 导出 → 项目包交接 → 高级编排/样机 → 发布证据登记”的完整链路。保留 `libraryId`、typed IPC、TaskRecord、候选分支、受管素材和项目包架构。

## 阶段

1. 候选结果和 `remove-background` 正式闭环：候选结果持久化，画布立即预览，确认才创建修订，支持重启恢复和实际选中图层。
2. 持久化 mask 和区域工具基础：矩形/笔刷栅格化为 PNG 受管素材，任务只保存 `maskAssetId`，拒绝缺失或损坏 mask 的自动重试。
3. Provider 具体工具能力矩阵：声明工具、mask、透明度、尺寸、参数范围、远端取消和查询能力，禁止隐式切换。
4. 任务取消、远端查询和 `unknown` 恢复：重启不重发，明确查询、取消和风险重试动作。
5. 独立图像工具页面和批处理作业：主进程文件选择、隔离输出目录、暂停/继续/取消、失败项重试和结果导入。
6. 工具语义补齐：按 `replace-background`、`expand`、`remove-object/inpaint`、`smart-crop/upscale`、`remove-watermark` 顺序复用候选修订流程。
7. 项目包完整交接和大文件恢复：流式处理、哈希校验、原子发布、失败清理、跨项目库重开。
8. 导出和跨尺寸交付：真实格式校验、revision snapshot、关联尺寸独立修订和大图/长历史验证。
9. 智能编排和样机效果图：结构化候选场景与模板 manifest，均先候选后确认。
10. 外部发布证据：Windows、签名、公证、Keychain、live provider、跨设备和人工视觉质量分别登记为 blocked 或已验证。

## 约束

- 公共运行时身份只使用 `libraryId`；持久化兼容字段保留 `workspaceId`。
- 原始图像、结果图和 mask 只进入受管素材，不长期放在 renderer 状态或 TaskRecord 二进制字段中。
- provider 不自动切换、不静默重试；`unknown` 不自动创建修订。
- 浏览器 E2E 使用 bridge fixture，真实 provider 和外部发布能力单独登记。
- 每个阶段先写 Red 测试，再实现 Green；完成后运行聚焦测试并更新验证文档。

## 阶段门禁

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:native
pnpm test:provider
pnpm lint
pnpm typecheck
pnpm build
git diff --check
pnpm release:check
```

## 当前执行策略

本轮优先完成阶段一至四的可验证本地闭环，并建立阶段五至九所需的域模型、能力声明和恢复契约；阶段十只记录外部阻塞，不伪造通过证据。
