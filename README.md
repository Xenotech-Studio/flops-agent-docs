# flops-agent-docs

站点、发布选择、翻译与人工发布工作树。英文唯一真源是
[Xenotech-Studio/flops-agent](https://github.com/Xenotech-Studio/flops-agent) 的 `docs/`。
**不要把本仓当英文文档主编辑处。`docs/en/**` 是自动生成的镜像，勿直接编辑。**

- `website/`：迁来的 36 个站点文件；`website/scripts/docs-sources.json` 决定发布哪些文章（当前 17 篇），不影响完整镜像。
- `docs/en/`：完整镜像英文源，包括未列入站点发布清单的文件。
- `docs/zh-CN/`：中文预留；下一轮翻译 17 篇。
- `.github/workflows/site-build.yml`：PR、main push 和手动构建校验，不部署。
- `.github/workflows/translate.yml`：仅手动占位，无翻译行为。

## 本地构建

```bash
cd website
npm ci
npm run build
```

使用 Node 20.19+。默认从本仓 `docs/en/` 读取英文；可设置绝对路径
`FLOPS_AGENT_DOCS_DIR=/absolute/path/to/english/docs` 覆盖英文输入。
中文从 `docs/zh-CN/` 读取，沿用发布清单的文件名：存在则生成到
`website/src/content/i18n/zh-CN/`，缺失则跳过。删除中文输入后会清掉旧生成物。
中文生成物暂不接入公开导航、搜索或路由，也不套用英文标题别名与英文发布提示。

## URL 策略

本轮保持 `/docs`、`/docs/<slug>`、`/docs-source/<slug>.md`、`/docs-index.json`
及英文标题锚点不变，不加 `/en/`、`/zh/` 前缀。下一轮确定语言路由，加入语言切换、
本地化链接/导航/搜索、canonical 与 hreflang，并为所有历史英文 URL 保留兼容入口或重定向。
内部中文元数据中的路由仍是英文占位，不可直接发布。

## 英文自动镜像

主路径由源仓 `.github/workflows/docs-sync-publish.yml` 在默认分支 `master` 的
`docs/**` push 后运行，向本仓 `main` 的 `docs/en/**` 提交；只镜像此目录。
提交作者为 `flops-agent-docs-sync[bot]`，信息为
`chore(sync): mirror docs from Xenotech-Studio/flops-agent@<full-sha>`。
同步读取运行时源仓默认分支最新 HEAD，并记录该完整 SHA，防止重跑旧任务覆盖新文档。
没有文件差异时不产生提交。文件删除也同步。

**作者必须手动做一步：**创建 fine-grained PAT，资源所有者选 Xenotech-Studio，
仓库仅选 `flops-agent-docs`，授予 **Contents: read and write**，然后在
`flops-agent → Settings → Secrets and variables → Actions → New repository secret`
添加 **`FLOPS_AGENT_DOCS_SYNC_TOKEN`**。若组织要求审批，先批准该 token。
源仓默认 `GITHUB_TOKEN` 只有源仓读取权限，无法代替跨仓 token。

新仓 `sync-docs.yml` 选择 **workflow_dispatch 接收式补同步**，从源仓 master 拉取，
使用同一个镜像脚本；不增加 repository_dispatch 链路。源仓主动推送与参考分工一致，
新仓手动入口便于漏同步恢复。该入口使用本仓 `GITHUB_TOKEN` 的 contents: write，
其提交不会触发其他 workflow，因此在本任务内也做构建校验。
两个仓的任务无法共享 concurrency 锁；并发推送冲突会安全失败（不强推），重跑即可。
仓库规则需要允许该身份直接写 main；如启用了必须 PR 规则，作者需自行配置允许的自动化身份。

## 发布与职责

CI 的终点是镜像入仓及构建校验。网站仍由作者在服务器人工构建上线，未改变部署方式。
源仓 `deploy/nginx-flopsruntime.conf` 暂保留。未来目标是 nginx 服务本仓
`website/dist/`（或作者现有发布目录中的该构建产物），实际切换由作者另行执行。
本轮没有修改 nginx、线上文件、服务或 openclaw。详见 [MIGRATION.md](MIGRATION.md)。
