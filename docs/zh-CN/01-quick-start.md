# 构建你的第一个应用

跟着做完，你会从零写出一个能跑的 agent 应用：调用你定义的工具，再写入一条记忆。全程不需要 API key，也不需要克隆仓库。

## 准备环境

准备好 Python 3.10 或更高版本，打开终端。以下命令使用类 Unix shell，安装时需要联网。

```sh
mkdir my-first-agent
cd my-first-agent
python3 -m venv .venv
. .venv/bin/activate
pip install "flops-agent[providers]==0.2.0"
```

这段命令创建你的应用目录和虚拟环境，从 PyPI 安装本教程验证过的 `0.2.0` 版本；`providers` 带上后续接入真实模型所需的 HTTP 客户端依赖。

## 写你的应用

在这个目录中新建 `app.py`，把下面四段代码按顺序写进同一个文件。

```python
import asyncio

from flops_agent import (
    Agent, Query, Runtime, TextDelta, TextStreamChunk,
    ToolCallStreamChunk, ToolResult,
)


def delivery_fee(city: str) -> str:
    """查询城市的配送费。"""
    return f"{city}的配送费是 6 元"
```

这段定义你的业务工具 `delivery_fee()`，先用一条简单规则返回配送费。

```python
class ScriptedModel:
    async def acompletion(self, **kwargs):
        async def stream():
            last = kwargs["messages"][-1]
            if last["role"] == "tool":
                yield TextStreamChunk(text=f"查询结果：{last['content']}")
            else:
                yield ToolCallStreamChunk(
                    index=0, id="fee-1", name="delivery_fee",
                    arguments_delta='{"city": "上海"}',
                )
        return stream()
```

这段实现无需 API key 的模型替身：先请求调用 `delivery_fee`，收到工具结果后，再用结果生成回复。

```python
class NotebookMemory:
    def __init__(self):
        self.notes = []
        self.saved = asyncio.Event()

    async def recall(self, session, *, query=None):
        return "\n".join(self.notes)

    async def remember(self, session):
        user = next(m for m in reversed(session.messages) if m["role"] == "user")
        self.notes.append(user["content"])
        self.saved.set()
```

这段实现 Memory 接口，把最后一条用户请求存进列表，并用 `saved` 通知应用写入已完成。

```python
async def main():
    memory = NotebookMemory()
    runtime = Runtime(
        llm=ScriptedModel(), tools=[delivery_fee],
        agent=Agent(memory=memory),
    )
    session = await runtime.load_session("my-first-app")
    run = runtime.start(session, Query.text("请查一下上海的配送费"))
    async for delivery in run:
        event = delivery.event
        if isinstance(event, ToolResult):
            print("工具结果：", event.result, sep="")
        elif isinstance(event, TextDelta):
            print("模型回复：", event.text, sep="")
    # 记忆更新在后台调度，等写入完成后再读取。
    await asyncio.wait_for(memory.saved.wait(), timeout=5)
    print("记忆：", memory.notes, sep="")


asyncio.run(main())
```

这段组装 Runtime、注册工具并启动一次 Run，打印工具结果与模型回复，再等待记忆写入并打印记录。

## 跑起来

保存文件，在同一个终端运行：

```sh
python app.py
```

这条命令运行你刚写好的应用。

你会看到：

```text
工具结果：上海的配送费是 6 元
模型回复：查询结果：上海的配送费是 6 元
记忆：['请查一下上海的配送费']
```

这是以上代码在 PyPI 的 `flops-agent==0.2.0` 上的完整运行输出。

## 看懂刚才发生了什么

`runtime.load_session()` 创建 Session，`Query.text()` 装入用户请求，`runtime.start()` 返回本次运行的 Run。默认 Runner 随后完成模型调用、工具执行与结果回灌的循环。

模型第一次收到请求时，`ScriptedModel.acompletion()` 返回 `ToolCallStreamChunk`，指定调用 `delivery_fee`，参数为 `{"city": "上海"}`。`tools=[delivery_fee]` 已把你的函数注册成工具，框架执行它，第一行「工具结果」就是函数的返回值。

Runner 把结果作为 `tool` 消息写回 Session，再次调用模型。替身读到最后一条消息的 `content`，生成 `TextStreamChunk`，于是你看到第二行「模型回复」。你可以把函数里的 `6` 改成 `8` 再运行，两行中的配送费都会变成 `8` 元。

运行正常结束时，框架调度 `NotebookMemory.remember()`，把用户请求写入 `notes`。记忆更新在后台进行，所以应用等待 `saved` 后再读取列表；第三行就是这次写入的记录。

## 接下来可以做什么

想换成真实模型，阅读[接入自己的模型](connect-model.md)，替换 `llm=ScriptedModel()`。想保存并继续会话，阅读[保存并继续会话](04-sessions-and-persistence.md)，接入持久化的 Database；Memory 中的列表也需要换成你自己的持久化存储。

想继续添加业务工具，阅读[为智能体添加工具](07-extending.md)。想弄清 Runtime、Session、Query 和 Run 的关系，阅读[理解任务如何运行](02-core-concepts.md)。

你刚写的这 58 行就是一个可用的雏形。把 `ScriptedModel` 换成真实的模型客户端，把 `NotebookMemory` 换成使用持久化存储的实现，就能在这份代码上继续构建你的产品。

## 边界

这里的模型是脚本化替身：固定查询上海，不会理解用户输入，也不发送真实模型请求。配送费函数会实际执行，但只返回演示用的固定费用，不查询外部业务系统，也不执行系统命令。

Session 和记忆只存在当前进程中，进程退出后状态不保留。这份 Memory 只是保存原始请求，没有实现记忆提炼或检索策略；等待 `saved` 是为了让这个短脚本在退出前确认写入完成。

接入产品时，应在进程启动时组装并复用 Runtime，不要为每个流连接重建它，否则新实例找不到原实例持有的本地运行句柄。

## 代码依据

以下路径相对于 PyPI `flops-agent==0.2.0` 安装后的 `site-packages/` 目录。

- `flops_agent-0.2.0.dist-info/METADATA:3`、`:19`、`:24`：包版本、Python 版本要求与 `providers` 依赖组。
- `flops_agent/seams/llm_client.py:18`、`flops_agent/engine/runner.py:467`：模型接缝的 `acompletion()` 先被等待，再返回可异步迭代的流。
- `flops_agent/entities/contracts.py:51`、`:67`：文本与工具调用流片段。
- `flops_agent/engine/runtime.py:147`、`:185`、`flops_agent/tools/schema.py:17`：Runtime 构造参数与 Python 函数工具注册。
- `flops_agent/engine/runtime.py:961`、`:1041`、`flops_agent/entities/query.py:63`：加载 Session、启动 Run 与创建文本 Query。
- `flops_agent/engine/runner.py:539`、`:1388`：工具结果写回 Session 并产生结果事件。
- `flops_agent/entities/agent.py:26`、`:72`、`flops_agent/engine/runner.py:1423`：Memory 接口与正常结束后的后台记忆更新。
- `flops_agent/engine/runtime.py:1`、`:1087`：Runtime 的复用方式与本地运行句柄。
