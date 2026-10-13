# 站点拆仓交接记录

## 本轮完成

工作树：`/home/ubuntu/flowseries/flops-agent-docs`。本次设计调整未提交、未推送。
源仓：`/home/ubuntu/flowseries/flops-agent`，默认分支经远端核实为 `master`；新仓默认分支 `main`。

1. 原站点 36 个跟踪文件完整迁入 `website/`，相对结构不变。仅修改同步器和已有测试的文档输入路径。
2. 英文 26 个跟踪文件完整镜像到 `docs/en/`，英文真源仍在产品仓；发布清单留在站点仓，仍发布 17 篇。
3. 中文目录预留 `.gitkeep`；同步器可读取同名中文文章并生成内部内容，缺失则跳过。本轮无中文翻译、无公开中文 URL。
4. 源仓新增 `scripts/mirror-docs.sh` 和 `.github/workflows/docs-sync-publish.yml`。
   同步脚本使用 git 跟踪清单、临时目录及 rsync，只修改目标 `docs/en/`；支持更新与删除。
   工作流在暂存区无差异时退出，不创建空提交；提交记录实际读取的完整源 SHA。
5. 新仓添加定时/手动拉取同步、站点构建校验、翻译占位三个工作流。
   定时拉取是主流程，使用同一源仓脚本；源仓推送保留为可选增强，没有双向同步。
6. 原仓 CI 移除已迁走的 website-build job，产品测试任务保留；README 写明分工。
7. 原仓 36 个站点跟踪文件已删除。**本机 `website/` 仍有被 Git 忽略的旧 dist、依赖和生成文件**：
   nginx 配置正指向旧 `website/dist`，为遵守“不动线上”保留它们。不要在切换前执行 `git clean -fdx` 或删除这个目录。
   Git 提交中会完整删除 `website/`；服务器物理目录最后清理由作者在后续切换完成后处理。

## 验证证据

- [完整新仓文件清单](evidence/new-worktree-files.txt)（排除依赖、构建产物及生成缓存）。
- [36 个迁移文件](evidence/website-migrated-files.txt)。
- [构建输出](evidence/build.txt)：在新仓 `website/` 执行 `npm ci && npm run build` 成功。
- [测试输出](evidence/tests.txt)：已有 Markdown/文档过滤测试 6 项通过。
- [同步与 URL 兼容验证](evidence/verification.txt)：临时源副本修改 README，第一遍更新镜像，第二遍零输出且哈希相同；
  额外验证删除同步、其它目录不受影响。演练后恢复镜像为真实英文源，源仓 docs 从未改动。
  英文生成 Markdown、页面元数据和搜索 JSON 与原同步器生成结果逐字节一致；React 路由未改动。
  临时中文样板可生成内部数据，移除后旧生成物清理，英文索引不变。
- [源仓 git status](evidence/source-git-status.txt)：36 项删除、新增同步工作流与脚本、CI/README 修改。
- 本地 bash 语法检查与 `git diff --check` 通过；GitHub Actions 的实际运行需文件推送后验证，不需要配置 secret。

## 无 secret 的主同步通道

`sync-docs.yml` 名为 `Sync English docs from flops-agent`，通过
`cron: '*/30 * * * *'` 每 30 分钟执行，也支持 `workflow_dispatch` 手动立即请求同步。
检出公开源仓 master（不持久化凭据），再检出本站 main，调用现有镜像脚本。
仅当 docs/en 有差异才以 `flops-agent-docs-sync[bot]` 提交并推送，提交信息携带完整源 SHA。
本仓默认 `GITHUB_TOKEN` 配合 `contents: write` 即可完成写入，不需要任何自建 token 或 secret。
默认 token 推送不会触发下游工作流，因此本任务随后自行执行 npm ci 与 npm run build；
无差异仅退出镜像步骤，仍执行构建校验。

正常调度下等待下一轮最多约 30 分钟，另加任务执行时间；GitHub 调度可能延迟或丢弃任务，
所以这不是严格的 30 分钟延迟上限。公开仓库连续 60 天无活动会自动停用计划任务，
届时需重新启用；定时工作流必须存在于默认分支。
[官方 schedule 说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

## 可选即时推送升级

仅在将来需要源仓文档 push 后即时同步时，创建 fine-grained PAT：目标仅选择
`Xenotech-Studio/flops-agent-docs`，授予 **Contents: read and write**，
在源仓 Actions secrets 中保存为 **`FLOPS_AGENT_DOCS_SYNC_TOKEN`**。
源仓 workflow 在后续文档 push 时启用即时同步，或通过手动入口立即请求执行。
未配置时成功输出跳过说明，不检出、不镜像、不推送，不因缺失 secret 报错。

实现使用 job 级 `env.SYNC_TOKEN` 映射 secret，在各个 `steps[].if` 中判断它。
job 级 if 只保留默认分支条件，不使用 env 或 secrets。
依据：[上下文可用性表](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability)
与 [secret 条件使用说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#using-secrets-in-a-workflow)。

## 作者需要做的事

**本次设计不增加任何必需配置步骤：零个 secret，零个自建 token。**
按约定由作者提交并推送这四个文件；源仓现有镜像脚本也须已在 master（沿用前轮迁移交接）。
文件进入默认分支后自动定时拉取，不要求手动首次触发；想立即验证可手动运行 docs 仓同步。
本轮不代替作者执行 commit/push，也没有创建 secret 或生成 token。
默认 token 仍受仓库保护规则约束；若 main 禁止自动化直接推送，需允许同步身份。

网站仍由人工构建上线。本轮不切 nginx，不修改部署方式；旧配置及旧 dist 继续保留。
未来择时使用新仓 website/dist 产物，nginx 切换及旧物理目录清理由作者在后续发布时处理。

## 下一轮

翻译发布清单中的 17 篇中文；补齐中文导航、分组、发布提示及标题别名；确定语言前缀与兼容策略；
实现语言切换、分语言搜索、链接改写、canonical/hreflang；实现 translate.yml、翻译版本追踪与人工审阅。
本轮历史 `/docs/<slug>`、`/docs-source/<slug>.md`、`/docs-index.json` 不变。

## 已知限制与未验证项

- 本轮未在 GitHub 运行工作流，因此不声称定时任务或 bot 提交已实际发生；secret 不再是前置条件。
- 若启用可选即时推送，两仓 concurrency 不互通；同时写 main 的非快进推送会失败且不会强推，重跑可恢复。
- 当前公开源仓允许新仓定时/手动拉取无额外源 token；将来转私有需补源仓读取凭据。
- 默认分支将来若改名，更新源仓 push branches 及新仓拉取 checkout ref。
- 构建成功但 Vite 提示 JS chunk 超过 500 kB（约 522 kB）；本轮保留原站点行为。
- 未修改或验证服务器实际生效的 nginx 配置、未测试线上发布；保留旧产物避免影响当前服务。
