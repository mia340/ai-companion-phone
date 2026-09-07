# AI Companion Phone 项目状态

## 当前版本

```text
开发线：V0.5.0-alpha.3.2.1
IndexedDB：V15（新增 momentPosts / momentComments）
Backup：V10（含朋友圈动态与评论）
原始审查基线：用户上传 V0.4.7.1
本轮输入基线：用户上传 alpha.3 RAR（已包含朋友圈 / 音乐 / 海龟汤）
```

V0.5.0 不以继续堆 Phone App 为主，而是把 V0.4.x 已有功能收敛成**稳定、可测试、可解释的 AI Companion Runtime**。

## 当前阶段目标

> Character Runtime / Conversation Runtime / Community Runtime 分层，先解决聊天变更的数据一致性和 `ChatRoom.vue` 过载，再继续扩展群聊、朋友圈、日记等 App Surface。

毕业阶段优先级：

```text
稳定性 > 可测试性 > 架构清晰度 > 论文价值 > 新功能数量
```



## V0.5.0-alpha.3.2.1 当前状态

alpha.3.2 的 Windows 全量测试结果为 **26/27 test files、245/256 tests**。失败全部集中在海龟汤，11 个用例均为同一 `ReferenceError`：Presentation Policy 的两个导出被调用但未导入。alpha.3.2.1 仅补齐该静态 import，不改变业务语义；目标恢复到 **27/27、256/256**。

## V0.5.0-alpha.3.2 当前状态

### Presentation Policy 已确定

```text
Chat
→ 标准白/蓝聊天气泡
→ Community UI / Regex / 作者 HTML 允许作为特殊 Surface

Moments / Music / Turtle Soup / future native apps
→ AI 只生成自然语言 / 结构化业务数据
→ Vue App Surface 负责布局、按钮、状态和交互
```

当前视觉统一为淡蓝、白色、深蓝灰文字的清新体系。朋友圈不再采用暖粉玻璃卡片，音乐/海龟汤也不再各自使用夜紫、薄荷、珊瑚主题；它们共享同一手机视觉语言，但保留业务自己的信息结构。

### 本轮落地

- 聊天普通 AI 消息恢复白色气泡，用户消息浅蓝气泡；
- `SafeRichHtml` 能把社区富文本中的 loose narrative 与作者 UI 分离，避免正文裸贴背景；
- 朋友圈改为微信式白底信息流，最多 4 张本地图片；自主动态/回复热度折叠进设置；
- 音乐 / 海龟汤 AI 对话使用 plain transcript，不生成 AI UI；
- 游戏允许短动作、神态或心理描写，但状态/按钮/布局由 App 自己渲染；
- `appPresentationPolicy.ts` 作为后续所有独立 App 的统一输出边界。

当前静态规模：**100 个生产 TS/Vue 文件 / 34,793 行；27 个测试文件 / 256 个用例定义**。DB V15 / Backup V10 不变。

## V0.5.0-alpha.3.1.1 当前状态

Windows 实测 alpha.3.1 已达到 **25/26 测试文件、243/244 用例通过**。唯一失败不是朋友圈业务本体，而是自主补发边界定义与测试预期不一致：默认 3 小时窗口在精确 3 小时时实现只算 1 条、测试要求 2 条。alpha.3.1.1 将语义收敛为“最小间隔控制第一条，完整补发窗口按总离线时长计算”，并新增长离线仍受 2 条上限保护的回归用例。

## V0.5.0-alpha.3.1 当前状态

### 用户新增 App 已纳入稳定化

- **朋友圈**：动态/评论、角色 AI 发布与回评、回复热度、角色自主动态；DB V15 / Backup V10。
- **音乐**：识别网易云歌曲链接/分享文本，选择角色一起听并围绕歌曲聊天；实际播放跳转网易云，陪伴会话本地持久化。
- **海龟汤**：角色/默认主持人出题、提问、提示、猜汤底，以及“我当主持人、角色来猜”的反向模式。
- **模型设置**：最大输出统一 4000，输出触顶保留已有文本；reasoning 可选，第三方 OpenAI-compatible 不再强塞非标准 `thinking` 字段。

### 本轮审查已修复

1. demo 角色删除后重启复活；
2. 角色无动态但有评论时，按未建索引 `authorId` 删除评论会触发 Dexie SchemaError；
3. 海龟汤当前问题重复进入 Prompt；
4. 朋友圈自主发帖默认开启、3 分钟级调用过于激进且可能定时器重入；
5. GitHub Pages PWA `start_url` / icon 使用根路径；
6. 新增 4 个大页面静态 import 继续推高首屏包；
7. 新库已有 demo 角色但首页无会话时仍提示“还没有联系人”。

### 视觉与交互

朋友圈、音乐、海龟汤玩家页、海龟汤主持页已分别建立独立主题；模型设置 reasoning 改为移动端 switch。未改 Character Card / WorldBook / Regex / Conversation Runtime 语义。

当前源码定义 **26 个测试文件 / 244 个用例**。容器内 `vue-tsc -b` 已通过；Windows 仍需跑完整 `npm test` + `npm run build`。

## V0.5.0-alpha.3 已完成

### Conversation Runtime 第二刀：rewind / branch / opening reset

新增三个 Runtime 边界，并扩展 Conversation Mutation：

```text
src/runtime/conversation/
├─ conversationMutationService.ts
├─ conversationStateReplayService.ts
├─ conversationBranchService.ts
└─ conversationOpeningService.ts
```

本轮把 `ChatRoom.vue` 中四类跨表编排迁到 Runtime：

- **rewind / 从用户消息重新回复**：`truncateConversationAfterMessage()` 统一清除旧后续 Message、旧分支 automatic Memory、StateHistory 和该节点后的 PromptDebugTrace；保留锚点用户消息，再由 Runtime 重放锚点前状态。
- **state replay**：`buildConversationStateSnapshot()` 统一按保留消息 + StateHistory 重建状态；rewind 模式明确丢弃旧分支 thought / active resource / lorebook timed runtime，branch 模式只继承分支节点之前已经成立的临时状态。
- **branch**：`createConversationBranch()` 统一复制消息、reply reference、reply group、ChatSettings、Memory、StateHistory、ConversationState、MusicState，并阻止分支节点后的 source-less automatic memory / history 泄漏进新分支。
- **greeting / free opening**：开场切换的清理与落库事务进入 `conversationOpeningService`；自由开局复用 `resetConversationRuntime(memoryPolicy='all')`，因此 Prompt Debug 也会被正确清理。

`ChatRoom.vue` 从 alpha.2.1 的约 4.7k 行降到 **4,576 行**；直接 `db.` 调用约降到 **52 处**，但 generation pipeline 仍是下一阶段最大热点。

### 新增测试

新增 6 个 Runtime 行为用例：

- rewind 保留锚点但失效旧派生数据；
- source-less 的后置 StateHistory 不再穿越 rewind；
- branch 只复制节点前消息/记忆/状态；
- branch reply reference 映射到新消息 ID；
- rewind 清空临时 thought/resource/lorebook runtime；
- branch 只继承节点前有效的临时 Runtime。

当前测试文件数 **21**，用例数 **155**。最终是否 155/155 仍以 Windows `npm test` 为准。

### 朋友圈 v1（第一块从占位符落地的 App Surface）

桌面 App「朋友圈」不再是 PlaceholderApp，已实现为 `MomentsView.vue` + 朋友圈服务层：

- **数据模型**：`MomentPost` / `MomentComment` 入库；IndexedDB 升 **V15**，新增 `momentPosts / momentComments` 两表；备份格式升 **V10**，导出/解析/恢复/摘要预览均包含两张新表，V9 及更早旧备份照常读取并兜底空数组。
- **发布**：我发一条（以当前默认 Persona 身份、source=manual）；叫角色发一条（AI 按角色 persona / 心情 / 在做的事以第一人称写短朋友圈，source=ai 并记录所用模型）；若该角色已有单聊，动态绑定到那份聊天，卡片可一键「去聊聊」。
- **互动**：点赞/取消点赞（确定性计数翻转）；评论；我评论某角色动态后，TA 用 AI 按人设回评一条（未配置 AI 时给出明确提示并跳「API 与模型」）。
- **一致性**：删除我的动态同步删其下评论；删除角色时由其删除事务连带清掉 TA 发的动态、TA 写的评论及其动态下所有评论（`deleteMomentsByAuthor`）。
- **可测性**：纯函数抽到 `momentService.ts` / `momentGenerationService.ts`（正文/评论归一化与限长、点赞翻转、倒序、prompt 构建、模型输出净化、断句截断），单测 30 个用例全部覆盖；数据库/UI 行为仍按项目约定走人工验收。

朋友圈初版之后又加入 Music / Turtle Soup / Auto Activity 等测试；当前统一以 alpha.3.1 的 **26 文件 / 244 用例**为准。

## V0.5.0-alpha.1 已完成

### Conversation Mutation 第一批

新增 `src/runtime/conversation/conversationMutationService.ts`，把“删消息 / 重新开始聊天”从单纯 UI 数据删除推进到 Runtime 事务入口：

- 删除消息时同步清理该消息直接产生的自动记忆；
- 手工 / 导入记忆不被误删；
- 老的合并自动记忆若只是失去来源，则保留内容并解除失效来源；
- 删除对应 `ConversationStateHistory`；
- 其它消息对被删消息的 `replyTo` 引用自动清空；
- 会话 `updatedAt` 同事务更新；
- UI 删除后从仍存在的消息与状态历史重建当前 `ConversationState`。

### Restart Runtime 语义

设置里的“清空聊天记录”改为更准确的“重新开始当前聊天”：

- 删除消息；
- 删除自动剧情记忆；
- 清空状态历史；
- 清空 Prompt Debug；
- 重建默认 `ConversationState`；
- 保留手工 / 导入记忆；
- 保留角色卡、Persona、WorldBook、Regex、资源绑定。

### Chat load stale-result guard

`loadConversation()` 增加加载 epoch：快速切换 A/B 聊天时，旧异步任务完成后不再覆盖当前路由对应的会话 UI；组件卸载时同样使旧加载失效。

### 测试

新增 `conversationMutationService.test.ts`，第一批覆盖：

- 自动记忆清理；
- 手工 / 导入记忆保留；
- 旧合并记忆解除失效来源；
- `mergedFrom` 清理；
- 状态历史清理；
- reply quote 引用清理。

## V0.5.0-alpha.2.1 已完成

### scene-merged / multiBubble 语义回归修复

Windows alpha.2 实测已经把 alpha.1 的 7 个失败降到 1 个：18/19 测试文件、148/149 用例通过。唯一剩余失败是 `interactionProtocol` 的场景合并语义。

根因是 alpha.2 为“隐藏协议明确多个 `text`”保留消息边界时，把所有 `scene-merged + multiBubble + protocol` 都视为需要分气泡，导致旧有的：

```text
scene_action → text → scene_action → text
```

被拆成两个气泡。alpha.2.1 改成：

- 当前轮存在**可见 scene_action**：scene-merged 优先，动作与对白继续合并成剧情气泡；
- 当前轮没有可见 scene_action：若协议明确多个 `text` 且开启 multiBubble，则保留模型消息边界；
- phone-text / phone-split 不受本热修影响。

这一步不改数据库和备份格式。149/149 全绿后再进入 alpha.3 Conversation Runtime 第二刀。

## V0.5.0-alpha.2 已完成

### Reliability baseline：清零已有测试红灯

Windows alpha.1 验收暴露 7 个既有兼容层测试失败；alpha.2 逐项确认产品语义后修实现/修错误测试，而不是通过删除断言让 CI 变绿：

- Character Card 导入：`name + entries` 的独立 WorldBook JSON 不再误判为 community character；
- Community UI：HTML 模板定位不再让“格式/模板”标记贪婪吞掉外层 `<div>`，Compiler V2 能拿到作者完整外壳；
- Interaction Protocol：`multiBubble=true` 且隐藏协议明确给出多个 `text` 时，scene-merged 只合并 Action + Dialogue，不再抹掉模型明确消息边界；
- Regex：兼容少数旧社区导出的一层过度转义 Regex，仅在原表达式不匹配时尝试一次 fallback，不改存储原文；
- Rich HTML：兼容代码围栏边缘被序列化成字面 `\n` 的社区内容；
- Regex World Info 测试：修正三个 fixture 同名导致的歧义断言，继续验证 display-only 不进入 outgoing prompt；
- Role Card UI：兼容 pipe-style Tavo 状态文本里字面 `\n` 行分隔。

### docs 清理正式落地

`robocopy /E` 会保留目标目录旧文件，因此只整理新 ZIP 还不够。alpha.2 的 `npm run cleanup` 会删除已经明确归档的逐版本说明和旧社区审计文档；`npm run build` 的 prebuild 也会自动执行同一清理。当前长期文档仍以 `docs/README.md` 的清单为准。

## 已完成的产品/Runtime 基础

### Phone / PWA

- 手机外壳、锁屏、桌面、Dock、设置；
- PWA / generateSW；
- 本地持久化与备份恢复。

### Character / Persona

- 原生角色；
- 常见 SillyTavern / Tavo V2/V3 JSON；
- PNG metadata；
- 原卡阅读器；
- Persona 导入/导出、角色专属 Persona；
- 同源角色卡重复导入提示。

### Conversation

- 同一角色多聊天；
- 自由开局 / 多开场；
- 候选回复；
- Branch V2；
- 基础消息编辑、删除、从用户消息节点 rewind/regenerate。

### Prompt / AI

- 统一 Provider；
- streaming；
- Token usage；
- context/max token/quota 硬停止；
- Prompt Debug；
- card-first；
- 图片理解入口。

### Memory / World State

- 六层记忆；
- 提取、合并、冲突；
- 相关记忆评分；
- ConversationState / StateHistory；
- Presence；
- pre-generation scene transition；
- 回访触发式主动消息基础能力。

### Community Runtime

- Shared Resource + ResourceBinding；
- WorldBook Engine V2 第一阶段；
- Regex Pipeline V2；
- Prompt Preset；
- Resource Intent Router；
- Active Resource Session；
- Safe Rich HTML；
- User Message Ownership；
- Community UI Compiler V2 第一阶段。

## 当前 P0 / P1 技术债

详细证据见 `ENGINEERING_AUDIT.md`。

1. `ChatRoom.vue` 仍是最大的应用编排热点；V0.5 目标是从 4k+ 行逐步降到可维护范围。
2. Conversation lifecycle 已覆盖 delete/reset/rewind/branch/greeting/free opening；下一步风险集中在 generation persistence、会话 load repair 与 View 仍有约 52 处直接 `db.` 调用。
3. `lorebookService.ts` 是核心 WorldBook Engine，但缺直接的 Engine test suite。
4. Backup 只做浅层结构校验，尚未用 Zod 做字段与引用完整性验证。
5. `database.ts` V1→V14 migration 缺独立回归测试。
6. PromptDebugTrace 当前没有明确 `sourceMessageId`，精确回滚 Debug 仍受数据模型限制。
7. 长消息列表缺分页 / 虚拟化；部分资源查询仍是全表扫描。

## V0.5.0 下一批顺序

### alpha.3 验收

1. Windows 确认本地基线为 `0.5.0-alpha.2.1`；
2. 覆盖 alpha.3 后运行 `npm run cleanup`；
3. `npm test`，目标 **26/26 测试文件、244/244 用例**；
4. `npm run build`；
5. 专项回归：从用户消息重新回复、创建分支、切换 greeting、切自由开局、删除消息；
6. 验证 branch 不出现节点后的 Memory/State 穿越。

### alpha.4

开始拆 `requestAssistantReply()`，优先抽两端：

```text
Context Builder
→ 现有 Provider / Streaming（暂留 ChatRoom）
→ Response Persistence
```

随后再逐步迁移：

```text
Memory Retrieval
→ WorldBook / Resource
→ Prompt Build
→ Provider / Streaming
→ Regex / Community UI / Protocol
→ Persistence
→ State / Memory / Debug Update
```

目标：Generation 的跨表写入不再散落在 View，同时保持流式 UI 行为不变。

### alpha.5

- Lorebook Engine 直接测试；
- Backup Zod schema / 引用完整性；
- Database migration tests；
- SafeRichHtml / Community interaction security tests；
- Provider / Character Card adapter 渐进拆分。
