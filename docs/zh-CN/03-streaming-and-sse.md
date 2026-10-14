# 断线后继续接收结果

**Reader question:** 浏览器断开后，任务如何继续运行？客户端又如何补齐输出？

**Prerequisites:** 理解 [Session 和 Run](02-core-concepts.md)，并已有创建 Run 的产品入口。**Outcome:** 分离执行与连接，保存服务端游标，重连到同一个 run_id。

## 首次连接：先启动，再订阅

`start()` 创建的后台任务不依赖订阅连接。HTTP 层将字符串写入响应，不会驱动第二套模型循环。

以下集成片段应放在经过身份验证的请求处理函数中。产品已经取得 runtime 和 session。路由注册方式取决于你使用的 Web 框架。

```python
from flops_agent import Query

run = runtime.start(session, Query.text("Start the task"))
# Return run.id to the authorized client for subsequent reconnection.
async for frame in runtime.sse_stream(run):
    yield frame
```

SSE 是一种 HTTP 响应格式。产品将响应的 Content-Type 设置为 `text/event-stream`。框架不会注册路由或选择身份验证方案。

## 使用服务端游标重连

客户端保存 run_id 和收到的游标。重连时，产品先验证当前用户是否有权访问该运行，找到其句柄，再传回最后收到的游标：

```python
async def reconnect(runtime, run_id: str, last_cursor: int):
    # The caller must already have checked identity and ownership of this run.
    run = runtime.runs.get(run_id)
    if run is None:
        raise LookupError("This process has no handle for that run")
    async for frame in runtime.sse_stream(run, from_cursor=last_cursor):
        yield frame
```

`run.subscribe(from_cursor=0)` 先重放日志，再跟随实时输出。每个 Delivery 包含 event、cursor 和 replayed。直接消费 Python 对象时，可根据 TextDelta 或 ToolResult 等类型处理实时事件。重放内容可能已经是序列化的日志数据；不要假定它与实时事件是同类 Python 对象。

## 检查结果

启动一个持续产生输出的运行。保存服务端游标，关闭订阅，确认任务仍在继续。再次订阅同一个 Run，验证重放先于新输出。不要通过统计帧数计算游标：日志可能合并，因此实时帧数不一定等于日志位置。

默认 WireCodec 只向实时 JSON 帧注入 cursor；重放帧和已序列化的字符串会原样通过。如果客户端在关闭前只收到重放内容，产品协议必须定义它如何获知当前位置。不要猜测最后一个游标。参见 [API 契约](api_surface.md)。

## 边界

本地 RunPool 不是历史运行查询服务。已结束的运行会从池中移除，其他进程也无法查到本进程的句柄。上述函数只适用于本地句柄仍然存在的运行。跨进程或运行结束后的重放需要持久化日志和产品路由。目前没有按 run_id 还原只读 Run 的公开门面接口。

关闭连接不等于按下停止按钮。停止需要显式操作，参见[停止与追加输入](05-cancellation-and-suspension.md)。自定义通知使用 ProductEvent。需要修改传输格式时，扩展 WireCodec，不要让客户端猜测内部状态。

## 下一步

下一步，阅读[停止任务并接收用户输入](05-cancellation-and-suspension.md)。订阅与执行彼此独立，接下来为仍在运行的任务接入停止、交互回答和追加输入。

如果你想直接去看：

- [保存并继续会话](04-sessions-and-persistence.md) —— 决定如何保存对话与运行日志。

## 代码依据

- `src/flops_agent/engine/runtime.py:336`、`:1041`：SSE 桥接与独立执行；`:1113` 附近的 finally 块会从池中移除已结束的运行。
- `src/flops_agent/engine/execution.py:603`：先重放，再订阅实时输出。
- `src/flops_agent/wire.py:170`：实时帧与重放帧的游标差异。
