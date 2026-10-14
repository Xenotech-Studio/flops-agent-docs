# 用 Session 和 Run 进行工作调度

启动一个任务、走开、稍后回来收结果，再接着做下一笔工作——这就是把 Run 当作可调度的工作单元。Session 记着这些工作的会话历史；这一页你会亲手体验一次。

## 工作调度的两个概念

把一次工作交给 Runtime 后，你不必一直守着输出。Run 让你掌握这次执行，Session 则把前后几次工作的输入与结果串起来：

| 概念 | 在这次体验中的作用 |
| --- | --- |
| Run | 一次被调度执行的工作，有标识和状态；执行不依赖订阅连接，可以稍后回来读结果。 |
| Session | 工作所在的会话账本，累积用户输入与回复，下一次 Run 可以接着这份历史执行。 |

会话历史和事件回放是两种记录：Session 保存消息历史；Run 的事件日志保存可回放的输出，`Delivery.cursor` 标记读到了哪里。下面两种都读一次。

## 启动一个任务，然后离开

使用 Python 3.10 或更高版本，在新目录里创建环境。安装需要联网；安装完成后，下面的脚本不访问模型服务，也不需要密钥。

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install "flops-agent==0.2.0"
```

新建 `scheduling.py`，按顺序放入本节和下一节的两个 Python 代码块。先定义一个离线 LLM 模块和启动函数。LLM 模块分两次返回文本，让这笔工作有一个短暂的执行过程。

```python
import asyncio
from flops_agent import (
    InMemoryDatabase, InMemoryRunStore, Query, Runtime,
    TextDelta, TextStreamChunk,
)


class PseudoLLMStreamClient:
    async def acompletion(self, **kwargs):
        async def stream():
            for text in ("First part. ", "Second part."):
                await asyncio.sleep(0.05)
                yield TextStreamChunk(text=text)
        return stream()


async def start_work(runtime, session):
    run = runtime.start(session, Query.text("Prepare a short report"), run_id="work-1")
    print(f"Started: {run.id}")
    print("Away: doing other work, no subscription")
    await asyncio.sleep(0.01)
    return run

```

`start()` 立即返回 Run，Runner 在后台推进工作。这里拿到 `run.id` 后就去做别的事，既不订阅，也不等待 Run 完成；`sleep()` 代表另一件会让出事件循环的工作。运行完整脚本时，开头会打印：

```text
Started: work-1
Away: doing other work, no subscription
```

这里的“离开”是离开订阅，服务进程和事件循环仍在运行。`work-1` 是为方便观察而指定的演示标识；实际应用可省略 `run_id`，让 Runtime 生成标识。

## 稍后回来收结果

把第二块追加到同一个 `scheduling.py`。入口保留刚才的 Run 句柄，用 `wait()` 确认执行已到终态，再开始收结果。`wait()` 只是让这次实验的顺序确定下来，不会订阅输出，也不是推动执行的开关。

```python
async def collect(run):
    parts = []
    cursor = 0
    subscription = run.subscribe(from_cursor=0)
    async for delivery in subscription:
        cursor = delivery.cursor
        if isinstance(delivery.event, TextDelta):
            parts.append(delivery.event.text)
            print(f"First read: {delivery.event.text.strip()} (replayed={delivery.replayed})")
            break
    await subscription.aclose()
    print(f"Saved cursor: {cursor}")
    async for delivery in run.subscribe(from_cursor=cursor):
        if isinstance(delivery.event, TextDelta):
            parts.append(delivery.event.text)
            print(f"Resumed: {delivery.event.text} (replayed={delivery.replayed})")
    print(f"Full result: {''.join(parts)}")
    assert ''.join(parts) == "First part. Second part."


async def main():
    runtime = Runtime(
        llm=PseudoLLMStreamClient(), model="offline-demo",
        database=InMemoryDatabase(), run_store=InMemoryRunStore(),
    )
    session = await runtime.load_session("scheduling-demo")
    run = await start_work(runtime, session)
    status = await run.wait()
    print(f"Back: {run.id}, status={status.value}")
    await collect(run)
    history = await runtime.load_session(session.session_id)
    print("Session history:")
    for message in history.messages:
        print(f"  {message['role']}: {message.get('content', '')}")
    assert [m['role'] for m in history.messages] == ['user', 'assistant']
    next_run = runtime.start(history, Query.text("Continue the report"), run_id="work-2")
    await next_run.wait()
    updated = await runtime.load_session(session.session_id)
    print(f"Continued: {next_run.id}, messages={len(updated.messages)}")
    assert len(updated.messages) == 4


asyncio.run(main())

```

运行：

```sh
python scheduling.py
```

在 PyPI `flops-agent==0.2.0` 上，完整真实输出如下：

```text
Started: work-1
Away: doing other work, no subscription
Back: work-1, status=done
First read: First part. (replayed=True)
Saved cursor: 1
Resumed: Second part. (replayed=True)
Full result: First part. Second part.
Session history:
  user: Prepare a short report
  assistant: First part. Second part.
Continued: work-2, messages=4
```

`subscribe(from_cursor=0)` 从头回放。第一次读到文本就离开，并保存该次 `Delivery.cursor`；第二次把这个值原样传回，只读后面的记录。不要自行用已收到的 token 数或事件数推算游标。

`load_session()` 则重新读出会话历史：两段文本已累积成一条完整的 assistant 消息。最后，向同一个 Session 提交新的 Query，得到新的 Run `work-2`；两次工作的问答合计四条消息。离线 LLM 模块固定返回相同文本，这一步验证的是会话累积与再次调度。

本例刻意保留 Run 句柄。`runtime.runs` 是活动 Run 池，完成后会移除条目，所以不能把 `runtime.runs.get(run_id)` 当成已完成工作的历史查询接口。

## 看懂刚才发生了什么

- 你离开时任务没停：`start()` 已经安排 Runner 执行，订阅只是观察输出。
- 回来时已经是 `done`，仍能补齐结果：Run 保存了事件日志；游标让下一次订阅从已读位置继续。
- Session 中留下完整问答：它是几次工作的共同账本，下一次 Run 从这份历史开始。

这里回放的是默认不合并事件的内存日志，所以仍可用 `TextDelta` 读取文本。接入自己的日志合并或序列化方案后，回放数据可能是合并片段或已序列化数据，不能假定它和实时事件逐条对应。

## 更多的调度模式

- 同时启动不同 Session 的多个 Run，让它们并行推进；同一 Session 已有活动 Run 时再次 `start()` 会被拒绝，见[核心概念](02-core-concepts.md)。
- 启动后先做别的，按需查看保留句柄的 `status` / `done`；需要停止工作或等待用户输入时，见[停止任务并接收用户输入](05-cancellation-and-suspension.md)。
- 读到一半再次离开，保存新的 `Delivery.cursor` 后继续；需要把会话和日志保存到进程之外时，见[保存并继续会话](04-sessions-and-persistence.md)。
- 服务重启后恢复工作是另一层能力，需要恢复条件和持久化记录，见[进程重启后恢复任务](06-recovery.md)。

## 接进产品（HTTP + SSE）

产品可以把“启动”和“订阅”做成两个 HTTP 入口：启动入口加载已授权的 Session，调用 `start()`，立即返回 `run.id`；订阅入口校验访问权限后，把对应 Run 的事件流推给浏览器。这样浏览器离开页面不必取消工作。

下面只展示产品侧响应体适配，**不是可独立运行的 Web 服务**，需要你自己的 Web 框架、路由与鉴权：

```python
async def sse_body(runtime, run, from_cursor=0):
    # The caller authorizes access and resolves the Run handle.
    async for frame in runtime.sse_stream(run, from_cursor=from_cursor):
        yield frame
```

将这个异步迭代器交给 Web 框架的流式响应，响应类型设为 `text/event-stream`。浏览器保存服务端给出的游标，断线后把它交回订阅入口；产品解析并校验该值，再传给 `from_cursor`。关闭响应只结束这次订阅，主动停止 Run 要使用独立的停止操作。

0.2.0 的默认 `WireCodec` 只为实时、非预序列化帧注入 JSON `cursor`，回放帧不额外注入游标，也不会自动设置 SSE `id:`。如果产品要求回放途中也能再次断开续读，应自行包装 `run.subscribe()` 的 Delivery，把 `cursor`、`replayed` 和输出数据一起编码，并约定浏览器如何存取；不能仅凭上面的片段宣称已实现完整重连协议。

产品还需决定 Run 句柄的保留时间与按标识查找方式、历史日志读取方式，以及跨进程请求路由。这些不是 HTTP 连接本身提供的能力。

## 边界

- 本例验证同一进程内的启动、离开订阅、回放和会话继续；InMemory 存储不会在进程退出后保留数据，也不是持久化任务队列。
- `wait()` 返回终态，不代表一定成功；产品应检查 `run.status`，失败时查看 `run.error`。本例真实输出中的终态是 `done`。
- 会话历史不等于事件日志；本页只使用两者，不展开存储后端、加密或恢复策略，细节留给 [04：保存并继续会话](04-sessions-and-persistence.md)。

## 下一步

阅读[停止任务并接收用户输入](05-cancellation-and-suspension.md)，继续学习如何控制已经启动的工作，以及让它等待人的决定。

## 代码依据

以下路径与行号来自本例安装的 PyPI `flops-agent==0.2.0` 包，路径相对于 `site-packages/`：

- `flops_agent/engine/runtime.py:1041`：`start()` 立即返回句柄并安排后台执行；同一 Session 的活动 Run 检查、终态后从活动池移除。
- `flops_agent/engine/execution.py:603`：`subscribe()` 先补历史再接实时事件，游标由 Delivery 返回。
- `flops_agent/engine/execution.py:658`：`wait()` 等待终态和收尾；`:355` 起提供状态查询。
- `flops_agent/engine/runtime.py:961` 与 `flops_agent/entities/session.py:88`：加载 Session 与消息历史。
- `flops_agent/engine/execution.py:163`：默认日志不合并事件。
- `flops_agent/engine/runtime.py:336` 与 `flops_agent/wire.py:170`：SSE 适配与游标编码边界。
