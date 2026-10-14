# 构建你的第一个应用

跟着做完，你会得到一个最小 agent 应用：调用你定义的工具，再根据工具结果回复。全程不需要 API key，也不需要克隆仓库。

## 准备环境

准备好 Python 3.10 或更高版本，在类 Unix 终端中创建目录和虚拟环境，再从 PyPI 安装本教程验证过的版本：

```sh
mkdir my-first-agent
cd my-first-agent
python3 -m venv .venv
. .venv/bin/activate
pip install "flops-agent[providers]==0.2.0"
```

`providers` 带上后续接入真实模型所需的 HTTP 客户端依赖。

## 搭建你的应用

Runtime 组装应用，Runner 驱动模型与工具循环。先用内存存储跑通，再按需求替换；Agent 配置角色与指令。

| 接缝 / 配置与职责 | 这里用什么 | 真实产品里用什么 |
| --- | --- | --- |
| `agent`：角色与指令 | `Agent()` | 配置名称与指令的 Agent |
| `llm`：模型请求与流式回复 | `PseudoLLMStreamClient`，脚本替身 | 模型客户端，如 `OpenAIStreamClient` |
| `tools`：模型可调用的业务能力 | `get_weather`，演示天气查询 | 你的业务工具 |
| `database`：保存会话及消息 | `InMemoryDatabase`，进程内存 | 你选的持久化后端 |
| `run_store`：保存运行日志与状态 | `InMemoryRunStore`，进程内存 | 实现 RunStore 接口的持久化后端 |
| `executor`：实际执行工具调用 | 包内 `DefaultToolExecutor`，本地执行端 | 按部署需要保留，或换成远程执行端适配器 |
| `memory`：可选的产品层接缝 | 未接入（默认 `None`） | 产品层定义召回与维护，可后接，见[接入长期记忆](long-term-memory.md) |
| `runner`：驱动循环 | 包内 `Runner` | 保留，或用子类定制产品策略 |
| `model`：传给模型客户端的模型名 | `"scripted-model"`，占位名称 | 服务商支持的模型名 |

新建 `app.py`，按顺序写入下面三段代码。第一段声明业务工具和模型替身；替身先请求工具，再根据工具结果生成回复。

```python
import asyncio
from flops_agent import (
    Agent, InMemoryDatabase, InMemoryRunStore, Query, Runner, Runtime,
    TextDelta, TextStreamChunk, ToolCallStreamChunk, ToolResult,
)
from flops_agent.seams.executor import DefaultToolExecutor


def get_weather(city: str) -> str:
    """查询城市天气。"""
    return f"{city}：晴"


class PseudoLLMStreamClient:
    async def acompletion(self, **kwargs):
        async def stream():
            last = kwargs["messages"][-1]
            if last["role"] == "tool":
                yield TextStreamChunk(text=f"查询结果：{last['content']}")
            else:
                yield ToolCallStreamChunk(
                    index=0, id="weather-1", name="get_weather",
                    arguments_delta='{"city": "阿斯加德"}',
                )
        return stream()
```

第二段组装 Runtime。`tools` 注册函数及其参数描述，`executor` 决定如何执行。

```python
def build_runtime():
    return Runtime(
        agent=Agent(),
        llm=PseudoLLMStreamClient(), tools=[get_weather],
        database=InMemoryDatabase(), run_store=InMemoryRunStore(),
        executor=DefaultToolExecutor(), runner=Runner, model="scripted-model",
    )
```

到这里，应用的部件已全部声明，但还没有发起请求。产品应在进程启动时组装并复用 Runtime，由请求入口加载 Session、提交 Query，并读取 Run 的事件。

## 运行演示

把第三段追加到同一个 `app.py`：它是演示入口，创建会话并启动一次运行，消费本次运行的事件。

```python
async def main():
    runtime = build_runtime()
    session = await runtime.load_session("my-first-app")
    run = runtime.start(session, Query.text("请查询阿斯加德的天气"))
    async for delivery in run:
        event = delivery.event
        if isinstance(event, ToolResult):
            print("工具结果：", event.result, sep="")
        elif isinstance(event, TextDelta):
            print("模型回复：", event.text, sep="")


asyncio.run(main())
```

保存文件，在同一个终端运行：

```sh
python app.py
```

你会看到以下完整输出，来自 PyPI 的 `flops-agent==0.2.0`：

```text
工具结果：阿斯加德：晴
模型回复：查询结果：阿斯加德：晴
```

`load_session()` 加载或创建 Session，`Query.text()` 装入用户请求，`start()` 返回本次运行的 Run。Runner 调用模型替身，收到工具请求后交给执行端调用 `get_weather()`，第一行就是工具返回值。

Runner 将工具结果写回会话，再调用 `llm` 生成回复，对应第二行。入口通过 `async for` 消费本次运行的事件，分别处理工具结果与文本增量。`database` 保存会话，`run_store` 保存运行日志与状态，这两个接缝不单独打印一行。

## 接下来可以做什么

阅读[接入自己的模型](connect-model.md)，替换 `llm` 与 `model`；阅读[保存并继续会话](04-sessions-and-persistence.md)，接入持久化存储。想添加业务工具，阅读[为智能体添加工具](07-extending.md)；想进一步理解 Runtime、Session、Query 和 Run，阅读[理解任务如何运行](02-core-concepts.md)。

## 边界

脚本替身固定查询虚构城市阿斯加德，不理解用户输入，也不请求真实模型；天气函数对传入的城市固定返回“晴”，不连接真实天气服务，结果不含温度或单位。会话与运行记录只存在当前进程内，生产中需要按保留需求换成持久化实现。存储后端不会替你保留进程内的 Run 句柄，因此不要为每个流连接重建 Runtime。

## 代码依据

以下路径相对于 PyPI `flops-agent==0.2.0` 安装后的 `site-packages/`：

- `flops_agent/engine/runtime.py`：Runtime 组装、加载 Session 与启动 Run。
- `flops_agent/engine/runner.py`：模型与工具循环、结果回灌。
- `flops_agent/seams/executor.py`、`flops_agent/tools/schema.py`：本地执行端与函数工具注册。
- `flops_agent/seams/database.py`、`flops_agent/seams/run_store.py`：会话存储与运行存储的接口及内存实现。
- `flops_agent/entities/agent.py`、`flops_agent/entities/contracts.py`：Agent 配置与模型流片段。
