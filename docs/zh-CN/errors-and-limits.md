# 诊断故障并检查限制

**Reader question:** 出现故障或行为不符合预期时，应该先检查哪一层？

**Prerequisites:** 正在集成学习部分介绍的流程。**Outcome:** 根据可观测症状定位责任边界，避免盲目重建 Runtime 或重复执行任务。

## 执行与连接

| 症状 | 优先检查 | 下一步操作 |
|---|---|---|
| start 抛出 SessionRunActiveError | 该 session_id 是否已有本地活跃 Run？ | 等待、停止或将输入排队；不要用并行运行覆盖对话 |
| 浏览器关闭后任务仍在继续 | 是否只关闭了订阅？ | 这是预期行为；需显式调用 stop_session 停止任务 |
| runs.get(run_id) 返回 None | 是否在另一个进程，或者运行已结束？ | 使用产品路由和持久化重放，不要为同一用户任务再次 start |
| 运行进入 failed | Run.error、Error 事件和产品日志 | 检查模型、工具和存储边界；不要无条件重试有副作用的操作 |
| 停止操作未立即结束工具 | 执行端是否传递停止意图？ | 停止是协作式的，不会强制终止任意外部进程 |

代码依据：`src/flops_agent/engine/runtime.py:1041`；`src/flops_agent/engine/execution.py:714`、`:693`；`src/flops_agent/engine/runner.py:189`。

RunPool 使用 session_id 作为本地查询键。因此，不同用户的相同会话 id 可能冲突。使用无冲突的对话 id，并独立执行授权。本地池不保证跨进程互斥。

## 重放与输入

实时输出与重放不一定一一对应。保存服务端游标，不要通过统计帧数去重或推断位置。默认重放帧不会获得新游标，因此产品协议必须定义客户端只收到重放内容时如何保存位置。

`Runtime.deliver(..., when="step")` 只将输入入队，不会启动任务。没有活跃 Run 时，输入等待后续运行。自定义 Inbox 没有 push 方法时，使用其后端入队 API。通过 Query.answer 回答挂起的交互；普通追加消息不能替代待处理的工具结果。

代码依据：`src/flops_agent/wire.py:170`；`src/flops_agent/engine/runtime.py:876`；`src/flops_agent/engine/runner.py:844`。

## 存储与恢复

内存数据在退出后消失是预期行为，不是 recover 能修复的问题。先确认持久化后端和恢复能力，再检查调度数量及每个任务的最终状态。调度数大于零时，仍可能存在失败的回调。

复用 run_id 时，create_run 必须保留原日志。业务工具的幂等性要求执行端关联原任务。恢复编排不承诺跨系统恰好执行一次，也不会在多个实例间选举恢复主节点。

历史编辑抛出 TruncationNeedsConsent 时，先取得丢弃后续内容的同意。不要仅为绕过异常就默认设置 consent=True。未知消息 id 可能触发 MessageNotFound；请重新加载历史并核实选中的消息。

代码依据：`src/flops_agent/seams/run_store.py:25`；`src/flops_agent/engine/runtime.py:1154`；`src/flops_agent/entities/session.py:100`、`:138`。

## 配置与产品职责

如果模型返回完整文本、不兼容的数据块，或不支持工具调用，先检查提供方适配器。自动函数 schema 只推断字符串参数；复杂参数需要显式 schema 和业务校验。上下文压缩需要产品集成，不是 Runtime 的自动开关。

身份验证、HTTP 路由、用户授权、真实工具权限、持久化后端和凭据获取均属于产品职责。owner_id、run_id 和 cursor 本身都不是授权凭证。示例的静态安全检查不是完整的安全策略。

代码依据：`src/flops_agent/providers/openai.py:116`；`src/flops_agent/tools/schema.py:42`；`src/flops_agent/engine/runner.py:1040`。

## 下一步

定位问题后，在 [API 契约](api_surface.md)中核查参数。使用[产品清单](08-worked-example.md)添加可复现的集成场景。
