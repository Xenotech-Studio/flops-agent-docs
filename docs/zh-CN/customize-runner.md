# 在合适的扩展点实现产品策略

**Reader question:** 如何添加门控、记忆或远程执行，而不复制整个运行循环？

**Prerequisites:** 完成[工具演练](07-extending.md)，理解[停止与挂起](05-cancellation-and-suspension.md)。**Outcome:** 根据需求选择扩展边界，添加可验证的工具门控。

## 选择最小的扩展点

| 需求 | 扩展点 | 仍由框架负责的工作 |
|---|---|---|
| 在工具执行前拒绝调用 | Runner.before_tool | 调用循环、事件和历史回写 |
| 赋予助手跨轮次的身份与知识 | Agent 和 Memory | 请求中的召回与完成后的维护调度 |
| 在其他进程中执行工具 | ToolExecutor.execute | 调用上下文、流事件和生命周期 |
| 改变本次请求的模型输入 | Runner.project_messages | 对话事实和持久化流程 |

## 动手试试：添加工具门控

将以下类加入上一篇的示例，并将 Runtime 构造改为 `Runtime(llm=llm, tools=[get_weather], runner=WeatherOnlyRunner)`：

```python
from flops_agent import Runner, ToolGate

class WeatherOnlyRunner(Runner):
    async def before_tool(self, call):
        if call.function.name != "get_weather":
            return ToolGate.deny({"error": "This assistant only permits sample weather queries"})
        return ToolGate.proceed()
```

`deny()` 跳过执行，但将拒绝结果返回模型；模型可以结束任务或选择其他方式。示例演示的是策略边界，不是完整的安全系统。用户权限、参数校验和外部资源授权仍由产品实现。

## 检查结果

先保留脚本请求中的 get_weather，确认原示例仍能通过。再将请求的工具名改为不允许的名称。验证处理函数没有被调用、历史中包含拒绝结果，并且运行能够结束。门控行为应能在确定性测试中复现，而不依赖真实模型是否碰巧请求某个工具。

## 添加记忆或远程执行

Memory 定义 `async recall(session, *, query=None)` 和 `async remember(session)`。前者返回本次请求使用的文本；后者维护产品自己的知识存储。Agent 可以携带指令与记忆。记忆维护在运行完成后异步调度，所以不能把运行完成当作记忆已持久化的证明。持久化与重试由产品负责。

远程执行端实现 `async execute(call, ctx)`。将增量输出发送到 ctx.stream_sink；将 Run 的 on_stop 通知转发到远程任务系统；恢复时，通过 ctx.record_dispatch 和 ctx.resume_of 关联原任务。HTTP/WebSocket 连接、身份验证和设备选择应留在适配器中，不要放入框架通用实体。

要执行已知调用而不再询问模型，覆写 plan_step 并返回 `StepPlan.dispatch(calls)`。要修改已有模型调用，使用 prepare_dispatch。不要指望只在模型已请求调用后才运行的钩子凭空创建执行步骤。

## 下一步

下一步，阅读[将示例集成到产品](08-worked-example.md)。把选好的扩展点接入完整请求路径，并用产品集成清单验证各个边界。

如果你想直接去看：

- [API 契约](api_surface.md) —— 查阅接口的精确签名。

## 代码依据

- `src/flops_agent/engine/runner.py:523`、`:1383`：工具门控和默认行为；`:638`：步骤规划。
- `src/flops_agent/entities/agent.py:26`、`:79`：记忆协议和异步维护。
- `src/flops_agent/seams/executor.py:1`、`src/flops_agent/tools/registry.py:49`：执行端与上下文。
