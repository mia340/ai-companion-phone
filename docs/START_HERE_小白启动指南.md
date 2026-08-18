# 从这里开始

## 环境

Node.js 20+，VS Code 打开完整项目目录。

## 第一次运行

```bash
npm install
npm run dev
```

## 更新源码

完整流程见 `部署与更新.md`：

```text
解压
→ robocopy
→ 检查版本
→ npm run build
→ 测试
→ git commit
→ git push
```

## Build

```bash
npm run build
```

看到 `built in` 与 `dist/sw.js` 表示构建完成；出现 `error TSxxxx` 时先停止提交。

## 手机测试

```bash
npm run dev -- --host 0.0.0.0
```

手机与电脑同一 Wi‑Fi，打开终端给出的局域网地址。

## 图片理解

```text
设置 → API 与模型 → 图片理解
```

## 记忆管理

```text
聊天页 → 右上角 ··· → 记忆 → 打开完整记忆管理
```

## 当前版本

```text
V0.4.4.7.2
IndexedDB V14
Backup V9
```

本版本仅整理文档。继续开发前建议阅读：

1. `PROJECT_STATUS.md`
2. `ARCHITECTURE.md`
3. `COMMUNITY_RUNTIME.md`
