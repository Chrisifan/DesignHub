# DesignHub 全工具与批量工具完成计划

日期：2026-09-28

## 目标

完成 9 个画布图像工具、4 个独立批量工具、智能编排和样机效果图的统一闭环：

```text
画布：选中图层 → 任务 → 受管结果 → 候选场景 → 确认 → 不可变修订
批量：选择文件/目录 → 扫描预检 → 持久化作业 → 调度 → 校验 → 原子发布 → 显式导入素材库
```

## 实施顺序

1. 统一 TaskRecord、ToolCandidate、executor、取消和 `unknown` 恢复语义。
2. 逐个完成 `remove-background`、`replace-background`、`remove-object`、`inpaint`、`expand`、`smart-crop`、`upscale`、`resize`、`remove-watermark` 的参数、能力、候选和修订测试。
3. 完成批量去背景、放大、尺寸转换、格式转换的安全扫描、持久化作业、暂停/继续/取消、失败重试和结果导入。
4. 接入独立图像工具页面、扫描拒绝预览、结果网格、打开/reveal/输出目录和素材库导入。
5. 接入结构化智能编排候选和手机/海报/包装袋样机候选；不支持结构化输出时明确标记栅格回退。
6. 补齐项目包、大图导出和跨尺寸交付验证。
7. 记录真实 provider、Windows、签名、公证、Keychain、跨设备和人工视觉质量门禁。

## 不变约束

- 公共运行时身份只使用 `libraryId`；持久化兼容字段可保留 `workspaceId`。
- 二进制图像和 mask 只进入受管素材或批量输出目录。
- provider 不自动切换或静默重试；`unknown` 不自动提交修订。
- 浏览器 E2E 使用 bridge fixture，不能作为真实模型质量证据。

## 当前执行登记（2026-09-28）

- 已实现：候选场景、持久化矩形/笔刷 mask、provider 工具能力模型、任务 `unknown` 恢复、批量 scanner/publisher/worker/scheduler、主进程 IPC/preload、批量页面入口、智能编排和样机域模型。
- 本轮收口：批量创建前扫描预检、拒绝项展示、结果打开/reveal/输出目录、结果显式导入受管素材；修复 Workbench 候选初始渲染和 smart-crop 默认参数回归。
- 已关闭本地入口切片：结构化智能构图和三类样机已接入 Studio 创建抽屉与 Workbench 候选确认；真实 provider 授权样本、人工质量和 native 实机证据仍未关闭。
- 已关闭候选恢复切片：本地智能构图/样机候选写入 TaskRecord，重启后恢复未解决候选，确认/放弃写入审计状态。
- 已关闭项目包交接正确性切片：源库隔离后可在新库重开、编辑、提交修订并再导出；外部归档目标采用临时文件和 no-replace 发布。
- 未关闭：ZIP 大文件流式/固定内存恢复、批量 native 文件选择器实机证据、Windows/签名/公证/Keychain。

## 阶段门禁

```bash
pnpm exec vitest run --config vitest.config.ts src/features/image-tools src/app/studio/Workbench.test.tsx src/app/studio/LibraryPages.test.tsx
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
