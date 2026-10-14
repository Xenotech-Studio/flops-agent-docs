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

Runtime 把应用需要的模型客户端、工具、存储和执行端组装起来。本教程先用包内的内存存储、本地执行端和下面的脚本替身跑通流程。看到回复后，再按需要逐个替换。

这篇你会碰到其中四块：

- `llm` → `PseudoLLMStreamClient`（脚本替身；换真实模型见[接入自己的模型](connect-model.md)）
- `tools` → `get_weather`（你的业务工具；扩展示例见[为智能体添加工具](07-extending.md)）
- `database / run_store` → 内存实现（换持久化见[保存并继续会话](04-sessions-and-persistence.md)）
- `memory` → 未接入（可选；见[接入长期记忆](long-term-memory.md)）

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

下一步，阅读[系统如何完成一轮用户提问的响应](02-core-concepts.md)。沿着刚才的示例，理清 Runtime、Session、Query 和 Run 的关系，为后续接入服务打好基础。

如果你想直接去看：

- [接入自己的模型](connect-model.md) —— 替换 `llm` 与 `model`。
- [保存并继续会话](04-sessions-and-persistence.md) —— 接入持久化存储。
- [为智能体添加工具](07-extending.md) —— 接入自己的业务工具。

## 边界

脚本替身固定查询虚构城市阿斯加德，不理解用户输入，也不请求真实模型；天气函数对传入的城市固定返回“晴”，不连接真实天气服务，结果不含温度或单位。会话与运行记录只存在当前进程内，生产中需要按保留需求换成持久化实现。存储后端不会替你保留进程内的 Run 句柄，因此不要为每个流连接重建 Runtime。

## 代码依据

以下路径相对于 PyPI `flops-agent==0.2.0` 安装后的 `site-packages/`：

- `flops_agent/engine/runtime.py`：Runtime 组装、加载 Session 与启动 Run。
- `flops_agent/engine/runner.py`：模型与工具循环、结果回灌。
- `flops_agent/seams/executor.py`、`flops_agent/tools/schema.py`：本地执行端与函数工具注册。
- `flops_agent/seams/database.py`、`flops_agent/seams/run_store.py`：会话存储与运行存储的接口及内存实现。
- `flops_agent/entities/agent.py`、`flops_agent/entities/contracts.py`：Agent 配置与模型流片段。
