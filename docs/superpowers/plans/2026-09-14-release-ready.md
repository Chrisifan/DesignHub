# DesignHub V1 发布就绪闭环实施计划

**Goal:** 在现有核心模型生成能力基础上，完成仓库内剩余业务闭环、交付验证和可执行发布门禁。

**Architecture:** 保持现有 Electron、typed preload、SQLite、项目包和任务状态机；新增验证/发布边界，不改变既有业务 API。默认测试完全离线，真实提供方、Windows 和签名验证通过显式命令执行并单独记录。

**Tech Stack:** TypeScript、React、Electron Forge、Vitest、Playwright、Sharp、SQLite、fflate。

## 实施任务

### 1. M06 提供方与任务闭环

- 覆盖 chat、stream、vision、image-generation、image-editing 五类请求及 conversation/image profile 路由。
- 覆盖模型字段、multipart 工具/区域元数据、429/5xx/坏 JSON、取消、未知费用、零图像结果和重试参数保留。
- 使用本地 HTTP fixture 实现默认 conformance harness；不得访问网络。
- 增加显式 live smoke：仅在 `DESIGNHUB_LIVE_PROVIDER=1` 且提供端点/模型/凭据时运行，输出脱敏结果。
- 回归任务重启、取消、候选定稿、无原图编辑重试和凭据隔离。

### 2. M03/M04 内容与历史闭环

- 作品集来源仅在用户确认授权和选择来源后提交；逐项保留失败信息。
- 默认只持久化来源、授权声明和提炼特征；只有显式归档才保留原始参考资料。
- 设计师/品牌快照、贡献角色、操作人名称和修订来源保持不可变。
- 归档、重命名、恢复和项目复制不得改写历史署名。
- 使用真实临时工作区验证只读、符号链接、损坏来源、取消和重启恢复。

### 3. M05/M07 图像与交付闭环

- 为图像元数据增加可选颜色空间信息，导出前校验 sRGB、尺寸、透明度、magic 和 SHA-256。
- 验证 PNG/JPEG/WebP/PDF 的真实字节输出；透明图转 JPEG 必须要求背景。
- 构建项目包闭包报告，覆盖 manifest、documents、revisions、assets、设计师/品牌快照，并排除凭据、聊天、未归档参考资料和字体。
- 导入采用临时目录和原子发布；哈希漂移、路径逃逸、重复项目、损坏 ZIP 和符号链接必须 fail-closed。
- 覆盖外接盘失败、目标已存在、归档副本失败、临时文件清理和大图基准。
- HEIC/PSD 仅在实际 codec 可验证时注册，否则保持明确不可用。

### 4. M08 与 Electron 发布自动化

- 配置 macOS/Windows makers，并保持 native modules 的 unpack/rebuild 策略。
- `release-check` 串行执行 unit、integration、E2E、native、lint、typecheck、build、包体扫描和 `git diff --check`。
- 增加 macOS 安装/升级/卸载数据保留检查和 Windows CI/手验入口。
- 增加 100 项目检索压力、索引损坏重建、诊断包脱敏扫描和包体凭据扫描。
- 无 Windows、签名证书、公证凭据或真实 Keychain 时输出 `blocked` 及原因，不伪造通过。

### 5. 最终回归

- 每个模块先完成 Red 测试，再实现 Green，并更新对应 `docs/verification/Mxx.md`。
- 串行运行 unit、integration、E2E、native、lint、typecheck、build 和 diff check。
- 使用 macOS packaged executable 重跑 native smoke。
- 生成不含密钥、原图、路径、提示词和项目内容的发布摘要。
- 将真实提供方、Windows、签名/公证、Keychain、跨设备和人工图像质量保留为外部门禁。

## 接口变更

- 保持现有业务 API 向后兼容。
- 新增验证类型：`ProviderConformanceHarness`、`PackageClosureReport`、`ReleaseCheckResult`。
- `ImageMetadata.colorSpace` 为可选增量字段。
- 新增 live smoke 和 release-check 命令，不进入默认测试。
