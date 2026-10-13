# 统一运行时与存储术语

**Reader question:** 对话、代码和文档中的同一个词，含义是否相同？

**Prerequisites:** 无。**Outcome:** 区分任务、连接和持久化对象，使用统一术语搜索接口与日志。

## 一次任务

| 术语 | 含义 | 不要混淆为 |
|---|---|---|
| Runtime | 组装模型、工具和存储，管理运行 | HTTP 服务本身 |
| Session | 一段对话的消息历史与元数据 | 单个 Run |
| Query | 新输入、交互回答或系统事件 | 每次继续都必须提供的对象 |
| Run | 一次执行的标识、状态和输出日志 | 浏览器连接 |
| Runner | 推进执行的步骤与策略 | Agent 身份配置 |
| Agent | 身份、指令、模型偏好和记忆配置 | 运行池或基础设施 |

教程：[理解任务如何运行](02-core-concepts.md)。代码：`src/flops_agent/engine/runtime.py:105`、`src/flops_agent/entities/query.py:37`、`src/flops_agent/entities/agent.py:39`。

## 输出与控制

| 术语 | 含义 |
|---|---|
| 事件（event） | 文本、工具活动或执行生命周期的变化 |
| Delivery | 一次投递，包含 event、cursor 和 replayed |
| 游标（cursor） | 服务端日志位置，不是事件计数或授权凭据 |
| SSE | 用于编码事件的 HTTP 流式文本格式 |
| Coalescer | 将实时事件转换成可重放日志片段的边界 |
| stopped | 运行响应停止请求而结束 |
| suspended | 运行挂起，等待后续用户交互推进对话 |
| 恢复（recovery） | 根据持久化依据重建中断的执行，不是普通浏览器重连 |

教程：[流式订阅](03-streaming-and-sse.md)、[停止与回答](05-cancellation-and-suspension.md)、[恢复](06-recovery.md)。代码：`src/flops_agent/engine/execution.py:62`、`:78`、`:136`。

## 数据与扩展

| 术语 | 含义 |
|---|---|
| Database | Session 元数据与消息的细粒度存储协议 |
| RunStore | 运行元数据、日志和可选恢复依据的存储协议 |
| Inbox | 等待 turn 或 step 边界的追加输入 |
| Memory | 由产品维护、供模型召回的长期知识 |
| 投影（projection） | 单次模型请求的临时消息视图，不改变事实历史 |
| 压缩（compaction） | 使用摘要等技术控制上下文；需要产品集成和存储 |
| ToolExecutor | 执行业务工具（包括远程任务）的边界 |
| 调度记录（dispatch record） | 已调度任务的关联依据，不会自动保证业务幂等 |

教程：[会话存储](04-sessions-and-persistence.md)、[模型输入](context-window.md)、[扩展点](customize-runner.md)。代码：`src/flops_agent/seams/database.py:23`、`src/flops_agent/seams/run_store.py:25`、`src/flops_agent/tools/registry.py:49`。

## 下一步

明确术语后，查阅 [API 契约](api_surface.md)。需要入门路径时，返回[学习](README.md)。
