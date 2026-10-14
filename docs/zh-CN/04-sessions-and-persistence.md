# 保存并继续会话

**Reader question:** 下一次请求如何接续历史？为什么还需要独立的运行日志？

**Prerequisites:** 完成[两轮对话示例](02-core-concepts.md)。**Outcome:** 区分两类存储，继续同一段对话，判断何时需要持久化后端。

## 确定存储对象

| 数据 | 存储边界 | 用途 |
|---|---|---|
| 对话元数据与消息历史 | Database | 让下一轮模型看到此前对话 |
| 单次运行的状态与输出日志 | RunStore | 订阅重放、停止意图和恢复依据 |
| 从对话中提取的长期知识 | Memory | 由产品定义的召回与维护 |

保存 Session 不代表浏览器能够重放 Run 的每一帧流输出。保存运行日志也不代表拥有下一次模型请求所需的完整对话历史。

## 动手试试：继续同一段对话

[基础示例](02-core-concepts.md)使用 InMemoryDatabase，已演示在同一进程中重新加载同一个 id。集成产品时保留这一流程：

```python
from flops_agent import Runtime, Query

runtime = Runtime(llm=client, database=database, run_store=run_store)
# Your product assembles client, database, and run_store at startup.
session = await runtime.load_session(session_id, owner_id=authenticated_owner_id)
run = runtime.start(session, Query.text("Continue the previous question."))
async for delivery in run.subscribe():
    consume(delivery)  # Your response or rendering logic
```

默认 Runner 在执行边界持久化历史；普通请求不需要再保存整个 Session。产品代码在框架之外编辑对话时，调用 `await runtime.save_session(session)`。若修改历史中间的内容，应使用精确替换接口，不要指望整段会话保存能自动发现任意改动。

## 用持久化存储替换内存存储

InMemoryDatabase 和 InMemoryRunStore 是参考实现，进程退出后数据就会消失。要在重启后保留数据，需实现并注入自己的后端。

Database 要求提供细粒度操作：元数据读取、消息范围读取、计数、追加、截断、替换、元数据补丁和会话创建。RunStore 管理创建、日志追加、范围重放和终态。跨进程停止与恢复还需要额外能力。具体方法参见 [API 契约](api_surface.md)。

两个协议都使用同步方法。框架的异步路径将存储调用交给工作线程，因此后端必须支持这些调用。框架的会话级锁不是跨进程数据库事务；后端仍须提供适当的并发控制和一致性。owner_id 是数据寻址参数，不能代替身份验证。

## 编辑与长对话

Session 支持按消息 id 截断，以及按用户轮次回退。编辑可能丢弃后续用户输入时，需要显式传入 `consent=True`，否则可能抛出 TruncationNeedsConsent。先确认用户意图，再编辑并持久化历史，在适当时使用 `runtime.start(session)` 继续。

编辑历史会改变事实记录。临时缩短模型输入是另一种操作，参见[控制长对话中的输入](context-window.md)。

## 检查结果

使用相同的 owner_id 和 session_id 发送两轮输入，重新加载并检查消息。切换 owner_id，验证后端按预期隔离数据。接入真实持久化存储后，重启进程并检查历史仍然存在。内存后端不应通过最后这项测试。

## 下一步

下一步，阅读[进程重启后恢复任务](06-recovery.md)，验证持久化记录如何支持中断后的恢复。不要假定所有工具都能自动恢复执行。

## 代码依据

- `src/flops_agent/seams/database.py:23`：细粒度 Database 协议。
- `src/flops_agent/engine/runtime.py:961`、`:1009`：异步加载与保存。
- `src/flops_agent/seams/run_store.py:25`：运行日志存储协议。
- `src/flops_agent/entities/session.py:138`：历史截断的同意检查。
