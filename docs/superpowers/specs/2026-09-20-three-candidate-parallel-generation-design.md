# 三候选并行设计生成方案

## 目标

一次点击“生成设计稿”同时生成三张候选稿，并在画布中以三个稳定槽位逐张展示结果。实现必须兼容不支持 `n > 1` 的 Responses 图像接口，因此每张候选使用一个独立的 `count: 1` 请求。部分请求失败时保留成功结果，并允许只重试失败候选。

## 现状与约束

- 当前设计生成任务只调用一次 `generateImage` 或 `editImage`，生成参数固定为 `count: 1`。
- OpenAI-compatible adapter 的 Responses 图像传输明确拒绝 `count > 1`，会抛出 `RESPONSES_IMAGE_COUNT_UNSUPPORTED`。
- 现有候选结果保存在单个 `result.candidate` 中，候选画布按一条生成任务渲染一个骨架或一个候选。
- 设计生成上下文已经固化项目 brief、对话分析、附件、当前画布图像、品牌、设计师快照和 `baseRevisionId`。
- 临时候选不写入正式 scene，用户确认定稿后才提交 revision。

## 选定方案

采用“一个批次任务、三个并行槽位”的方案。

- 用户只执行一次生成操作，任务面板只显示一条设计生成批次。
- 批次内部同时启动三个独立请求，每个请求固定 `count: 1`。
- 三个请求共享同一份不可变上下文和图片，仅追加不同的创意方向。
- 使用 `Promise.allSettled` 汇总批次，但每个槽位完成后立即持久化并更新 UI，不等待其他请求。
- 至少成功一张时批次可完成并进入候选审阅；三张全部失败时才将批次标记为失败。

不采用供应商单请求多图方案，因为 Responses 传输不支持 `n > 1`。不采用三个面向用户的独立主任务，因为会使任务面板、统一取消和批次进度变得割裂。不采用串行生成，因为总耗时明显增加。

## 创意方向

三次请求共享相同的基础生成提示，并按固定顺序追加以下方向：

1. `primary`：主方案。优先准确落实用户需求、内容层级、品牌约束和设计师风格。
2. `composition`：构图探索。保持内容、品牌和风格约束，明显改变构图、视觉动线和信息层级。
3. `expressive`：视觉突破。保持核心需求和可用性，尝试更大胆但仍可交付的视觉表达。

方向提示只能增加差异化要求，不能覆盖用户原始消息、对话设计简报、项目 brief、品牌约束、设计师 Style DNA、否定规则或文档尺寸。

## 数据模型

新增槽位类型：

```ts
export type DesignGenerationSlotId = 'primary' | 'composition' | 'expressive';

export type DesignGenerationSlot = {
  id: DesignGenerationSlotId;
  direction: string;
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  attempt: number;
  assetId?: string;
  candidateId?: string;
  errorCode?: string;
  providerFailure?: TaskProviderFailure;
  cost?: number | null;
};
```

`TaskRecord` 增加可选的 `generationSlots`。任务结果增加可选的 `candidates`：

```ts
type TaskRecord = {
  generationSlots?: DesignGenerationSlot[];
  result?: {
    candidate?: TaskCandidate;
    candidates?: TaskCandidate[];
    assetIds?: string[];
    imageCount?: number;
    cost?: number | null;
  };
};
```

- `result.candidate` 保留用于读取旧的单候选任务。
- 新批次写入 `result.candidates`，不需要同时复制到 `result.candidate`。
- 候选 ID 使用批次任务 ID 和槽位 ID 构造，确保槽位重试后身份稳定。
- `assetIds` 与 `candidates` 只包含成功结果，并按三个槽位的固定顺序排列，不按网络响应顺序排列。
- `imageCount` 是实际成功数量。
- 可获得的槽位成本相加为批次成本；任一成功槽位没有成本数据时，批次成本保持 `null`，避免伪造总成本。

## 执行流程

### 提交

1. 验证对话任务是当前线程最新的已完成分析任务。
2. 固化和保存与当前实现相同的设计生成上下文、上下文资产、设计师版本和 `baseRevisionId`。
3. 创建一条 `design-generation` 任务，并初始化三个 `queued` 槽位。
4. 任务返回渲染层后，候选画布立即显示三个与文档比例一致的骨架。

### 并行请求

1. 主进程只解析一次生成上下文并读取一次共享的附件、参考图和当前画布图像。
2. 为每个槽位建立独立 `AbortController`。
3. 三个槽位在同一事件周期进入 `running`，并分别调用 `generateImage` 或 `editImage`。
4. 所有请求显式使用 `count: 1`；图片编辑接口不添加多图数量字段。
5. 每个请求使用相同的模型连接、文档尺寸和基础提示，只追加对应槽位的方向提示。

### 单槽位完成

- 返回空图片时该槽位失败为 `IMAGE_RESULT_EMPTY`。
- 返回图片时立即保存为项目受管资产，创建对应 `TaskCandidate`，并将槽位更新为 `completed`。
- TaskRuntime 对槽位更新进行持久化，渲染层通过现有任务轮询获取增量结果。
- 候选画布用真实图片替换该槽位骨架，其他运行槽位保持骨架。

### 批次收敛

- 三个槽位都进入终态后汇总任务结果。
- 一张或以上成功：任务状态为 `completed`。
- 三张全部失败：任务状态为 `failed`。
- 用户取消且没有成功结果：任务状态为 `cancelled`。
- 用户取消但已有成功结果：保留成功候选，任务进入可审阅的 `completed` 状态，其余槽位标记为 `cancelled`。

## 重试与取消

新增槽位级重试接口：

```ts
retryDesignGenerationSlot(input: {
  workspaceId: string;
  taskId: string;
  slotId: DesignGenerationSlotId;
}): Promise<TaskRecord | null>;
```

- 只允许重试 `failed` 或 `cancelled` 槽位。
- 主进程验证任务属于当前 workspace、project 和 document，并确认保存的上下文资产仍存在。
- 重试必须继续使用原任务的不可变上下文、原 `baseRevisionId` 和原槽位方向，不读取后来变化的项目、品牌或设计师状态。
- 重试将槽位状态恢复为 `queued`，增加 `attempt`，清除该槽位的错误，再执行一次 `count: 1` 请求。
- 已成功槽位及其资产不重新生成。
- 取消批次会中止所有仍在运行的槽位，不删除已经持久化的成功候选。
- 应用重启时，原本 `queued` 或 `running` 的槽位恢复为 `failed`，错误为现有的未知结果恢复错误，并允许单独重试。

## 桌面接口与信任边界

现有 `submitDesignGeneration` 输入保持不变，不允许渲染层传递候选数量、方向提示、完整历史或风格对象：

```ts
type DesignGenerationInput = {
  workspaceId: string;
  projectId: string;
  documentId: string;
  conversationTaskId: string;
  baseRevisionId?: string | null;
  connectionId: string;
};
```

- 候选数量固定为三张，由可信主进程定义。
- 三个创意方向由任务服务定义，渲染层不能覆盖。
- Provider adapter 继续拒绝 Responses 的 `count > 1`；批次并发只存在于任务服务层。
- 普通图片生成、图像工具编辑和设计师头像生成不受本次改动影响。

## UI 与候选画布

- 点击一次“生成设计稿”后立即添加三个固定顺序的骨架卡片。
- 最新批次作为整体滚动到画布水平和垂直中心。
- 单张完成只替换自身骨架，不改变其他卡片的位置，也不反复移动画布。
- 失败槽位保留原尺寸卡片，显示失败状态和“重新生成”按钮。
- 候选完成顺序不会改变 `primary / composition / expressive` 的排列顺序。
- 批次仍有运行槽位时，分析面板的生成按钮禁用，防止重复提交批次。
- 任务面板显示一个批次摘要，例如“候选生成 2/3”，并可展开查看各槽位状态。
- 点击成功候选仍会选中定稿候选，并把对应受管资产引用加入下一轮对话。
- 定稿仍只提交用户选择的一张；确认后清除同线程的其他临时候选。

## 兼容性

- 缺少 `generationSlots` 和 `result.candidates` 的旧任务按原逻辑读取。
- 候选画布将旧 `result.candidate` 归一化为单元素候选列表。
- 选择、加入对话、继续编辑和定稿逻辑同时支持旧单候选与新候选数组。
- 任务存储校验接受新增字段，但仍拒绝未知字段、无效槽位 ID、重复槽位和跨项目资产。
- 任务重试现有行为保持不变；只有设计生成批次增加槽位级重试。

## 错误与限流

- 单个请求的 HTTP、限流、无效响应和取消元数据保存到对应槽位，不覆盖其他槽位。
- 并行度固定为三，不引入可配置并发或动态候选数量。
- 供应商对部分请求限流时，成功候选继续显示，受限槽位可由用户单独重试。
- 本轮不自动指数退避或静默重试，以避免额外计费和不可见请求；重试由用户明确触发。
- 不将供应商原始错误消息、请求正文、密钥或外部图片 URL写入任务文件。

## 测试与验收

### 单元测试

- 提交设计生成会创建一个任务和三个固定顺序槽位。
- 三个请求都使用 `count: 1`，从不发送 `count: 2` 或 `count: 3`。
- 三个请求在任意一个完成前均已启动，证明实际并行。
- 三个请求共享相同上下文图片、风格快照、品牌约束、尺寸和 `baseRevisionId`。
- 三个请求分别带有主方案、构图探索和视觉突破方向。
- 有当前画布图像时并行调用三次 `editImage`，否则并行调用三次 `generateImage`。
- 两张成功、一张失败时任务完成且只保存两张候选。
- 三张全部失败时任务失败且不产生候选。
- 失败槽位重试不会调用成功槽位。
- 取消会中止所有运行控制器并保留已成功候选。
- 响应乱序时保存的候选仍按固定槽位顺序排列。
- 重启恢复会把未完成槽位变为可重试失败状态。
- 旧单候选任务仍能从任务存储加载。

### UI 测试

- 点击生成后立即显示三个同尺寸骨架。
- 每个完成结果独立替换对应骨架。
- 失败槽位显示重试入口，成功卡片不消失。
- 单槽位重试只将该卡恢复为骨架。
- 候选到达顺序不同不会改变布局顺序。
- 最新批次整体居中一次，单张完成不重复滚动画布。
- 生成按钮在批次运行期间禁用。
- 选择、加入下一轮对话和定稿支持候选数组。

### 集成与 E2E

- 使用 Responses 图像传输时完成三张候选，不触发 `RESPONSES_IMAGE_COUNT_UNSUPPORTED`。
- 工作区重启后成功候选仍存在，未完成槽位可以重试。
- 设计师或 revision 在生成期间变化时，三个槽位仍使用提交时快照。
- 部分失败后可以选择任一成功候选定稿。
- 定稿只提交所选资产并清除其他临时候选。

## 边界

- 候选数量固定为三，不提供用户数量选择器。
- 本轮不支持供应商原生多图协议探测或按供应商动态选择 `n=3`。
- 本轮不自动重试限流或失败请求。
- 三张候选仍是栅格资产，不拆分文字或矢量图层。
- 不改变对话分析、正式 revision 提交和最终定稿的核心边界。
