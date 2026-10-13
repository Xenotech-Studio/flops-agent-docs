# 更新日志

本文件记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，
项目遵循[语义化版本](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### 新增

- 为提供方流数据块、工具调用与结果、
  调度记录和运行元数据提供类型化边界契约。
- 在公开智能体事件联合类型中加入交互事件，并为
  支持的导入范围添加契约测试。

### 变更

- 在框架边界规范化提供方数据块，收紧嵌入框架的应用所需的
  运行时契约。
- 明确中立的 Session 和工具包扩展点。

## [0.2.0] - 2026-09-14

### 新增

- 可独立安装的服务端智能体内核，提供运行生命周期、
  SSE 流、取消、挂起、持久化、恢复、压缩
  和工具调度原语。
- 为传输加密显式注入 `TransportKey` 值对象。
- 提供 `src/` 包布局、类型化公开门面、可运行的示例产品，
  以及面向框架使用者的教程文档。

### 变更

- 移除部署环境特定假设，让内核接收显式值
  和应用提供的接口，而不读取主机配置。
- 修正在稳定公开 API 过程中发现的生命周期、流重试、压缩、加密
  和持久化边界问题。

[Unreleased]: https://github.com/Xenotech-Studio/flops-agent/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Xenotech-Studio/flops-agent/releases/tag/v0.2.0
