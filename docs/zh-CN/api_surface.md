# API 契约

**Reader question:** 应该调用哪个入口？它有哪些参数、返回值和职责？

**Prerequisites:** 建议先理解 [Session、Query 和 Run](02-core-concepts.md)，本页也支持直接查阅。**Outcome:** 选择合适的公开入口，根据代码引用核实精确签名。

这是按任务组织的 v0.2.0 基础集成契约索引，不承诺每个内部符号都稳定。优先从 flops_agent 公开导入；完整导出范围以安装版本的 __all__ 为准。

## Runtime 与会话操作

| 入口 | 返回值与语义 | 代码位置 |
|---|---|---|
| Runtime(llm=…, database=…, run_store=…, tools=…) | 组装各个边界；可注入 runner、executor、inbox、wire 和 agent | engine/runtime.py:147 |
| await load_session(id, owner_id=…, keys=…) | 返回 Session；产品负责访问授权，keys 透传到存储 | engine/runtime.py:961 |
| start(session, query=None, run_id=None, keys=None, context=None) | 立即返回 Run 并在后台执行；session/query 之后的参数只能按关键字传入 | engine/runtime.py:1041 |
| ask(text, session=None) | 异步直接产出事件，而非 Delivery | engine/runtime.py:1218 |
| await save_session(session, keys=…) | 持久化框架之外的编辑 | engine/runtime.py:1009 |
| await stop_session(id, owner_id=…) | 返回目标 run_id 或 None；请求停止，但不保证工具已经退出 | engine/runtime.py:317 |
| deliver(id, message, when="turn") | 同步入队；when 为 turn 或 step；不创建 Run | engine/runtime.py:876 |
| await shutdown() | 中断活跃运行，返回已处理数量 | engine/runtime.py:1258 |
| await recover(resume, on_gave_up=…) | 返回异步调度的恢复任务数，不是成功数量 | engine/runtime.py:1154 |

表中路径相对于 `src/flops_agent/`。context 由产品解释。省略 Query 表示从当前 Session 状态继续；没有通用的 regenerate=True 参数。要重新生成，先根据用户意图编辑并持久化历史。

Query.text 构造普通输入；Query.answer 构造交互回答；Query.event 构造外部系统输入。Session 截断或回退可能需要显式同意，参见[会话存储](04-sessions-and-persistence.md)。

## 订阅、事件与传输格式

| 入口或值 | 契约 |
|---|---|
| Run.id / status / error | 执行标识、状态和失败异常；状态包括 running、done、stopped、failed、suspended |
| run.subscribe(from_cursor=0) | 异步产出 Delivery，先重放日志，再投递实时输出 |
| Delivery.event / cursor / replayed | 内容、服务端日志位置和重放标记；不要从客户端帧数推算 cursor |
| await run.wait() | 等待终止并返回 RunStatus |
| await run.stop() / run.on_stop(callback) | 请求停止 / 注册执行端取消回调 |
| runtime.sse_stream(run, from_cursor=0) | 异步产出 SSE 字符串；产品实现 HTTP 和授权 |
| WireCodec.event_to_wire / to_sse / delivery_to_sse | 事件转换、SSE 编码和 Delivery 编码的扩展点 |

常见事件包括 TextDelta、ReasoningDelta、ToolCallStarted、ToolResult、LoopFinished、Cancelled、Suspended 和 Error。自定义产品通知使用 ProductEvent。标准传输类型参见 WIRE_TYPES。

默认 WireCodec 只向实时 JSON 帧添加 cursor；重放内容和已序列化字符串原样通过。默认 PassthroughCoalescer 不合并事件。自定义 Coalescer 的 feed/flush 可改变日志粒度，因此重放事件可能是序列化日志数据，而非原始事件实例。

代码：`src/flops_agent/engine/execution.py:62`、`:78`、`:603`、`:658`；`src/flops_agent/wire.py:71`、`:170`。操作步骤参见[流式订阅](03-streaming-and-sse.md)。

## 存储与扩展协议

### Database：对话事实

同步协议包括 load_meta、load_messages、count_messages、append_messages、truncate_messages、replace_message、patch_meta 和 create_session。通过 session_id 和 owner_id 寻址数据；keys 是由存储定义的参数。框架异步路径将 I/O 交给工作线程，后端必须支持这种调用方式。

代码：`src/flops_agent/seams/database.py:23`。InMemoryDatabase 只存储进程内数据。追加、截断和尾部重写不能替代对历史中间任意消息的精确编辑。

### RunStore：执行依据

基础日志操作包括 create_run、append_chunks、buffer_range、mark_finished 和元数据读取。对于已有 id，create_run 仅在不存在时创建：不得清空旧日志、停止意图或恢复依据，也不得将终态重置为 running。

额外能力包括最新运行查询与停止意图、活跃记录枚举与 mark_resuming，以及调度记录。恢复预算耗尽时，mark_resuming 返回 0。持久化后端必须保证日志顺序和状态一致性；RunStore 不是内置的分布式调度器。

代码：`src/flops_agent/seams/run_store.py:25`；恢复编排：`src/flops_agent/engine/runtime.py:1154`。

### 模型、执行端、收件箱与记忆

LLMStreamClient 的 `async acompletion(**request)` 返回异步数据块流。ToolExecutor 的 `async execute(call, ctx)` 执行业务工具。Inbox 在 turn/step 边界提供排队输入；Runtime.deliver 只适用于具有 push 的实现。Memory 的 recall 返回请求文本，remember 维护产品知识存储。

代码：`src/flops_agent/seams/llm_client.py:18`、`src/flops_agent/seams/executor.py:1`、`src/flops_agent/seams/inbox.py:1`、`src/flops_agent/entities/agent.py:26`。

## 工具与策略

tools 接受函数、OpenAI 风格 schema，或 `{"schema": schema, "fn": handler}`。最小函数签名推断将参数声明为字符串；需要精确类型时，提供显式 schema。ToolRegistry 管理包、可见性和路由。ToolContext 携带 runtime、session、run_id、tool_call_id 和远程调度关联信息。

Runner.before_tool 返回 ToolGate：deny 跳过执行并向模型返回结果；proceed 继续执行。plan_step 选择模型请求、直接调度或结束；after_execute 控制工具执行后的交互。Agent 持有身份、指令、模型偏好和可选 Memory，不承载执行基础设施。

代码：`src/flops_agent/tools/schema.py:17`、`:42`；`src/flops_agent/tools/registry.py:49`、`:164`；`src/flops_agent/engine/runner.py:638`、`:1383`。教程：[工具](07-extending.md)与[策略扩展](customize-runner.md)。

## 密码学与授权边界

flops_agent.crypto 提供通用密码学原语。使用产品已获取的 PEM 字节构造 TransportKey，并显式传入；field_crypto 作用于产品选定的字段。框架不会发现凭据文件，也不替代身份验证、授权、密钥获取或保留策略。

代码：`src/flops_agent/crypto/transport.py:23`、`:57`；`src/flops_agent/crypto/field_crypto.py:52`。

## 版本与下一步

下一步，阅读[错误与限制](errors-and-limits.md)。掌握接口契约后，对照常见故障检查调用条件与产品职责。

如果你想直接去看：

- [已发布变更](CHANGELOG.md) —— 确认升级范围；不要从当前分支的新方法推断安装包能力。
- [学习](README.md) —— 获取逐步指导。
