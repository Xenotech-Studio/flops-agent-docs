# 为智能体添加工具

**Reader question:** 如何让模型调用我的函数，并验证结果进入下一次请求？

**Prerequisites:** 运行[基础两轮对话示例](02-core-concepts.md)。**Outcome:** 注册工具，执行一次确定性调用，检查历史中的结果。

## 动手试试

保存为仓库根目录下的 `tool_check.py`，运行 `python tool_check.py`。脚本化模型将“模型是否选择调用工具”与“工具是否正确接入”这两个问题分开。

```python
import asyncio
from docs.sample_product.server import ScriptedLLM
from flops_agent import Runtime, Session, Query, ToolResult

async def get_weather(city: str) -> dict:
    """Return sample weather without contacting a real weather service."""
    return {"city": city, "forecast": "sunny"}

async def main():
    llm = ScriptedLLM([
        {"tool_calls": [{"id": "weather-1", "name": "get_weather",
                         "arguments": {"city": "London"}}]},
        {"content": "The sample weather is sunny."},
    ])
    runtime = Runtime(llm=llm, tools=[get_weather])
    session = Session("tool-demo")
    run = runtime.start(session, Query.text("What is the weather in London?"))
    async for delivery in run.subscribe():
        if isinstance(delivery.event, ToolResult):
            print("Tool result:", delivery.event.result)
    print("History roles:", [m["role"] for m in session.messages])
    assert any(m["role"] == "tool" for m in session.messages)
    assert (await run.wait()).value == "done"

asyncio.run(main())
```

## 检查结果

你应该看到包含 city 和 forecast 的结果，以及历史角色 `user -> assistant -> tool -> assistant`。这验证了注册、调度和历史回写。脚本预设的最后一句话不能证明模型理解了任意工具结果。换成真实模型后，单独验证它能否选择工具并使用结果。

## 定义参数边界

普通函数的 schema 根据签名生成，但当前最小实现将参数都声明为字符串。**它不会完整推断 Python 类型注解。** 对于数字、枚举、嵌套对象或更严格的约束，应传入 `{"schema": schema, "fn": handler}`，提供显式的 OpenAI 风格工具描述。

只有 schema 并不等于实现了工具。还需要处理函数或执行端路由。在业务处理函数中校验模型生成的参数；schema 不能代替用户权限或业务授权。

## 何时进一步扩展

如果只需要一个函数，到这里即可。需要工具门控、身份与记忆或远程执行时，阅读[在合适的扩展点实现产品策略](customize-runner.md)。本页原先的 Runner、Memory 和 Executor 内容已在那里展开。投影与摘要统一在[控制模型输入](context-window.md)中说明。

ToolRegistry 可管理工具包、可见性和执行路由。确认扁平工具列表无法满足需求后，再引入包和能力过滤。参见 [API 契约](api_surface.md)。

## 下一步

添加一个拒绝条件，验证拒绝结果会返回模型，且工具没有执行。按照[产品策略文章](customize-runner.md)完成这项练习。

## 代码依据

- `src/flops_agent/tools/schema.py:17`、`:42`：接受的工具形式和字符串参数推断。
- `src/flops_agent/engine/runtime.py:173`：扁平工具列表注册到默认包。
- `src/flops_agent/engine/runner.py:523`：工具执行、交互与结果回写。
