# 五分钟运行一个任务

**Reader question:** 不创建模型账号，能否确认框架在我的机器上正常工作？

**Prerequisites:** 阅读[框架边界](README.md)，安装 Python 3.10 或更高版本以及 Git。**Outcome:** 运行离线示例，观察一次完成的工具调用和一条记忆记录。

## 动手试试

首次安装时，克隆公开仓库。如果已有本地克隆，先进入该目录。以下命令使用类 Unix shell；在 Windows 上，使用虚拟环境中的 `python.exe` 执行相同的 Python 命令。

```sh
git clone https://github.com/Xenotech-Studio/flops-agent.git
cd flops-agent
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[providers]'
```

安装时需要联网下载依赖。示例本身使用固定脚本模拟模型，不需要 API 密钥，也不会发起真实模型请求。使用以下入口，避免已有环境变量意外启用占位网络端点：

```sh
python -c 'import os, runpy; os.environ.pop("EXAMPLE_PROVIDER_API_KEY", None); runpy.run_path("docs/sample_product/server.py", run_name="__main__")'
```

这会安装本地克隆中的代码。切换版本标签或修改代码都会改变实际运行的内容。本指南只依赖 v0.2.0 已有的接口。

## 检查结果

输出应包含两个示例标题：`Safe tool (scripted)` 和 `Persona and memory (scripted)`。第一个示例模拟模型请求 `run_command`；执行端返回包含 `$ ls`、`line-1` 和 `(done)` 的文本。随后模型输出 `The directory has been listed.`。最后，一条记忆记录应包含 `User said: My name is Ming`。

这说明模型输出已被消费，工具结果已返回执行流程，并且运行后的记忆维护已被调用。示例执行端生成固定文本：**它并没有实际执行 `ls`**。不要以真实目录列表作为成功标准。

如果没有看到结果，先检查工作目录和虚拟环境。`python -c 'import flops_agent; print(flops_agent.__file__)'` 应指向刚安装的包。如果导入失败，先重新执行安装步骤，再配置真实模型。

## 边界

命令执行完毕即退出。它不会监听端口，也不会启动浏览器、远程执行端或数据库。内存示例退出后不会保留对话。这些属于后续集成工作，不是完成首次运行的前提。

产品进程通常在启动时组装 Runtime，并在请求间共享它。不要为每个流连接重新创建 Runtime：新实例无法找到上一个实例持有的本地运行句柄。

## 下一步

阅读[理解任务如何运行](02-core-concepts.md)，再阅读[接入自己的模型](connect-model.md)。本页原先的服务入口内容已移至[订阅与重连](03-streaming-and-sse.md)和[产品集成](08-worked-example.md)。

## 代码依据

- `docs/sample_product/server.py:108`：确定性模型替身；`:69`：模拟执行端。
- `docs/sample_product/server.py:227`：入口和两个演示。
- `src/flops_agent/engine/runtime.py:1041`：Runtime 创建并保留运行句柄。
