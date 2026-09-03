# 从这里开始

当前开发线：**V0.5.0-alpha.3**。

如果你只是想把我给你的新源码更新到 Git 仓库，直接先看：`部署与更新.md`。

## 环境

建议：

```text
Node.js 20+
npm
Windows PowerShell
Git
```

## 第一次运行

```powershell
cd "D:\ai\ai-companion-phone-git-clean"
npm ci
npm run dev
```

浏览器打开终端给出的本地地址。

## 每次收到新源码后的固定顺序

不要上来就 commit。固定执行：

```text
确认基线版本
→ 覆盖源码
→ npm run cleanup
→ npm test
→ npm run build
→ 专项真机测试
→ git diff --check
→ git add / commit / push
```

完整 PowerShell 命令见 `部署与更新.md`。

## 当前 V0.5 重点

V0.5 不是继续堆新 App，而是把已有功能收敛成稳定 Runtime。alpha.3 当前重点：

- delete / reset / rewind / branch / opening reset 使用统一 Conversation Runtime；
- 从旧消息建立分支时按目标时间点重放状态，避免未来 Memory / State 穿越；
- greeting / free opening 的跨表清理不再由 ChatRoom 手写；
- 测试矩阵目标升级为 21 个测试文件 / 155 个用例；
- alpha.3 全绿后再开始拆 Generation Orchestrator。

项目全貌看 `PROJECT_STATUS.md`，为什么这么改看 `ENGINEERING_AUDIT.md`。

## Build

```powershell
npm test
npm run build
```

如果出现 `TSxxxx` 或测试 `FAIL`，不要急着改代码，把完整日志发出来。

## 手机测试

优先测真实角色卡，不要求你手工构造协议数据。每次底层更新至少回归：

- 普通纯文字角色；
- WorldBook；
- Regex / HTML；
- Persona；
- 多聊天 / Branch / Rewind；
- 三种聊天呈现方式。

## 图片理解

图片理解依赖当前 Provider / 模型是否支持视觉。失败时请同时提供：

- 模型名；
- Provider；
- 页面提示；
- 浏览器控制台 / Network 中的关键错误。

不要发送 API Key。

## 记忆管理

记忆分为自动、手工、导入等来源。V0.5 的 Conversation Mutation 原则是：

- 删除/回滚旧剧情可以清理失效的**自动记忆**；
- 手工 / 导入记忆不能因为普通消息删除被误删；
- 真正“清空全部记忆”仍由记忆管理中的专门操作负责。

## 角色卡兼容问题怎么反馈

最有效的信息：

1. 角色卡格式（JSON / PNG / V2 / V3）；
2. 哪个开场/哪条消息触发问题；
3. 期望结果 vs 实际结果；
4. Prompt Debug；
5. 如果是 UI 问题，提供截图；
6. 如果 Build 失败，提供完整终端日志。

生产逻辑禁止为了单个测试角色增加角色名、作者名、卡 ID、文件名特判。
