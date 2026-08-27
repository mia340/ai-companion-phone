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
V0.4.7.0
IndexedDB V14
Backup V9
```

本版本重点是 Character Card V2/V3 兼容校准；WorldBook Engine V2 继续保留。继续开发前建议阅读：

1. `PROJECT_STATUS.md`
2. `ARCHITECTURE.md`
3. `COMMUNITY_RUNTIME.md`


## 测试分工说明

普通使用者不需要手工创建 Selective Logic / Recursion / Sticky / Cooldown / @D / Outlet 测试数据。
这些属于协议级开发测试，由项目测试代码与开发回归负责。

你更新后只需要做真实使用验收：

1. 打开一张复杂社区角色卡，普通回复后作者要求的固定状态/UI 是否继续出现；
2. 打开论坛/微信等按需资源，确认能触发并继续；
3. 切换纯手机/场景合并，确认显示方式符合设置；
4. 打开“世界 → 资源库”，确认任何长文件名/角色名都不会把页面撑出手机宽度。

## 角色卡兼容问题怎么反馈

遇到角色卡不按作者设定、开场、世界书或 UI 工作时，不需要手工造 Selective Logic 测试。请提供：

1. 角色卡本身（可分享时）；
2. 实际操作步骤；
3. 截图；
4. Prompt Debug。

V0.4.7.0 起 Prompt Debug 的 `Character Card Runtime` 会显示卡版本、`{{char}}` 宏名、system prompt 模式、creator_notes 是否进 Prompt；协议级组合由开发回归负责。
