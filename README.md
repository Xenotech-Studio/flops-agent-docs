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

主通道是本仓 `.github/workflows/sync-docs.yml`（`Sync English docs from flops-agent`）：
每 30 分钟运行一次（`cron: '*/30 * * * *'`），从公开源仓 `master` 拉取，
只镜像到本仓 `main` 的 `docs/en/**`。也可通过 `workflow_dispatch` 手动立即请求同步。
**无需创建任何 secret 或跨仓 token**：源仓公开可读，本仓写入使用自动提供的
`GITHUB_TOKEN` 与工作流声明的 `permissions: contents: write`。

提交作者为 `flops-agent-docs-sync[bot]`，信息为
`chore(sync): mirror docs from Xenotech-Studio/flops-agent@<full-sha>`。
记录实际读取的完整源 SHA；没有文件差异时不产生提交，文件删除也同步。
`GITHUB_TOKEN` 的 push 不会触发下游工作流，所以同步任务在推送后自行执行
`cd target/website && npm ci && npm run build`；无变化时也保留构建校验。

代价是正常调度下需等待下一轮，计划等待最多约 30 分钟，另加执行时间；
**不是严格的 30 分钟送达保证**：GitHub 高负载时可能延迟甚至丢弃计划任务。
公开仓库连续 60 天无活动，计划任务会自动停用，届时需重新启用。
计划任务只在默认分支运行；手动入口可用于及时补同步。
参见 [GitHub schedule 文档](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

可选升级：若将来需要即时推送同步，创建 fine-grained PAT，资源所有者选
Xenotech-Studio，仓库仅选 `flops-agent-docs`，授予 **Contents: read and write**，
存入源仓 Actions secret **`FLOPS_AGENT_DOCS_SYNC_TOKEN`**。
源仓 `docs-sync-publish.yml` 即在后续 master 的 `docs/**` push 时生效；也可手动触发。
未配置该 secret 时，只输出跳过说明，checkout、镜像和推送步骤均跳过，任务成功结束。
这只是可选增强，不是定时同步的前置步骤。

手动和定时拉取共享 concurrency，避免本仓同步并行；若启用可选推送，两仓锁不互通，
并发推送冲突会安全失败（不强推），可等待下一轮或手动重跑。
默认 token 仍受仓库规则约束；若 main 有禁止直接写入的保护规则，需要允许该同步身份。

## 发布与职责

CI 的终点是镜像入仓及构建校验。网站仍由作者在服务器人工构建上线，未改变部署方式。
源仓 `deploy/nginx-flopsruntime.conf` 暂保留。未来目标是 nginx 服务本仓
`website/dist/`（或作者现有发布目录中的该构建产物），实际切换由作者另行执行。
本轮没有修改 nginx、线上文件、服务或 openclaw。详见 [MIGRATION.md](MIGRATION.md)。
