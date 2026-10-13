# 进程重启后恢复任务

**Reader question:** 如何恢复中断的任务，同时避免重复触发工具副作用？

**Prerequisites:** 接入[持久化存储](04-sessions-and-persistence.md)，理解[停止与挂起](05-cancellation-and-suspension.md)。**Outcome:** 实现恢复回调，设计结果可观测的中断测试。

## 满足恢复前提

创建另一个 Runtime 不会自动触发恢复。你需要持久化的 Session、支持恢复枚举和重试预算的 RunStore，以及能够重建模型、授权上下文和工具环境的产品入口。InMemoryRunStore 在进程退出后会丢失恢复依据，无法支持真实重启后的恢复。

正常关闭时，在产品的关闭钩子中调用 `await runtime.shutdown()`，将活跃运行标记为已中断。进程崩溃不会执行该钩子。存储实现必须识别已无人处理的活跃记录，产品必须防止多个实例同时恢复同一任务。

## 动手试试：重建执行入口

这是集成示意，不是独立脚本。Runtime 已连接持久化后端。在 resume 中加入产品授权和上下文重建：

```python
async def resume(meta):
    session = await runtime.load_session(meta.session_id, owner_id=meta.owner_id)
    runtime.start(session, run_id=meta.run_id)

async def gave_up(meta):
    await runtime.clear_session_active_run_async(
        meta.session_id, owner_id=meta.owner_id, run_id=meta.run_id,
    )

scheduled = await runtime.recover(resume, on_gave_up=gave_up)
```

保留原 run_id，让已有日志仍能标识同一次执行。没有新用户输入时，不需要新的 Query。加密存储或专用产品入口还需要重新获取各自的上下文；示意代码不会替你完成这些工作。

`recover()` 枚举恢复候选项，调用存储的 mark_resuming，并异步调度 resume。它返回**已调度数量**，不是成功恢复数量。预算耗尽时，会调用 on_gave_up。sample_product 的启动回调中包含占位 pass，并不是完整的恢复实现。

## 处理执行了一部分的工具

远程工具可能已完成操作，但结果尚未写入 Session。重新运行模型可能导致重复下单或重复写入。

RunStore 的调度记录，以及 ToolContext 的 record_dispatch 和 resume_of，提供关联依据。执行端应保留远程任务标识符，恢复时查询或复用首次任务，不要盲目新建任务。调度记录并不保证业务操作恰好执行一次。幂等键、结果查询和重试策略由工具实现负责。

## 检查结果

1. 使用可按任务 id 查询的测试工具启动运行。保存 run_id 和最后一个游标。
2. 在执行端接收任务后中断进程。确认 Session 和运行依据仍保存在存储中。
3. 启动新的 Runtime 并调用 recover。观察回调、最终状态和错误，不要只看 scheduled。
4. 查询工具系统，确认业务操作只发生一次。重连原 run_id，验证产品的重放路径。
5. 模拟恢复失败，检查预算耗尽后重试是否结束、产品指针是否清理。

## 下一步

恢复正常工作后，再考虑[长对话输入](context-window.md)。存储的具体能力参见 [API 契约](api_surface.md)。

## 代码依据

- `src/flops_agent/engine/runtime.py:1154`、`:1258`：恢复调度和关闭语义。
- `src/flops_agent/engine/runner.py:666`：未完成调度的恢复规划。
- `src/flops_agent/tools/registry.py:49`、`:83`：执行上下文和调度记录。
