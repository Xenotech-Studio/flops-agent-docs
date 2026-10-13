# 站点拆仓交接记录

## 本轮完成

新工作树：`/home/ubuntu/flowseries/flops-agent-docs`。未初始化 Git、未提交、未推送。
源仓：`/home/ubuntu/flowseries/flops-agent`，默认分支经远端核实为 `master`；新仓默认分支 `main`。

1. 原站点 36 个跟踪文件完整迁入 `website/`，相对结构不变。仅修改同步器和已有测试的文档输入路径。
2. 英文 26 个跟踪文件完整镜像到 `docs/en/`，英文真源仍在产品仓；发布清单留在站点仓，仍发布 17 篇。
3. 中文目录预留 `.gitkeep`；同步器可读取同名中文文章并生成内部内容，缺失则跳过。本轮无中文翻译、无公开中文 URL。
4. 源仓新增 `scripts/mirror-docs.sh` 和 `.github/workflows/docs-sync-publish.yml`。
   同步脚本使用 git 跟踪清单、临时目录及 rsync，只修改目标 `docs/en/`；支持更新与删除。
   工作流在暂存区无差异时退出，不创建空提交；提交记录实际读取的完整源 SHA。
5. 新仓添加接收式手动补同步、站点构建校验、翻译占位三个工作流。
   主动推送是主流程，手动接收使用同一源仓脚本，没有双向同步。
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
- 本地 bash 语法检查与 `git diff --check` 通过；GitHub Actions 的实际跨仓运行需作者配置 token 并推送后验证。

## 作者必须手动完成

1. **初始化并首次推送新仓**（本轮没有执行）：

   ```bash
   cd /home/ubuntu/flowseries/flops-agent-docs
   git init -b main
   git remote add origin git@github.com:Xenotech-Studio/flops-agent-docs.git
   git add .
   git commit -m "feat(docs): migrate website and scaffold English mirror and i18n"
   git push -u origin main
   ```

   若远端已有初始提交，先自行衔接历史，不要强推。

2. 创建 fine-grained PAT，资源所有者 Xenotech-Studio，仓库仅选择 `flops-agent-docs`，
   授予 **Contents: read and write**。在源仓 **Settings → Secrets and variables → Actions**
   新增 **`FLOPS_AGENT_DOCS_SYNC_TOKEN`**；若组织需要审批，完成审批。
   两仓需允许 Actions，新仓分支规则需允许同步身份直接写 main。

3. **提交并推送源仓改动**：

   ```bash
   cd /home/ubuntu/flowseries/flops-agent
   git add README.md .github/workflows/ci.yml .github/workflows/docs-sync-publish.yml scripts/mirror-docs.sh
   git add -u -- website
   git commit -m "refactor(docs): move website to flops-agent-docs and publish English mirror"
   git push origin master
   ```

   提交范围：README、CI 调整、新工作流、新脚本、website 的 36 项删除。`docs/**`、nginx 配置不需提交。
   上述提交自身没有修改 `docs/**`，故**不会自动触发 path-filtered 同步**。
   两仓就绪后手动运行源仓 `Mirror English documentation`（workflow_dispatch）做首次联通校验；
   若新仓镜像一致，应无新提交。下次 master 上 docs 变化应生成一个 bot 提交，再次同步应无提交。
   也可用新仓 `Receive English docs (manual recovery)` 补同步。

4. **网站仍然人工构建上线**。本轮不要切 nginx；旧配置和旧 dist 继续保留。
   未来作者择时在新仓运行 `cd website && npm ci && npm run build`，
   按现有发布流程使用该产物。若需要切 root，目标为新仓 `website/dist/` 或既有发布目录，
   由作者另行处理 nginx 配置和切换检查；本轮没有修改 `/etc/nginx`、配置文件或重启服务。
   切换完成再处理旧 `website/` 物理残留，以及源仓 `deploy/nginx-flopsruntime.conf` 的归属。

## 下一轮

翻译发布清单中的 17 篇中文；补齐中文导航、分组、发布提示及标题别名；确定语言前缀与兼容策略；
实现语言切换、分语言搜索、链接改写、canonical/hreflang；实现 translate.yml、翻译版本追踪与人工审阅。
本轮历史 `/docs/<slug>`、`/docs-source/<slug>.md`、`/docs-index.json` 不变。

## 已知限制与未验证项

- 尚未配置 secret 或在 GitHub 运行工作流，因此无法声称跨仓 bot 提交已实际发生。
- 两仓 concurrency 不互通；同时写 main 的非快进推送会失败且不会强推，重跑可恢复。
- 当前公开源仓允许新仓手动接收无额外源 token；将来转私有需补源仓读取凭据。
- 默认分支将来若改名，更新源仓 push branches 及新仓补同步 checkout ref。
- 构建成功但 Vite 提示 JS chunk 超过 500 kB（约 522 kB）；本轮保留原站点行为。
- 未修改或验证服务器实际生效的 nginx 配置、未测试线上发布；保留旧产物避免影响当前服务。
