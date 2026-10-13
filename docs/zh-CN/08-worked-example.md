# 将示例集成到产品

**Reader question:** 示例已经能运行了。要让浏览器连接到产品，还缺哪些部分？

**Prerequisites:** 完成[流式订阅](03-streaming-and-sse.md)、[会话存储](04-sessions-and-persistence.md)和[工具演练](07-extending.md)。**Outcome:** 沿请求路径补齐产品边界，通过可观测场景验证，而不只是复制示例文件。

## 从能运行的示例开始

再次运行[五分钟指南](01-quick-start.md)中的离线命令。这次带着一个问题读代码：每个输入、工具结果和 SSE 帧在哪里跨越了产品边界？

| 示例位置 | 演示内容 | 产品仍需实现 |
|---|---|---|
| server.py 中的 build_runtime | 组装模型、工具、存储和 Runner | 真实模型与持久化后端配置 |
| handle_chat_request | 加载 Session、创建 Query、启动 Run、产出 SSE | HTTP 路由、身份验证和对话访问检查 |
| ExecutorAdapter | 模拟增量输出 | 真实工具执行、授权和远程任务关联 |
| handle_cancel | 按会话请求停止 | 产品停止端点和归属检查 |
| on_startup | 调用 recover 的位置 | resume 内的实际重建逻辑 |

`docs/sample_product/local_executor.py` 和 `frontend.html` 展示了集成的另外两端。运行 server.py 不会自动把三者连接成网络服务。示例中的命令检查也只是演示，不构成完整的安全保证。

## 动手试试：补齐请求路径

1. 在产品启动时组装并保留 Runtime。先使用 ScriptedLLM，让网络集成可复现，再换成真实模型。
2. 在 Web 框架中实现提交端点：验证用户身份，取得已授权的 Session，构造 Query，返回 run_id 并发送 SSE。
3. 在客户端保存服务端游标，按 run_id 重连。将请求路由到能提供该运行或其持久化日志的位置。
4. 实现显式停止端点，将停止意图传递到真实执行端。不要把断线等同于取消。
5. 注入 Database 和 RunStore，分别验证持久化能力。完成[恢复练习](06-recovery.md)后，再承诺支持重启后继续。

这些步骤不指定 Web 框架，也不假设存在 serve API。保留产品的 HTTP 层，将运行句柄连接到流式响应。

## 检查结果

| 场景 | 应观察到的结果 |
|---|---|
| 在同一对话中连续提问 | 第二轮加载第一轮的历史 |
| 一次工具调用 | 能看到增量输出，最终结果进入历史 |
| 关闭浏览器后重连 | 断线不停止执行；由协议确定重放位置 |
| 点击停止 | 运行最终进入 stopped，执行端收到取消意图 |
| 另一用户请求同一运行 | 产品授权拒绝访问，不会仅凭 run_id 放行 |
| 进程重启 | 持久化历史仍在；恢复成功或失败都有可观测终态 |

扩展工具、记忆或多进程路由前，先将这些场景转化为产品集成测试。一次成功的示例运行不能代替这些检查。

## 下一步

学习部分至此覆盖了完整路径：运行、集成、保留状态、扩展和验证。在 [API 契约](api_surface.md)中查找方法，在[错误与限制](errors-and-limits.md)中排查行为，升级前检查[已发布变更](CHANGELOG.md)。

## 代码依据

- `docs/sample_product/server.py:172`：build_runtime；`:187`：请求处理函数；`:200`：停止；`:208`：恢复占位实现。
- `docs/sample_product/server.py:69`：模拟执行端，不是真正的命令执行服务。
- `src/flops_agent/engine/runtime.py:1041`、`:1154`：执行与恢复入口。
