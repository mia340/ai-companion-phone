# 从这里开始

当前开发线：**V0.5.0-alpha.5.1.8**。

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

V0.5 当前重点是“Runtime 稳定 + 知间 UI 收敛”，不是继续无边界增加 App：

- Conversation / Generation Runtime 已把 delete / restart / rewind / branch / opening / provider / response persistence 的关键编排从 View 外移；
- Community Chat 保持“手机壳归 App，消息内部 Presentation 尊重作者资源”的兼容原则；
- Social Runtime V2 已有持久活动队列、角色权限、加权候选、通知，并在 alpha.5.1.6 补上空间可见性和黑名单闭环；
- 空间桌面当前只保留 6 个核心入口，知间内部为「知间 / 通讯录 / 发现 / 我」；
- 当前源码定义为 **37 个测试文件 / 308 个 it/test 声明**；完整是否全绿仍以 `npm run verify` 为准。

项目全貌看 `PROJECT_STATUS.md`，架构边界看 `ARCHITECTURE.md`，当前版本专项验收看 `releases/V0.5.0-alpha.5.1.8_部署与更新.md`。

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
