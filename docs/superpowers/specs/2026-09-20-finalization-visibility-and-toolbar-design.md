# 定稿回显与右侧工具栏入口设计

## 背景

当前候选稿可以在画布中被选中并定稿，但定稿链路存在三个可见问题：

- 定稿入口位于顶部工具栏，未直接出现在画布右侧上下文工具栏中，入口层级过深且与候选选择关系不够明确。
- 定稿后返回项目详情时，文档卡片始终渲染静态 `ArtworkPreview`，不会读取真实文档 scene 和图片资产。
- 定稿流程以 fire-and-forget 方式保存 scene，并立即返回项目详情；同时项目 metadata 中的 `finalizedRevisionId` 未同步。重新进入画布和详情页回显均可能读取旧状态。

此外，当前定稿逻辑会选取 scene 中第一个图片层进行替换。若第一个图片层是 reference 图层，定稿结果可能继承错误的几何、透明度或可见状态，导致设计稿显示异常。

## 目标

- 在画布右侧垂直工具栏底部提供固定的定稿按钮。
- 只有选中候选稿后，定稿按钮才可点击。
- 定稿时只替换正式 content 图片层，不修改 reference 图片层。
- scene、final revision 和项目 metadata 全部持久化完成后才返回项目详情。
- 项目详情文档卡片显示真实定稿图片和正确的“已定稿”状态。
- 重新进入画布后加载同一张已定稿图片。
- 任一持久化步骤失败时保留当前候选和画布状态，允许用户重试。

## 非目标

- 不改变候选稿生成、排列和选择机制。
- 不重构 revision 存储格式。
- 不将项目详情改为完全由 revision 数据驱动。
- 不改变 reference、文字和形状图层的编辑行为。
- 不为历史面板中的已有版本定稿入口重新设计交互。

## 交互设计

### 右侧定稿按钮

定稿按钮采用已确认的方案 A：

- 放在 `workbench-context-tools` 底部。
- 与属性、对话、历史、工具等面板入口之间增加分隔线。
- 使用 `check-circle` 图标和“定稿所选候选”可访问标签。
- 不选中候选时保持显示但禁用。
- 选中候选后启用。
- 只读工作区或正在执行定稿时禁用。
- 点击后显示现有确认提示：“确认后其他候选稿将移除。是否定稿？”
- 删除顶部工具栏中的重复定稿按钮，避免同一动作出现两个主要入口。

候选稿的选中方式保持不变：点击候选卡片后设置 `selectedCandidateId`，并保留候选边框选中态。取消或完成定稿后清除选中状态。

### 成功与失败行为

定稿成功后：

1. 画布 scene 保存完成。
2. 新 revision 提交并设为 final。
3. 项目 metadata 对应文档的 `finalizedRevisionId` 更新完成。
4. 清除临时候选和当前分析线程状态。
5. 返回项目详情。
6. 文档卡片显示真实定稿缩略图及“已定稿”状态。

任一步失败时：

- 不返回项目详情。
- 不清除候选列表、选中候选或分析线程。
- 显示定稿失败提示。
- 已成功写入但后续步骤失败的数据允许下一次重试幂等覆盖或继续提交，不在前端执行破坏性回滚。

## 定稿数据流

### 1. 构造正式 scene

选中候选的 `sceneAssetId` 优先作为正式资产；缺少时使用候选的第一个 `assetId`。

正式图片层的选择规则为：

1. 查找 `type === 'image'`；
2. 排除 `role === 'reference'`；
3. 排除 `assetId === 'placeholder'`；
4. 找到后只替换其 `assetId` 并将 `role` 规范化为 `content`，保留几何、旋转、透明度、可见性和锁定状态；
5. 未找到时创建覆盖整个文档尺寸的新 content 图片层。

reference、文字和形状层保持不变。

### 2. 持久化顺序

`Workbench.finalizeCandidate` 按以下顺序串行等待：

1. 构造 `candidateScene`，暂不清理候选或离开画布。
2. 调用 `commitDocumentRevision`，提交包含 `candidateScene` 和候选资产的 revision。
3. 调用 `setFinalDocumentRevision` 将新 revision 设为 final。
4. 调用 `saveDocumentScene`，确认返回成功后更新本地 scene 状态。
5. 通过 `onCandidateFinalized` 回调通知 `Studio` 更新项目 metadata。
6. 刷新本地 revision state。
7. 清理临时候选状态并调用 `onBack`。

scene 保存必须显式 `await`，定稿链路不得复用当前 fire-and-forget 的 `persistScene`。

### 3. 项目 metadata 同步

`Workbench` 新增回调：

```ts
onCandidateFinalized?: (input: {
  documentId: string;
  revisionId: string;
  scene: DesignScene;
}) => void | Promise<void>;
```

`Studio` 实现该回调并调用现有 `updateProjectMetadata`：

- 保留项目当前 documents 数组及各文档字段；
- 只将当前文档的 `finalizedRevisionId` 更新为新 revision ID；
- 同步更新 `projects` 列表与当前 `selected` 项目；
- metadata 更新失败时抛出错误，使 Workbench 停留在当前画布。

revision store 继续只管理 revision 状态，不直接耦合 project store。

## 项目详情真实缩略图

新增 `ProjectDocumentPreview` 小组件，负责文档卡片的异步缩略图加载，避免将资产读取和 object URL 生命周期塞入 `ProjectDetailPage`。

输入至少包含：

- `workspaceId`
- `projectId`
- `documentId`
- 现有 `ArtworkPreview` 回退所需的 artwork 类型
- 可访问名称

加载流程：

1. 调用 `loadDocumentScene` 读取文档 scene。
2. 优先选择非 placeholder 的 content 图片层。
3. 若没有显式 content 层，再选择非 reference、非 placeholder 的普通图片层。
4. 调用 `readAsset` 读取受管资产。
5. 创建 object URL 并渲染真实图片。
6. 组件卸载、文档切换或资源更新时 revoke 旧 object URL。
7. scene 缺失、无有效图片层、资产读取失败时渲染现有 `ArtworkPreview`。

项目详情卡片仍保持现有尺寸、点击行为和布局，只替换预览内容来源。

## 重新进入画布

`CanvasWorkspace` 已通过 `loadDocumentScene` 在挂载时读取已保存 scene，并通过 `onSceneChange` 回传给 `Workbench`。本次不新建第二套加载机制，而是通过串行保存消除返回前竞态，并补充回归测试，证明重新挂载后 scene 中的 content 图片使用已定稿资产。

## 可访问性与状态

- 右侧工具栏继续使用 `role="toolbar"`。
- 定稿按钮具有明确的中英文 `aria-label`。
- disabled 状态使用原生按钮禁用属性。
- 定稿处理中禁止重复提交。
- 确认弹窗取消时不修改 scene、revision、metadata 或候选状态。
- 失败提示沿用 Workbench 的 notice 机制。

## 测试计划

### Workbench

- 右侧上下文工具栏包含定稿按钮，顶部工具栏不再包含重复入口。
- 未选候选时按钮禁用；选中候选后启用。
- 只读和定稿处理中按钮禁用。
- 定稿只替换正式 content 图片层，不替换 reference 图片层。
- 无 content 图片层时创建覆盖文档尺寸的新图层。
- `saveDocumentScene` 完成前不调用 metadata 回调和 `onBack`。
- scene 保存失败、revision 提交失败、final 设置失败或 metadata 更新失败时不返回并保留候选。
- 成功链路传递正确的 `documentId`、`revisionId` 和 scene。

### Studio

- 收到定稿回调后更新当前文档的 `finalizedRevisionId`。
- 不改变其他文档的 source/finalized 信息。
- `projects` 与 `selected` 同步反映更新后的 metadata。

### ProjectDocumentPreview / ProjectDetailPage

- content 图片层存在时读取并显示受管资产。
- reference 图片层不会成为详情缩略图。
- 缺少 scene、缺少有效图片层或资产读取失败时回退到 `ArtworkPreview`。
- 文档卡片显示更新后的“已定稿”状态。
- object URL 在更新和卸载时被释放。

### 重新进入画布

- 定稿成功后重新挂载 Workbench/CanvasWorkspace，加载 scene 并显示候选资产。
- 初始占位 scene 不覆盖已保存的正式 scene。

## 验收标准

- 画布右侧工具栏底部始终可见定稿按钮。
- 未选候选时不可点击，选中候选后可点击。
- 完成定稿后返回详情页，真实设计稿缩略图可见，文档状态显示“已定稿”。
- 重新进入画布后显示同一张定稿图。
- reference 图层和其他正式图层保持不变。
- 保存失败时用户仍停留在画布，候选没有被清除。
