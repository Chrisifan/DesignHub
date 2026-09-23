# 首次启动引导与启动屏设计规格

## 背景与目标

首次启动需要在不恢复旧工作区概念的前提下，完成应用级用户资料和项目库初始化。应用每次启动还需要先展示统一的品牌启动屏，再进入首页或首次启动引导。

目标：

- 首次启动提供两个步骤：必填的用户资料/存储目录，以及可跳过的模型配置。
- 头像支持本地图片上传，并与昵称一起成为全局用户资料。
- 项目继续以用户选择的单一项目库目录区分，不重新引入工作区切换。
- 每次应用启动先显示居中的 Logo 与 slogan 启动屏。
- 已完成引导的用户再次启动时，启动屏结束后直接恢复项目库或显示项目库位置错误。

## 方案与边界

采用 renderer 内的引导状态机，配合主进程 `userData` 下的应用资料存储：

1. **Splash**：每次 App 挂载先进入 `splash` 状态，显示现有 light/dark Logo 资源、应用名称和 slogan。启动屏至少展示 650ms，并等待基础 profile/project-library 状态读取完成；两者都完成后再淡出进入目标状态。窗口级主题切换不影响启动屏的居中布局。
2. **Profile step**：显示昵称、头像上传、项目库目录选择。三项都是必填。头像接受 PNG、JPEG、WebP 和 GIF（只取首帧），原始文件不超过 10MB；读取后在 renderer 中生成预览，提交时交给主进程压缩为不超过 512KB 的受控 profile 数据；不保存原始文件路径作为唯一引用。
3. **Model step**：复用当前 `ProviderSettings` 的 provider 列表、凭据存储和保存行为，包装成引导步骤。`跳过` 只标记引导已完成，不删除或修改已有模型配置。
4. **Studio**：引导完成后按现有项目库状态进入 Studio。Studio 用户菜单读取同一份 profile，展示真实头像或昵称首字母回退。

不恢复旧 workspace onboarding、最近工作区列表、旧工作区迁移或 renderer-only 的昵称持久化。

## 状态与数据流

应用级 profile 使用 `userData/profile.json` 保存：

- `formatVersion`
- `onboarding.profileCompleted`
- `onboarding.modelStepCompleted`（保存或跳过都为完成）
- `displayName`
- `avatar`（压缩后的 data URL 或 userData 下受控头像文件引用）

项目库目录继续通过现有 `project-library.json` 和 `project-library:get-status` / `project-library:choose` 管理。新增 profile IPC 只负责应用级资料和引导状态，不复制项目库生命周期逻辑。

启动顺序：

```text
App mount
  -> splash shown
  -> load profile + project-library status in parallel
  -> profile incomplete      => profile step
  -> profile complete, model incomplete => model step
  -> both complete           => existing project-library entry / location recovery
  -> minimum splash duration + destination ready
  -> fade splash out
```

如果 profile 读取失败，启动屏结束后显示可重试的错误状态，不静默覆盖已有资料。目录选择取消或失败时停留在第一步；项目库目录无效时沿用现有错误提示。只有昵称去除首尾空白后非空、头像存在、目录选择成功，第一步的继续按钮才可用。

## 启动屏视觉与交互

- 内容在应用窗口可视区域水平、垂直居中，不显示窗口级欢迎表单或项目库按钮。
- 使用现有 `designhub-logo-light.png` / `designhub-logo-dark.png`，根据主题选择资源。
- Logo 下方显示 `Design Hub` 和 slogan：中文使用“无需登录，离线即可进入工作区。”，英文使用现有英文翻译“Enter your workspace offline without signing in.”。
- 启动屏至少展示一个短暂、稳定的时长，避免启动瞬间闪烁；读取较慢时保持启动屏，读取完成后再进行淡出。
- 尊重 `prefers-reduced-motion`：减少为无动画切换，但不取消启动屏内容本身。
- 启动屏不阻塞窗口关闭、最小化等系统控制。

## 组件与接口边界

- `App.tsx`：负责 splash/onboarding/studio 顶层状态机、并行加载和步骤切换。
- 新增 profile storage 与 IPC handler：负责 profile 读取、保存、头像处理和引导完成状态。
- `preload.ts` / `platform/contracts.ts`：暴露最小化的 profile API 与头像上传输入类型。
- 新增可复用 onboarding/profile 组件：管理表单校验、头像预览和目录选择。
- 从 `LibraryPages.tsx` 提取共享的 provider 配置内容，供模型连接设置弹窗和 onboarding model step 使用；现有 provider IPC 契约保持不变。
- `Studio.tsx` / `StudioUserMenu.tsx`：接收 profile 或通过统一 profile 读取结果展示昵称、头像。
- `window.css` 和 locale 文件：增加启动屏布局、动画和中英文文案。

## 错误处理与兼容性

- 用户取消头像选择：不报错，保留当前步骤和已有表单内容。
- 不支持的图片格式、读取失败或超过压缩限制：显示行内错误，不写入 profile。
- profile 文件缺失：视为首次启动；profile 文件格式无效：显示可重试错误，并保留项目库文件不变。
- 已有旧 `designhub.operator.name` 时只作为一次性昵称回退读取，不再继续写入；头像没有旧数据时使用首字母。
- 非 Electron/runtime 测试环境使用 platform runtime 的空实现，App 仍可渲染启动屏和引导的可测试状态。

## 测试策略

- profile store：缺失、有效、无效 JSON、原子写入、头像数据保存和引导状态更新。
- profile IPC：受信任窗口可读写，非法 sender 被拒绝。
- App：启动屏先显示并在最短时长后退出；profile step 必填校验；头像本地上传预览；目录选择成功/取消/失败；model step 保存和跳过；已完成引导直接进入 Studio。
- ProviderSettings 共享组件：现有连接配置测试继续通过，并增加嵌入 onboarding 的保存/跳过回调测试。
- 视觉样式只补充组件级可访问性断言，不依赖固定截图像素。

## 非目标

- 不实现云端账号、跨设备同步或在线头像存储。
- 不修改项目库内部项目、任务历史、回收站等共享数据结构。
- 不重新引入工作区切换或旧工作区迁移。
