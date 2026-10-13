# 查找所需的契约

**Reader question:** 我已经知道要做什么。在哪里查参数、限制和版本？

**Prerequisites:** 无；新用户应从[学习](README.md)开始。**Outcome:** 找到问题的权威入口，无需重读整套教程。

## 按问题查找

| 问题 | 查找位置 |
|---|---|
| 如何启动、停止、订阅或恢复 Run？ | [API 契约](api_surface.md)中的 Runtime 与会话操作 |
| Database 或 RunStore 必须实现什么？ | [API 契约](api_surface.md)中的存储与扩展协议 |
| 为什么断线后任务仍在继续，或者运行句柄不见了？ | [诊断故障并检查限制](errors-and-limits.md) |
| cursor、Run 和 Session 是什么意思？ | [术语表](glossary.md) |
| 某项变更是否已发布？ | [更新日志](CHANGELOG.md) |

参考部分用于查阅，不替代分步骤教程。每篇学习文档都有代码依据，列出仓库路径和行号。实现细节请查看对应版本的源码。

## 版本边界

文档以已发布的 v0.2.0 能力为基线，并对照本地克隆的实现核查。源码分支可能持续演进。在分支上发现新方法，不代表已安装版本包含它。升级前比较发布说明和安装版本。

更新日志页面及其 Markdown 导出都只包含已发布版本的章节。

## 智能体入口

[文档索引](/zh-CN/docs-index.json)包含各页的标题、分区、分组、canonical_url、markdown_url 和可搜索标题。section 为 learn 或 reference。group 与发布清单中的顺序描述学习路径。

每页的“原始 Markdown”链接和“复制页面 Markdown”按钮使用同一份构建生成文本，顶部含 section 和 canonical 元数据。英文源 URL 形如 `/docs-source/api_surface.md`；它们不会重定向到 GitHub。本页英文版位于 `/docs-source/reference.md`，中文版位于 `/docs-source/zh-CN/reference.md`。

调整分区或章节不会改变已有页面 URL。需要引导式学习时，返回[学习](README.md)；调试时可直接查看[错误与限制](errors-and-limits.md)。

## 代码依据

- `src/flops_agent/__init__.py:1`：包的公开门面及其边界。
- `src/flops_agent/engine/runtime.py:1041`：实际的 start 参数；API 页面分别列出了其他入口的位置。
