打开 GitHub 仓库网页，依次点击：

Settings
→ Pages

在：

Build and deployment
→ Source

选择：

GitHub Actions

GitHub 官方说明，自定义构建项目应在 Pages 中选择 GitHub Actions 作为发布源。

接着点击仓库顶部：

Actions

找到：

Deploy AI Companion Phone

等待绿色对勾。成功后网站通常是：

https://mia340.github.io/ai-companion-phone/

部署后的网页会拥有一套新的 IndexedDB，因此本地 Edge 中已有的苏晚、头像和聊天记录不会自动出现在在线网站中；在线版首次打开会使用初始化数据。

点击最上面的输入框：
Summary (required)
输入：
deploy: 配置 GitHub Pages 自动部署
下面的大框 Description 可以留空。
点击：
Commit 7 files to main

提交完成后，顶部会出现：

Push origin

再点击它上传到 GitHub。

另外，你列表中的 tsconfig.node.tsbuildinfo 仍被 Git 跟踪，所以即使加入了 .gitignore，它现在还会显示。先完成这次提交部署，之后再把这个缓存文件从 Git 跟踪中移除。