# 控制长对话中的模型输入

**Reader question:** 如何缩减不断增长的模型输入，同时保留用户的事实记录？

**Prerequisites:** 理解[会话持久化](04-sessions-and-persistence.md)。**Outcome:** 区分临时投影与存储的摘要，为产品选择可验证的集成路径。

## 先选择策略

| 需求 | 方式 | 是否改变对话历史？ |
|---|---|---|
| 缩减旧工具输出，或只保留必要字段 | 读取时投影 | 不应改变 |
| 用摘要替换一长段输入 | 结合摘要生成、存储和投影 | 保留原始历史，单独存储摘要 |
| 响应明确的删除或回退请求 | Session 编辑接口 | 会改变；需处理用户同意与持久化 |

默认 `Runner.project_messages()` 返回历史本身。它在每次组装模型请求时运行，不是自动的后台压缩服务。

## 动手试试：让投影可复现

在 Runner 中覆写 project_messages，为本次请求返回一个新列表。以下为集成示意：产品必须实现 project_for_model，它不是框架函数。

```python
from copy import deepcopy
from flops_agent import Runner

class ProductRunner(Runner):
    async def project_messages(self):
        history = deepcopy(self.messages)
        return project_for_model(history)
```

同样的输入应得到同样的投影结果。可以先缩短旧工具结果中的文本字段，同时保留对应调用、结果 id、角色和顺序。不要简单截取最后 N 条消息：这可能将 assistant 工具调用与其工具结果拆开。深拷贝可防止嵌套字段的编辑修改 Session。

## 需要摘要时补齐存储路径

`flops_agent.engine.compaction` 提供 ProjectionConfig、CompactionPolicy 等组件；CompactionStore 存储摘要记录。产品仍需提供模型窗口大小、摘要模型、允许写入的时机和持久化后端，再将摘要纳入请求投影。

不存在自动的 `Runtime(compaction=True)` 开关。本文没有提供完整的摘要服务：缺少窗口和存储约束时，无法安全决定要覆盖哪些历史。连接这些组件前，先定义覆盖区间、需保留的近期历史、摘要版本和回退视图。

## 检查结果

对包含工具调用的同一份历史投影两次。结果应一致，原始 Session 的每个字段都应保持不变。检查每个保留的工具结果都有对应调用、近期用户请求仍然存在，并且序列化输入满足目标模型要求。摘要失败时，使用产品保守的回退视图，不要删除原始历史。

字符数或 token 数估算不能保证提供方的计费结果或上下文校验结果。需验证真实请求能被接受，并符合产品输入预算。

## 下一步

下一步，阅读[接入长期记忆](long-term-memory.md)。控制当前请求的历史输入后，进一步区分会话历史与可复用记忆，了解记忆的读取和维护时机。

如果你想直接去看：

- [为智能体添加工具](07-extending.md) —— 接入业务函数并验证工具调用。
- [选择扩展点](customize-runner.md) —— 自定义其他运行时策略。

## 代码依据

- `src/flops_agent/engine/runner.py:1040`、`:1070`：投影与请求构造。
- `src/flops_agent/engine/compaction.py:187`、`:1196`：投影配置与压缩策略组件。
- `src/flops_agent/seams/compaction_store.py:1`：独立摘要存储；本文只描述 v0.2.0 已有的基础接口。
