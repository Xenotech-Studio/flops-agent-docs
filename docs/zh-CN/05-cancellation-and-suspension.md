# 停止任务并接收用户输入

**Reader question:** 用户停止任务、回答确认卡片或追加消息时，应该发生什么？

**Prerequisites:** 理解[执行与订阅的分离](03-streaming-and-sse.md)。**Outcome:** 为每种意图选择正确入口，无需一律取消后重启。

## 先选择操作

| 用户意图 | 操作 | 结果 |
|---|---|---|
| 停止当前任务 | 请求停止 | Runner 在检查边界结束，状态为 stopped |
| 决定工具所需的事项 | 挂起，然后提交回答 | 旧 Run 挂起；后续请求推进对话 |
| 在任务中补充信息 | 放入 Inbox 队列 | 在规定的循环边界读取，不抢占当前工具 |

## 动手试试：停止运行

持有句柄时，使用 `await run.stop()`。要从产品侧按会话停止，使用：

```python
stopped_run_id = await runtime.stop_session(
    session_id, owner_id=authenticated_owner_id,
)
```

请求处理函数提供 runtime、session_id 和已验证身份的 owner id。返回 id 表示找到了停止目标；**不代表远程工具已经停止**。持有本地句柄时，可用 `await run.wait()` 观察最终状态。Runner 在模型数据块和工具边界处理停止请求。远程执行端必须将这一意图转发到自己的任务系统。

## 动手试试：回答挂起的交互

工具可以返回 InteractionRequest，向用户提问。框架记录待处理交互，发出交互和挂起事件，并结束此次运行。产品负责显示请求。用户回答后，重新加载同一个 Session，用回答启动一次运行：

```python
from flops_agent import Query

session = await runtime.load_session(session_id, owner_id=authenticated_owner_id)
if session.pending_interaction is None:
    raise ValueError("This conversation has no pending interaction")
run = runtime.start(session, Query.answer({"approved": True}))
async for delivery in run.subscribe():
    print(delivery.event)
```

回答的结构由工具请求和产品协议定义；approved 只是示例字段。验证回答属于当前待处理交互，拒绝过期卡片或未授权提交。`Runner.after_execute()` 返回的 Interaction 是独立的策略扩展点，不要与工具的 InteractionRequest 混淆。

## 动手试试：追加排队输入

```python
runtime.deliver(
    session_id,
    {"role": "user", "content": "Please also consider offline use."},
    when="step",
)
```

`when="step"` 在最近的循环边界读取。`when="turn"` 等待当前工具循环结束，再作为新一轮继续。没有活跃运行时，消息留在 Inbox 中，直到后续运行到达输入边界。调用 deliver 本身不会启动任务。

Runtime 的参数是 **when**。底层 Inbox 的 push 参数名为 deliver。默认 MemoryInbox 只存在于当前进程。自定义 Inbox 没有 push 方法时，通过它自己的产品 API 入队。

## 检查结果

分别验证各条路径：断线不会停止执行；显式停止最终进入 stopped；重新加载会话后可以回答挂起的交互；排队输入出现在后续模型请求中。等待回答与重启后恢复是不同机制。不要用恢复机制处理普通确认卡片。

## 下一步

交互状态必须跨请求保留。继续阅读[保存会话](04-sessions-and-persistence.md)。

## 代码依据

- `src/flops_agent/engine/runtime.py:317`、`:876`：停止操作与 when 参数。
- `src/flops_agent/engine/runner.py:789`、`:844`：持久化挂起标记和应用回答。
- `src/flops_agent/engine/execution.py:693`：停止请求的语义。
