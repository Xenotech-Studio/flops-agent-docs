# 理解任务如何运行

**Reader question:** 哪些对象处理了示例？下一条消息应该发给谁？

**Prerequisites:** 完成[五分钟指南](01-quick-start.md)。**Outcome:** 说明执行时间线，并在同一会话中完成两轮对话。

## 从四个对象开始

| 对象 | 它回答的问题 | 生命周期 |
|---|---|---|
| Runtime | 用哪个模型、哪些工具和哪种存储来完成任务？ | 通常在产品启动时组装 |
| Session | 这段对话到目前为止说了什么？ | 跨越多次运行；可从 Database 加载 |
| Query | 这一轮带来了什么新输入？ | 一次用户输入、回答或外部事件 |
| Run | 这一轮进展到哪里了？如何订阅或停止？ | 一次执行，有独立的 id、状态和日志 |

Session 表示对话，不是正在执行的任务。Run 表示任务，不是浏览器连接。一个 Run 可以有多个订阅者，也可以暂时没有订阅者。

## 沿着时间线理解执行过程

1. 产品获取 Session，并根据新输入构造 Query。
2. `runtime.start(session, query)` 立即返回 Run，并在后台启动任务。
3. Runner 将历史记录和工具描述组合成模型请求。
4. 模型输出文本或工具调用。工具结果进入历史记录，必要时再次调用模型。
5. Run 向订阅者投递事件，最终完成、停止、失败或挂起。

Runner 执行流程。Agent 可选，用于提供身份、指令和记忆。首次集成不需要继承 Runner 或配置 Agent。

## 动手试试：在同一会话中完成两轮对话

将以下代码保存为仓库根目录下的 `two_turns.py`，在已有虚拟环境中运行 `python two_turns.py`。它仍使用仓库中的确定性模型。第二次响应由脚本预设，不能用来证明真实模型理解了历史记录。

```python
import asyncio
from docs.sample_product.server import ScriptedLLM
from flops_agent import Runtime, InMemoryDatabase, Query

async def main():
    runtime = Runtime(
        llm=ScriptedLLM([
            {"content": "I have recorded your name."},
            {"content": "Hello, Ming."},
        ]),
        database=InMemoryDatabase(),
    )
    for text in ["My name is Ming", "Please use my name"]:
        session = await runtime.load_session("demo", owner_id="local-user")
        run = runtime.start(session, Query.text(text))
        async for delivery in run.subscribe():
            print(delivery.event)
        print("Status:", (await run.wait()).value)
    session = await runtime.load_session("demo", owner_id="local-user")
    print("History roles:", [m["role"] for m in session.messages])

asyncio.run(main())
```

## 检查结果

两次运行都应以 `done` 结束。历史角色应包含两组 `user` 和 `assistant`。这验证的是同一会话的历史连续性，不是生成质量。同一 Session 已有活跃 Run 时，不要启动第二个 Run。等待完成，或使用[排队输入](05-cancellation-and-suspension.md)。

## 下一步

已有真实模型时，阅读[模型集成](connect-model.md)。要连接浏览器，阅读[订阅与重连](03-streaming-and-sse.md)。需要回顾术语时，查阅[术语表](glossary.md)。

## 代码依据

- `src/flops_agent/engine/runtime.py:961`、`:1041`：加载 Session 和启动 Run。
- `src/flops_agent/engine/runner.py:315`：模型与工具步骤；`src/flops_agent/engine/execution.py:62`：状态集合。
- `src/flops_agent/entities/query.py:37`：Query；`src/flops_agent/entities/agent.py:39`：Agent。
