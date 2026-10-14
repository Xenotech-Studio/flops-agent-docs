# 系统如何完成一轮用户提问的响应

运行过[第一个应用](01-quick-start.md)后，我们沿着用户的一轮提问，看看输入怎样进入系统、模型怎样调用工具，以及响应怎样回到用户手中。Runtime、Session、Query 和 Run 会在各自负责的环节出现。

## 用户的问题进入会话

用户发来一句话，产品先用会话标识和用户标识调用 `runtime.load_session(...)`，取得这段对话的 Session。Session 保存已有消息，让这一轮可以接着之前的对话继续。

产品把新输入包装成 `Query.text(text)`。Query 承载这一轮带来的输入；此时的问题还需要交给 Runtime，才能开始生成响应。

## Runtime 启动这一轮响应

Runtime 通常在产品启动时组装好，持有模型客户端、工具和存储配置。产品调用 `runtime.start(session, query)`，把已有会话和新问题交给它。

这个调用立即返回一个 Run，并在后台推进执行。Run 记录这一轮的 id、状态和输出事件，产品通过它订阅进展、等待结果或请求停止。Session 则继续承载整段对话，供后续提问使用。

## 模型生成回答，需要时调用工具

Run 背后的 Runner 把用户输入纳入会话，结合历史消息与工具描述构造模型请求。模型可以直接输出回答，也可以提出工具调用。模型请求通过 `llm` 客户端发送；接入服务时，将脚本替身换成真实模型客户端，见[接入自己的模型](connect-model.md)。

需要工具时，Runner 调度对应的工具，将结果写回会话，再把结果交给模型继续处理。一轮用户提问因此可能经历多次模型调用，直到能够结束这一轮响应。接入了 Agent 时，它还可以提供身份、指令和记忆；首次集成可以使用默认 Runner，不配置 Agent。

工具通过 `tools` 注册，接入业务时换成自己的函数，见[为智能体添加工具](07-extending.md)；调用交给 `executor` 执行，可保留本地执行端，也可按部署需要提供远程适配器。需要改变循环中的产品策略时，再通过 `runner` 配置 Runner 子类，见[在合适的扩展点实现产品策略](customize-runner.md)。

如果需要长期记忆，在 Agent 上接入可选的 `memory`，为模型请求读取相关内容，并在正常完成后调度维护；读取、维护和存储由产品实现，见[接入长期记忆](long-term-memory.md)。

## 响应在执行过程中回传

模型与工具循环推进时，Runner 将输出转成事件交给 Run。产品通过 `run.subscribe()` 持续接收事件，把文本和进展呈现给用户，不必等整轮完成后才显示回答。

浏览器接入时，产品还需要提供 HTTP 流式接口并处理客户端渲染。订阅负责接收输出，Run 负责跟踪执行；同一 Run 可以有多个订阅者，也可以暂时没有订阅者。运行日志与状态由 `run_store` 对应的 RunStore 保存，需要跨重启保留时换成持久化实现，见[保存并继续会话](04-sessions-and-persistence.md)。

## 这一轮结束，会话留下记录

Runner 在执行与收尾过程中将会话变化写入配置的 Database。它通过 `database` 接入；产品需要跨重启保留对话时，换成持久化后端。正常完成后，`await run.wait()` 返回 `done`；产品可以据此结束这一轮的等待。

用户继续提问时，产品用同一组会话标识和用户标识重新加载 Session，取回已有消息，再为新输入启动一个 Run。这样，两轮响应各有自己的执行状态，又共享同一段对话历史。

## 动手试试：在同一会话中完成两轮对话

将以下代码保存为仓库根目录下的 `two_turns.py`，在已有虚拟环境中运行 `python two_turns.py`。示例沿用仓库中的确定性模型，先记录名字，再在同一会话中发起第二轮输入。

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

两次运行都应以 `done` 结束。最后打印的历史角色应包含两组 `user` 和 `assistant`，对应两轮输入与响应。

## 边界

示例的第二次响应由脚本预设，只验证同一会话的历史连续性，不能证明真实模型理解了历史。这里使用的内存存储也不会在进程重启后保留消息；跨进程保留会话需要持久化后端。

同一 Session 已有活跃 Run 时，不要启动第二个 Run。等待完成，或使用[排队输入](05-cancellation-and-suspension.md)。订阅断开不会自动停止执行；运行也可能停止、失败或挂起，产品不能把所有结束情况都当作成功回答。

## 下一步

下一步，阅读[接入自己的模型](connect-model.md)。明确运行对象的职责后，将示例中的模型替身换成真实客户端，验证模型请求与输出。

如果你想直接去看：

- [订阅与重连](03-streaming-and-sse.md) —— 将运行输出交付给客户端。
- [术语表](glossary.md) —— 查阅运行对象与事件的术语。

## 代码依据

- `src/flops_agent/engine/runtime.py:961`、`:1041`：加载 Session 和启动 Run。
- `src/flops_agent/engine/runner.py:315`：模型与工具步骤；`src/flops_agent/engine/execution.py:62`：状态集合。
- `src/flops_agent/entities/query.py:37`：Query；`src/flops_agent/entities/agent.py:39`：Agent。
