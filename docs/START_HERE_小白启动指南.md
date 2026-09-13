# 从这里开始

当前开发线：**V0.5.0-alpha.4.2.1**。

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

V0.5 仍以稳定 Runtime 为主；用户新增朋友圈 / 音乐 / 海龟汤后，alpha.3.1 先把这些 App 纳入可靠性门禁：

- delete / reset / rewind / branch / opening reset 使用统一 Conversation Runtime；
- 从旧消息建立分支时按目标时间点重放状态，避免未来 Memory / State 穿越；
- greeting / free opening 的跨表清理不再由 ChatRoom 手写；
- 当前源码测试矩阵为 26 个测试文件 / 244 个用例；
- 新增 App 全绿后，再继续拆 Generation Orchestrator；不要在红灯时继续加功能。

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

主屏幕直接打开 **“记忆” App**。完整的查看、编辑、锁定、冲突处理、删除与“角色共享 / 仅当前聊天”切换都集中在那里。

聊天右上角设置中的“记忆”页只控制：

- 是否自动记住聊天；
- 记忆强度；
- 最近聊天上下文范围。

V0.5 的 Conversation Mutation 原则仍是：删除/回滚旧剧情可以清理失效的自动记忆，但角色共享记忆不会被普通聊天删除误伤。

## 角色卡兼容问题怎么反馈

最有效的信息：

1. 角色卡格式（JSON / PNG / V2 / V3）；
2. 哪个开场/哪条消息触发问题；
3. 期望结果 vs 实际结果；
4. Prompt Debug；
5. 如果是 UI 问题，提供截图；
6. 如果 Build 失败，提供完整终端日志。

生产逻辑禁止为了单个测试角色增加角色名、作者名、卡 ID、文件名特判。


### 社区聊天 UI 回归

更新后建议至少试 4 类角色卡：

1. 没有任何 HTML / Regex 的普通文本卡：应继续是普通聊天气泡。
2. WorldBook 内置 HTML UI 的卡：开场与后续回复应使用同一作者模板。
3. Regex 生成 HTML 的卡：应优先显示 Regex UI，不再套项目私有状态卡。
4. 带 `<br>`、固定宽度和 `<style>` 的社区 UI：不应看到 `&lt;br&gt;`，不应横向溢出，也不应出现双层白气泡。

若玩家主动把显示模式切到“纯聊天气泡”或“剧情气泡”，则以玩家覆盖为准。
