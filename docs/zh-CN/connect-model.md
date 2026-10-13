# 接入自己的模型

**Reader question:** 如何用真实服务替换离线模型，并验证连接？

**Prerequisites:** 完成[执行流程演练](02-core-concepts.md)，并获得兼容流式 Chat Completions 端点的服务访问权限。**Outcome:** 通过自己的端点完成请求，区分网络故障与运行时故障。

## 准备配置

快速开始中的 `.[providers]` 安装已包含 HTTP 客户端。若只安装已发布的包，使用 `python -m pip install 'flops-agent[providers]==0.2.0'`。API 密钥、模型名和基础 URL 由产品提供。框架不会在机器上搜索配置文件。

以下程序从环境中读取 `MODEL_API_KEY`、`MODEL_NAME` 和 `MODEL_BASE_URL`。在运行环境中设置真实值，不要将凭据写入源代码。基础 URL 应使用服务的 API 根地址，例如以 `/v1` 结尾的地址。不要追加 `/chat/completions`，客户端会自动添加。

## 动手试试

保存为 `model_check.py`，然后运行 `python model_check.py`：

```python
import asyncio
import os
from flops_agent import OpenAIStreamClient, Runtime, TextDelta, Error

async def main():
    client = OpenAIStreamClient(
        api_key=os.environ["MODEL_API_KEY"],
        model=os.environ["MODEL_NAME"],
        base_url=os.environ["MODEL_BASE_URL"],
    )
    runtime = Runtime(llm=client)
    async for event in runtime.ask("Introduce yourself in one sentence."):
        if isinstance(event, TextDelta):
            print(event.text, end="", flush=True)
        elif isinstance(event, Error):
            raise RuntimeError(event.message)
    print()

asyncio.run(main())
```

`ask()` 直接产出事件，适合一次性脚本。要获取 run_id、游标或停止句柄，或继续一段对话，请使用上一篇中的 `load_session()` -> `start()` -> `subscribe()` 路径。

## 检查结果

你应该能看到一句话逐步输出。启动时出现 `KeyError` 表示缺少环境变量。遇到身份验证或未知模型错误时，先检查服务配置。遇到流格式不兼容时，确认服务确实提供兼容的增量响应。支持文本流不代表支持工具调用；请通过[工具演练](07-extending.md)单独验证。

如果已有自定义客户端，其 `async acompletion(**request)` 必须返回可异步迭代的数据块流。不要返回完整字符串，也不要将原始 SSE 字节当作框架事件。可参考 LLMStreamClient 和已有提供方适配器来实现边界转换。

## 下一步

将验证过的客户端注入产品长期持有的 Runtime，再接入[客户端订阅](03-streaming-and-sse.md)。遇到故障时，查阅[错误与限制](errors-and-limits.md)。

## 代码依据

- `src/flops_agent/providers/openai.py:99`、`:116`：构造参数、流式请求和端点构造。
- `src/flops_agent/seams/llm_client.py:18`：客户端协议。
- `src/flops_agent/engine/runtime.py:1218`：ask 产出的事件。
