# GitHub 更新与部署方法

当前示例版本：**V0.4.4.7**。以后版本只需要替换源码目录名和 commit 文案。

## 1. 解压新源码

例如：

```text
D:\ai\ai-companion-phone-v0.4.4.7
```

确认这个目录直接包含：

```text
package.json
src
docs
scripts
public
```

不要出现两层同名套娃目录。

## 2. 覆盖到 Git 工作目录

保留 `.git`、`node_modules` 和旧 `dist`，只覆盖源码：

```powershell
cd "D:\ai"

robocopy `
  ".\ai-companion-phone-v0.4.4.7" `
  ".\ai-companion-phone-git-clean" `
  /E `
  /XD .git node_modules dist `
  /XF "*.tsbuildinfo" `
  /R:2 `
  /W:1
```

Robocopy 最后必须确认：

```text
失败        0
```

## 3. 检查版本

```powershell
cd "D:\ai\ai-companion-phone-git-clean"
Select-String '"version"' package.json
```

V0.4.4.7 应看到：

```text
"version": "0.4.4.7"
```

## 4. Build

```powershell
npm run build
```

正常流程：

```text
prebuild
vue-tsc -b
vite build
PWA generateSW
```

`Some chunks are larger than 500 kB` 是性能 warning，不等于构建失败。

如果出现任何 `error TSxxxx`、Vue 编译错误或 Vite error：**不要 commit / push**，把完整日志保存下来排查。

## 5. 本地测试

构建通过后可以：

```powershell
npm run dev
```

同 Wi-Fi 手机测试：

```powershell
npm run dev -- --host 0.0.0.0
```

正式 Pages 地址：

```text
https://mia340.github.io/ai-companion-phone/#/
```

## 6. 测试通过后 Git

```powershell
git status
git add .
git status
```

确认变更都在 `Changes to be committed` 后：

```powershell
git commit -m "refactor: 多会话场景状态与社区UI编译 v0.4.4.7"
git push origin main
```

如果 commit 已成功，但 push 只是：

```text
Failed to connect to github.com:443
```

不要重复 commit。网络恢复后只重新：

```powershell
git push origin main
```

## 7. GitHub Pages

当前仓库已有 `.github/workflows/deploy.yml`。`main` push 成功后，到 GitHub → Actions 查看部署任务；成功后再打开正式网址回归测试。

## 8. 每次发布的安全顺序

```text
覆盖源码
→ 检查版本
→ npm run build
→ 本版专项测试
→ git status
→ git add .
→ git commit
→ git push
→ GitHub Actions / Pages
→ 正式网址再测一次
```
