# 接入自己的模型

在[构建你的第一个应用](01-quick-start.md)里，`llm` 是你写的 `PseudoLLMStreamClient`，用脚本模拟模型回复。这一页把它换成真实调用：先用包内客户端跑通，再按供应商的接口决定是否自己实现客户端。

## 先用包内的客户端

沿用 01 的虚拟环境和 `flops-agent[providers]==0.2.0`，其中已包含下面使用的 `httpx`。`OpenAIStreamClient` 是包内提供的流式 Chat Completions 客户端；供应商提供兼容接口时，可以复用它，切换供应商和模型只需调整环境变量。

将供应商发给你的密钥通过运行环境注入 `MODEL_API_KEY`，不要写进代码。其余配置可以这样设置，运行前换成自己的值：

```sh
export MODEL_PROVIDER=openai-compatible
export MODEL_NAME=your-model-name
export MODEL_BASE_URL=https://your-endpoint.example/v1
```

`MODEL_BASE_URL` 是 API 根地址，客户端会追加 `/chat/completions`。占位地址不可直接调用；兼容端点也要支持本例用到的请求字段与流格式，工具支持需单独验证。

先验证连通。将下面代码保存为 `model_check.py`，运行 `python model_check.py`，确认能逐步收到一句回复：

```python
import asyncio
import os
from flops_agent import Error, OpenAIStreamClient, Runtime, TextDelta

async def main():
    client = OpenAIStreamClient(
        api_key=os.environ["MODEL_API_KEY"],
        model=os.environ["MODEL_NAME"],
        base_url=os.environ["MODEL_BASE_URL"],
    )
    async for event in Runtime(llm=client).ask("Reply with one short sentence."):
        if isinstance(event, TextDelta):
            print(event.text, end="", flush=True)
        elif isinstance(event, Error):
            raise RuntimeError(event.message)
    print()

asyncio.run(main())
```

`Runtime.ask()` 直接产出运行事件：`TextDelta.text` 是文本增量，`Error.message` 是错误信息。缺少环境变量时会出现 `KeyError`；身份验证、模型名或端点错误，需要先核对自己的服务配置。连通后，再把客户端组织成可供应用复用的模块。

## 自己实现一个客户端

供应商不是兼容 API、需要使用专有 SDK，或需要自己的重试、降级和按请求路由策略时，就在客户端接缝上实现。01 的 `PseudoLLMStreamClient` 已符合这个调用形状；把内层的“假流”换成真实请求和数据转换，就是你自己的客户端，不需要继承包内实现。

PyPI 0.2.0 中 `LLMStreamClient` 的方法签名是：

```python
async def acompletion(self, **completion_kwargs: object) -> AsyncIterator[StreamChunk]:
    ...
```

框架先 `await client.acompletion(...)`，再异步迭代返回的流。因此外层方法返回一个异步迭代器，`yield` 放在内层生成器。流中产出 `StreamChunk` 数据块，例如 `TextStreamChunk` 或 `ToolCallStreamChunk`；运行层稍后才把它们转换成 `TextDelta` 等事件。不要直接返回完整字符串、原始网络字节或运行事件。

下面给出一个可改造的 HTTP 客户端，保存为 `model_client.py`。为说明转换位置，这里约定一个**示例接口**：向 `/generate` 提交包含 `messages`、`tools` 和 `model` 等字段的 JSON，响应为逐行 JSON（NDJSON），每行是文本片段或工具调用片段，连接结束表示流结束。它不是任何供应商的通用协议；请按自己的接口改写请求字段、认证方式和响应转换，使用 SDK 时也在这里适配。

两种响应行的形状如下；工具参数以字符串片段传递：

```json
{"type":"text","text":"A short reply."}
{"type":"tool_call","index":0,"id":"call-1","name":"get_weather","arguments_delta":"{\"city\":\"Example City\"}"}
```

```python
import json
import os
from typing import AsyncIterator

import httpx
from flops_agent import (
    LLMStreamClient, OpenAIStreamClient, StreamChunk,
    TextStreamChunk, ToolCallStreamChunk,
)

class MyClient:
    def __init__(self, *, api_key: str, model: str, base_url: str):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    async def acompletion(self, **completion_kwargs: object) -> AsyncIterator[StreamChunk]:
        request = dict(completion_kwargs)
        request.setdefault("model", self.model)

        async def stream() -> AsyncIterator[StreamChunk]:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST", f"{self.base_url}/generate",
                    headers=headers, json=request,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        item = json.loads(line)
                        if item["type"] == "text":
                            yield TextStreamChunk(text=item["text"])
                        elif item["type"] == "tool_call":
                            yield ToolCallStreamChunk(
                                index=item["index"], id=item.get("id"),
                                name=item.get("name"),
                                arguments_delta=item.get("arguments_delta"),
                            )
                        else:
                            raise ValueError("Unsupported stream item type")
        return stream()
```

这个最小实现保留请求中的 `model`，缺省时才使用构造时的模型名。工具调用的 `index`、`id`、`name` 和 `arguments_delta` 要来自同一调用的增量数据；不要把工具调用当成普通文本。网络、状态码和解析异常会向上抛出，取消异常也不会被吞掉。

## 让供应商与模型可切换

把这个工厂追加到 `model_client.py`。不设置 `MODEL_PROVIDER` 时走包内客户端；设为 `custom` 时走你自己的客户端。切换时同时配置对应的地址、密钥和模型名：

```python
def build_llm_client() -> LLMStreamClient:
    settings = dict(
        api_key=os.environ["MODEL_API_KEY"],
        model=os.environ["MODEL_NAME"],
        base_url=os.environ["MODEL_BASE_URL"],
    )
    provider = os.environ.get("MODEL_PROVIDER", "openai-compatible")
    if provider == "custom":
        return MyClient(**settings)
    if provider == "openai-compatible":
        return OpenAIStreamClient(**settings)
    raise ValueError("Unsupported MODEL_PROVIDER")
```

工厂在应用组装时选择一次客户端，不会自动按请求切换供应商。如果需要每次请求选择不同供应商或模型，在你自己的 `acompletion` 中读取请求的 `model`，按产品映射选择客户端，再原样传递请求；不要为并发请求改写共享客户端的默认配置。本例只实现上面的两个工厂分支。

## 接进你的应用

把 `model_client.py` 放在 01 的 `app.py` 旁边，将原来的 `build_runtime()` 换成下面这一段。保留 01 其余导入、`get_weather` 和运行入口：

```python
import os
from model_client import build_llm_client

def build_runtime():
    return Runtime(
        agent=Agent(),
        llm=build_llm_client(), tools=[get_weather],
        database=InMemoryDatabase(), run_store=InMemoryRunStore(),
        executor=DefaultToolExecutor(), runner=Runner,
        model=os.environ["MODEL_NAME"],
    )
```

这里不仅替换了 `llm=PseudoLLMStreamClient()`，还把 `model="scripted-model"` 改为环境变量。Runtime 传入的请求级模型名会覆盖客户端默认值，不能留下原来的占位名称。原 `PseudoLLMStreamClient` 类不再被使用，可以删除。

运行 `python app.py`，验证所选模型能请求工具并使用工具结果回答。真实模型不一定复现脚本替身的固定输出，纯文本连通成功也不代表工具调用已经兼容。后续在产品启动时构造并复用 Runtime，继续沿用 `load_session()`、`start()` 和订阅路径。

## 边界

密钥和配置由产品提供，框架不管理密钥，也不替你发现凭据。不要把密钥写入源码。示例地址是占位地址；本页示例需要你自己的 key 和可用端点才能真调用。在没有真实 key 的环境下，只能验证构造、协议适配和本地模拟调用，不能据此认定真实供应商已验证。

本例客户端不会自动重试或降级。供应商重试、降级与路由策略由产品实现；0.2.0 另外提供可选的 `Runtime.llm_stream_retry`，用于流调用失败时重发当前步骤，默认关闭。它不提供跨供应商降级，也不替代客户端的供应商策略。避免在两层重复重试，流已输出后的重试还需处理重复内容。

上面的工厂是本例全部的供应商选择逻辑，框架不内置多供应商路由。自定义接口只演示文本与工具调用；推理、结束原因或用量等字段还需按供应商实际返回的内容适配。工具的执行与授权仍由产品负责。

## 下一步

下一步，阅读[断线后继续接收结果](03-streaming-and-sse.md)。将验证过的模型客户端注入产品长期持有的 Runtime，再把运行输出接到客户端订阅。

如果你想直接去看：

- [错误与限制](errors-and-limits.md) —— 排查配置和运行故障。

## 代码依据

以下路径与行号来自 PyPI 安装的 `flops-agent==0.2.0`，相对于 `site-packages/`，不是当前源码分支：

- `flops_agent/seams/llm_client.py:17`：可运行时检查的 `LLMStreamClient` 协议及方法签名。
- `flops_agent/providers/openai.py:99`、`:116`：构造参数、请求级模型覆盖及流式请求转换。
- `flops_agent/entities/contracts.py:50`、`:66`：文本与工具调用数据块的字段。
- `flops_agent/entities/events.py:37`、`:179`：`TextDelta` 与 `Error` 运行事件。
- `flops_agent/engine/runtime.py:147`、`:1218`：客户端与模型注入、可选重试配置及 `ask()` 事件输出。
- `flops_agent/engine/runner.py:392`：可选重试的执行位置与取消异常传播。
