# 接入长期记忆

在需要跨会话偏好、长期事实或个性化时，再接入可选的 Memory。先读[保存并继续会话](04-sessions-and-persistence.md)：Database 保存会话历史，RunStore 保存运行记录，Memory 负责产品选择保留和召回的上下文；继续会话不依赖 Memory。

## 两个方法与调用时机

`Memory` 协议只有两个异步方法：`recall(session, *, query=None) -> str` 和 `remember(session) -> None`。`Agent.memory` 默认为 `None`，不接入也能完成模型与工具循环。

默认 Runner 在 `build_request()` 准备模型请求时，经 Agent 等待 `recall`，把返回文本组织进 system 段，再接上投影后的历史消息。它不是独立的用户消息，也不是用于展示给用户的输出。读取在请求路径上需要等待；默认每次构建请求都有读取机会，不能假定每个 Run 只读一次。

主循环结束进入收尾时，默认 `finalize()` 先持久化会话，再在状态为 `DONE` 且存在 Agent 时调用 `schedule_remember()`；存在 Memory 才会创建后台任务，任务内等待 `remember`。主 Run 完成不等待维护结果。调度发生在 `run.finish()` 之前，任务可能与结束流程交错运行；这不保证客户端已收到终帧。

默认 `Agent.recall` 捕获异常、记录日志并返回空串；后台维护任务也捕获异常并记录日志，不把维护失败变成主回复失败。定制 Runner 可以覆写请求准备与收尾，直接调用产品读取函数时不自动继承 Agent 的异常兜底。

## 维护机会不等于每轮写入

以下区分框架默认行为与 Flops 产品实践，后者不是所有应用的必填配置：

| 层次 | 调度或跳过条件 |
| --- | --- |
| 默认 Runner / Agent | 只有 `DONE` 且有 Agent 才安排维护；没有 Memory 不创建任务。失败、停止或挂起不进入这条维护路径。 |
| Flops 产品 Runner | 还要求最终会话和消息数据已落位。 |
| Flops 产品 Memory | 维护开关 `FLOPS_MEMORY_STEWARD` 可关闭；还需可用的 Redis、绑定 agent 和可用的 user/assistant 消息。关闭维护不等于停止读取已有记忆。 |
| Flops 产品提炼策略 | 路由可选择不维护，或只维护部分层级；重复、无增量时可不写入。没有固定“每 N 轮写一次”的协议要求。 |

`query` 是可用参数，不是强制的检索策略。Flops 当前主读取路径接受它，但不使用它做语义检索；读取的是该 agent 的长期与近期记忆。产品的按需检索工具也不等同于协议的自动召回。

## 最小的产品接入示意

下面沿用按 owner 与绑定 agent 隔离的产品约定，显式注入读取和维护函数。它是结构示意，不是可直接运行的完整应用；`read_context` 与 `maintain` 由产品实现，不是框架 API。请求入口必须设置并验证 `bound_agent_id` 及访问权限，这个 meta 字段不是框架必填项。

```python
from copy import deepcopy
from flops_agent import Agent


class ProductMemory:
    def __init__(self, read_context, maintain, *, enabled=True):
        self.read_context = read_context
        self.maintain = maintain
        self.enabled = enabled

    async def recall(self, session, *, query=None):
        if session is None:
            return ""
        agent_id = session.meta.get("bound_agent_id")
        if not agent_id:
            return ""
        # Product function returns system context; query may filter relevance.
        return await self.read_context(session.owner_id, agent_id, query=query)

    async def remember(self, session):
        agent_id = session.meta.get("bound_agent_id")
        if not self.enabled or not agent_id:
            return
        messages = deepcopy([
            m for m in session.messages
            if m.get("role") in ("user", "assistant")
        ])
        if messages:
            # Already in a framework task; the product may skip unchanged data.
            await self.maintain(session.owner_id, agent_id, messages)


# Product supplies read_context / maintain; the entry point validates bound_agent_id.
# agent = Agent(memory=ProductMemory(read_context, maintain))
```

`read_context` 应快速返回准备注入 system 的字符串；存储不可用时如何降级由产品决定。`maintain` 决定提炼、去重、写入与跳过；`enabled=False` 关闭维护但仍可读取。示意没有伪造存储或提炼器，也没有协议之外的完成信号。

这里复制的是函数执行时 Session 中可用的 user/assistant 消息，可能包含更早轮次。`deepcopy` 只是本地快照，不是框架在 Run 结束时冻结的 Session，不能消除后台任务启动前 Session 已变化的窗口。

## 异步与生命周期边界

`maintain` 必须使用真正异步的 I/O，或用 `asyncio.to_thread` 卸载阻塞库调用；只写 `async def` 仍可能阻塞事件循环。后台任务内部正常使用 `await`，主 Run 不等待它来自框架的任务调度。

框架会调用这两个方法。不要在消费 Run 后再手动调用 `remember` 或 `schedule_remember`，否则会重复维护。协议没有 `saved`，也不要求打印维护结果作为本轮成功标志。独立接口测试可以直接等待 `remember`，但那是测试调用，不是生产请求时机。

短脚本的 `asyncio.run` 退出会取消未完成任务，不能承诺退出前记忆已保存。真实更新应放在常驻应用或明确管理维护生命周期的环境；框架这条调度路径不提供持久任务队列、自动重试或退出时排空的保证。

并发隔离、任务可靠交付与失败恢复由产品处理。Flops 用进程内按 owner 与 agent 分组的锁串行维护，并在线程中执行同步模型调用；这不是跨进程锁。维护可能已部分写入，异常不代表事务回滚。

## 框架与产品的分工

框架定义调用签名与默认调用时机；产品决定存哪、怎么提炼、如何加密、怎样控制容量和处理冲突。Flops 的 Redis 存储、分层维护与加密守卫是产品实现，不是 Memory 协议的要求。

Flops 的 `MEMORY.md` 与 `MEMORY_RECENT.md` 是映射到存储字段的逻辑路径，不应当作服务器上的普通 Markdown 文件。主对话默认注入长期与近期内容，按日记忆和会话印象用于后续维护，不直接全部注入。去重是针对部分 system 文本的文本匹配，不是与全部历史的语义去重或事实冲突裁决。

为产品制定策略时，要明确身份隔离、读取延迟、增量判断、并发与退出行为；保存聊天记录和提炼可复用知识是不同职责。完成本章的结构接入后，仍需提供并验证实际的读取、维护与持久化实现。

## 下一步

下一步，阅读[为智能体添加工具](07-extending.md)。了解记忆如何提供上下文后，再接入可执行的业务函数，让智能体能够调用业务能力。

## 代码依据

框架路径相对于 flops-agent 仓库；产品路径相对于 Flops 仓库。本章依据本地源码核查，不代表已验证线上开关、写入率或耗时。

- `src/flops_agent/entities/agent.py`：Memory 协议、默认空配置、读取异常兜底与后台调度。
- `src/flops_agent/engine/runner.py`：请求构建、system 组织、收尾与 Run 完成顺序。
- `backend/agent/conversation_system/flops_memory.py`、`flops_runner.py`：产品读取、维护条件与定制调用路径。
- `backend/agent/memory_system/steward.py`、`steward_tasks.py`：维护阶段、跳过、线程卸载与进程内串行化。
- `backend/agent/identity_system/storage.py`、`backend/agent/llm_system/prompts.py`、`backend/agent/memory_system/tool_guard.py`：逻辑路径、system 文本与产品存储守卫。
