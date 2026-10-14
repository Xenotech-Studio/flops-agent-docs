# 什么是 Flops Agent 框架？

Flops Agent 是一个用 Python 编写、可嵌入业务服务的 agent 运行时框架。它提供模型调用、工具执行与结果回灌的基本循环，并组织会话、运行状态和流式输出。你可以接入自己的模型客户端和业务工具，用默认循环开始，再通过 Runner、Memory 和执行端接口补充产品逻辑。

## 为什么用它

- **从成型的循环开始。** 复用模型调用、工具调度和结果回灌，把接入工作集中在业务工具与产品接口上。
- **按需扩展产品逻辑。** 在既有循环内，通过 Runner 的扩展点调整模型输入、工具调用前的检查和交互方式。
- **面向服务集成。** 运行与客户端订阅分离，便于将 agent 放进后端服务，并通过流式接口向客户端交付结果。
- **连接业务所在的资源。** 工具可以在服务端执行，也可以通过你接入的远程执行端访问用户设备或共享资源。

## 它能做什么

- **调用业务工具。** 将 Python 函数或带处理逻辑的工具描述接入 Runtime，执行结果会写入会话，供下一次模型调用使用。
- **接入记忆与会话存储。** Agent 通过 Memory 接口读取并更新记忆，Session 通过 Database 接口保存会话；记忆检索逻辑与持久化后端由你提供。
- **流式输出与断线重连。** 运行保留事件和服务端游标，客户端可通过产品提供的订阅接口重连并重放输出。
- **停止、等待与恢复。** 框架支持请求停止、等待用户输入，以及接入持久化存储和恢复回调后的重启恢复。

## 从这里开始

先运行[五分钟运行一个任务](01-quick-start.md)中的离线示例，无需 API key 即可观察工具调用和记忆输出。随后阅读[理解任务如何运行](02-core-concepts.md)，了解 Runtime、Session、Query 和运行之间的关系，再接入一个自己的业务工具。需要查接口时，前往[参考](reference.md)。

## 边界与限制

当前 v0.2.0 处于公开测试阶段。离线示例可用于体验循环；接入真实业务仍需提供模型客户端、HTTP 接口、持久化后端和授权逻辑，并验证工具参数、幂等性及恢复路径。进程重启后的恢复依赖持久化的会话与运行记录，以及产品重建执行上下文；默认内存存储不具备这一能力。

如果你要集中存储企业数据，或让云端 agent 在员工电脑、共享设备上调用工具，可以基于存储接口和远程执行协议集成。框架提供加密原语，但数据存放位置、密钥管理、设备接入和访问权限由产品决定；员工隐私保护需要在产品层另行设计与验证。

## 继续阅读

下一步，阅读[构建第一个应用](01-quick-start.md)。用离线示例跑通一次模型与工具的交互，把框架能力对应到可运行的代码。

如果你想直接去看：

- [接入自己的模型](connect-model.md) —— 替换示例中的模型客户端与模型配置。
- [断线后继续接收结果](03-streaming-and-sse.md) —— 接入客户端订阅与重连。
- [停止任务并接收用户输入](05-cancellation-and-suspension.md) —— 处理停止、挂起与追加输入。
- [保存并继续会话](04-sessions-and-persistence.md) —— 接入会话与运行记录的持久化。
- [进程重启后恢复任务](06-recovery.md) —— 补齐恢复前提与验证步骤。
- [控制长对话中的模型输入](context-window.md) —— 配置历史投影与摘要。
- [为智能体添加工具](07-extending.md) —— 注册业务函数并验证调用结果。
- [在合适的扩展点实现产品策略](customize-runner.md) —— 选择工具门控等策略入口。
- [将示例集成到产品](08-worked-example.md) —— 补齐请求路径并检查集成结果。

### 细节：职责划分

| 你的需求 | 框架提供 | 你需要提供 |
|---|---|---|
| 完成一次模型与工具的交互 | Runtime、Runner 和工具调度 | 模型客户端和工具业务逻辑 |
| 向浏览器增量投递结果 | 事件、订阅、SSE 编码和重放游标 | HTTP 路由、身份验证和客户端渲染 |
| 在下次请求中继续对话 | Session 和 Database 协议 | 持久化后端和用户隔离策略 |
| 接入长期记忆 | Memory 调用时机与接口 | 检索逻辑和记忆存储 |
| 调用远程设备上的工具 | 执行端路由与消息协议 | 设备连接、工具实现和访问授权 |
| 停止、等待回答或在重启后恢复 | Run 状态、交互和恢复编排 | 产品入口、恢复上下文和工具幂等性 |

## 代码依据

以下路径均相对于 flops-agent 源仓。

- `src/flops_agent/__init__.py:1`、`pyproject.toml:17`：服务端 agent 内核与 Python 版本要求。
- `src/flops_agent/engine/runner.py:268`、`:315`、`:523`：agent 循环、模型调用、工具执行与结果回灌。
- `src/flops_agent/engine/runtime.py:108`、`src/flops_agent/tools/registry.py:195`：模型、Python 工具与执行端的接入。
- `src/flops_agent/engine/runner.py:1040`、`:1383`：模型输入投影与工具调用前的策略扩展点。
- `src/flops_agent/entities/agent.py:26`、`:62`、`:72`：Memory 协议、记忆读取及回合结束后的更新；存储与检索由产品实现。
- `src/flops_agent/seams/database.py:1`：产品提供会话持久化后端，决定存储与加解密方式。
- `src/flops_agent/engine/runtime.py:1041`、`:336`：独立于订阅的运行入口、SSE 与重放游标。
- `src/flops_agent/engine/execution.py:696`、`src/flops_agent/engine/runner.py:789`、`src/flops_agent/engine/runtime.py:1154`：停止请求、挂起与恢复编排。
- `docs/06-recovery.md:9`：持久化存储、恢复上下文、崩溃处理与工具幂等性要求。
- `src/flops_agent/tools/dispatch.py:35`、`src/flops_agent/tools/registry.py:134`、`src/flops_agent/executor/link.py:1`：服务端与远程执行端路由、产品负责的设备连接及结果回传协议。
- `src/flops_agent/tools/on_executor.py:1`：执行端文件与命令工具的名称和参数约定；实际处理逻辑需由执行端实现。
- `src/flops_agent/crypto/__init__.py:1`、`:14`：加密原语及产品负责的密钥、身份与授权边界。
- `docs/01-quick-start.md:21`、`docs/sample_product/server.py:1`：无需 API key 的离线示例；示例不是完整 HTTP 服务。
- `pyproject.toml:21`、`src/flops_agent/__init__.py:206`、`docs/CHANGELOG.md:23`：Beta 状态与 v0.2.0 版本依据。
