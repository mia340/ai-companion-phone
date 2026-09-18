# AI Companion Phone 工程审查与 V0.5.0 重构路线图

> **2026-09-18 当前快照**：App `0.5.0-alpha.5.1.11`，IndexedDB V18，Backup V12，源码定义 38 个测试文件 / 319 个 `it/test` 声明。alpha.5.1.11 将 Launcher 升级为 4×6 Grid、手机内边缘翻页和 window 级 Pointer 收口，并定位/删除默认壁纸 blur 合成缝；5.1.8 起的 Character Card / WorldBook / Memory 强化继续保留。


## 0.0.5 V0.5.0-alpha.4.2 社区聊天兼容审查结论

本轮修正的是 Presentation Ownership，而不是新增视觉特效：社区卡已有 Regex / WorldBook HTML / 作者 HTML 时，默认保留作者呈现；App 只负责手机 Shell、安全渲染和响应式约束。`first_mes` 与后续回复统一到同一 Contract 后，苏玉尘这类“开场纯文本 `<br>`、后续 WorldBook HTML”资源可以保持视觉连续。

当前仍有一个明确的架构债务：Opening Community UI Runtime 的 orchestration 暂时位于 `ChatRoom.vue`。完成兼容回归后，应把 Contract Resolve / Greeting Presentation 迁入 Runtime/Presentation 层，继续降低 View 的资源调度职责。静态测试矩阵为 **30 files / 272 tests**。

## 0.0.3 V0.5.0-alpha.3.4 展示层收敛结论

本轮是低风险 Presentation 重构：主要修改 scoped CSS / 页面布局与通讯录搜索，不改变 IndexedDB、Backup、Conversation Runtime 或 Provider。下一阶段仍应优先做 Character Shared Memory，再进入 Generation Runtime。


## 0.0.2 V0.5.0-alpha.3.3 交互审查结论

本轮问题不是 Runtime 可靠性回退，而是 Web 控件泄漏进“手机”体验：浏览器 `prompt()`、被工具按钮压窄的 textarea、页面级浮动大卡、以及安全诊断直接占据聊天消息。alpha.3.3 把这些高频操作重新收进 Phone/App Surface：编辑用本地 bottom sheet，输入优先占宽，状态/警告降到调试层；同时修复朋友圈“互动依赖自主发帖开关”的产品语义耦合。

> 这轮继续遵守 Presentation ownership：聊天可承载 Community UI；原生 App 自己画 UI。DB V15 / Backup V10 不变。

## 0.0.1 V0.5.0-alpha.3.2.1 热修结论

alpha.3.2 的 11 个海龟汤失败并非 11 个独立缺陷，而是 `turtleSoupService.ts` 漏导入 Presentation Policy 两个符号造成的单点 `ReferenceError`。本版补齐静态 import；不改业务逻辑。

> 原始审查基线是用户上传的 V0.4.7.1。alpha.1 建立 Conversation Mutation / Restart / stale-load guard；alpha.2 将兼容层红灯从 7 个压到 1 个；alpha.2.1 修最后一个 scene-merged 回归；alpha.3 开始把 rewind / branch / opening reset 与状态重放正式迁入 Conversation Runtime；alpha.3.1 对用户新增的朋友圈/音乐/海龟汤做代码审查、可靠性修复和视觉收口；alpha.3.1.1 根据 Windows 全量测试修正自主朋友圈 3 小时补发边界；alpha.3.2 收敛 Chat / Native App Presentation 边界并统一清新淡蓝视觉。

审查基线：用户上传 `ai-companion-phone-v0.4.7.1(1).zip`，`package.json` 版本 `0.4.7.1`。

> 说明：最初目录/依赖结论来自静态代码审查。当前源码定义 27 个测试文件 / 256 个 `it/test` 用例；alpha.3.2 容器完成 TS/Vue script 语法转译检查，完整 Vitest/Build 继续以 Windows 为准。

## 0.0 V0.5.0-alpha.3.2 呈现层审查结论

真实截图暴露的主要视觉回归不是“配色不好看”，而是 **Presentation ownership 不清楚**：Rich HTML 因作者 UI 自带 Surface 而让整个外层透明，导致同一回复里的普通剧情正文也直接铺在聊天背景上；同时独立 App 又各自让 AI 输出接近聊天卡片的内容，形成 UI 套 UI。

alpha.3.2 将责任重新分层：

- Chat Renderer 拥有标准白/蓝气泡，同时保留 Community UI 作者 Surface；
- `SafeRichHtml` 负责 Mixed Content 分离，不让普通正文失去阅读容器；
- `appPresentationPolicy` 负责原生 App 的 AI 输出边界；
- Moments / Music / Turtle Soup 的 Vue 页面拥有全部按钮、卡片、状态、选择器与布局；
- 当前生产规模约 **34,793 行**，比用户新增功能初版减少明显，新增 App 仍应继续抽共享 Surface，而不是复制新主题 CSS。

## 0. V0.5.0-alpha.3.1 新功能审查结论

本轮检查用户新增功能后，没有把问题归因于“UI 不够好看”就直接重写，而是先处理会真实破坏数据或产生费用的边界：

- **Seed 生命周期**：`characters.count() === 0` 不能代表“第一次安装”；否则用户删光角色后 demo 会复活。改为仅在启动前连 World 都不存在的全新库播种。
- **Dexie 索引契约**：`momentComments` schema 没有 `authorId` 索引，不能对它使用 `.where('authorId')`；不为一个删除分支贸然升 DB V16，而采用 collection filter。
- **Prompt 去重**：海龟汤 UI 先 push 当前问题再读取 history，会让 service 再追加一次当前问题；现在先 snapshot history。
- **付费副作用**：朋友圈自动角色活动默认关闭、降低频率、前台/在线运行且 loop 不可重入；这是产品安全边界，不只是性能优化。
- **Provider 兼容**：`thinking` 属于非标准扩展，只对内置 DeepSeek 发；通用 OpenAI-compatible 保持标准请求体。
- **首屏性能**：新增 App 采用 route-level lazy import；下一阶段再根据 Windows Build chunk 输出决定是否继续拆 vendor/manualChunks。
- **PWA 子路径**：GitHub Pages 使用 `/ai-companion-phone/`，manifest 的 start_url/scope/icon 必须与 base 对齐。

新页面尺寸仍较大（Moments / Music / Turtle Soup 两页均接近或超过 1k 行），但当前优先是功能稳定；后续应先抽共享 `AppSurfaceShell / CharacterPicker / CompanionChatPanel`，不要复制四套卡片/聊天 CSS。


### alpha.3.1.1 测试反馈闭环

Windows 对 alpha.3.1 的真实全量结果为 **25/26 test files、243/244 tests**。唯一失败由 `autoPostCountDue()` 的边界定义造成：实现把 3 小时窗口从“最小间隔之后”再起算，导致精确 3 小时只返回 1；测试/产品语义则把“总离线达到一个完整 3 小时窗口”视为 2 条。alpha.3.1.1 采用后者，并继续使用 `AUTO_MAX_BACKFILL=2` 作为费用硬上限。

## 1. 审查摘要

- alpha.3.1 当前生产 TS/Vue 约 **36,555 行**，测试代码约 **3,200 行**；新增 App 让总规模继续增长，因此下一阶段必须以“复用边界”而不是单纯堆页面为指标。
- 原 V0.4.7.1 审查时生产 TS/Vue 约 28,231 行；V0.5 重构期间以趋势而非绝对行数作为指标。
- 当前测试定义：38 个测试文件、315 个 `it/test` 声明；除 Conversation Runtime 外，朋友圈、音乐、海龟汤和 Provider 也已有纯规则/请求体回归测试。
- `ChatRoom.vue`：alpha.3 为 4,576 行，仍是最大架构热点；Conversation lifecycle 已继续外移，但 generation 仍未大拆。
- 静态依赖扫描覆盖 **99 个生产 TS/Vue 文件**，仍未检测到模块循环依赖，这是当前代码结构的明显优点。
- 最大风险不是“缺功能”，而是 Conversation/Generation/Persistence 逻辑仍集中在 View，导致删除、回滚、分支、流式生成、状态/记忆等操作难以保持事务一致性。

## 2. 目录级审查

### `src/views`

当前约 **17,645 行**。新增 Moments / Music / Turtle Soup 后，View 层增长明显，仍承担了较多应用编排和数据库访问。

重点：
- `ChatRoom.vue`：聊天 UI + 会话加载 + 旧数据清理 + Prompt 编排 + Provider 请求 + Streaming + Regex + WorldBook + Memory + State + Branch/Rewind + 音乐/语音/图片。
- `CharacterCreate.vue`：表单 UI + 角色卡导入 + 头像处理 + 重复检测 + 资源落库 + Persona/Conversation 创建事务。
- 新增热点：`MomentsView.vue` 1,347 行、`TurtleSoupHostView.vue` 1,242 行、`MusicAppView.vue` 1,108 行、`TurtleSoupView.vue` 1,103 行；下一阶段应抽共享 AppSurfaceShell / CharacterPicker / CompanionChatPanel。
- `ModelSettingsView.vue` 976 行、`CharacterEditView.vue` 881 行，也偏大。
- 当前有 **17 个 View** 直接 import `db`，新增 App 进一步放大了 UI 层与持久化层耦合。

### `src/services`

当前约 **13,049 行**，仍是项目逻辑主体。方向正确，但“纯规则 / 用例编排 / IndexedDB I/O / 外部 HTTP”混在同一目录。

重点热点：
- `ai/provider.ts` 1012 行：HTTP、SSE、错误分类、模型列表、文本提取混合。
- `characterCardImportService.ts` 992 行：JSON/V2/V3 映射、PNG metadata、Persona 推断、导入/导出混合。
- `lorebookService.ts` 823 行：WorldBook Engine 核心，但没有直接测试文件。
- `interactionProtocol.ts` 792 行：较大，但已有 28 个测试，风险相对可控。
- `memoryService.ts` 685 行：核心长期记忆逻辑，已有基础测试但覆盖仍偏少。

### `src/db`

`database.ts` 864 行，集中维护 V1→V15 全部 Dexie schema/migration。历史兼容做得认真，但没有 migration test，属于高风险基础设施。

### `src/types`

`domain.ts` 739 行，仍是全项目最高 fan-in 类型中心之一。继续扩展 App/Runtime 时会成为“任何类型改动都影响全局”的中心文件。

### `src/components` / `src/composables`

聊天组件已经进行过一轮拆分，这是正确方向。问题在于拆出去的主要是“视觉组件”，核心 use-case 仍留在 `ChatRoom.vue`。

### `src/stores`

`useAppStore` 当前没有任何调用者；Pinia 被初始化，但 Store 实际未参与应用状态管理。`unlocked/currentWorldId` 也没有成为真实状态源。

## 3. 模块依赖审查

当前主要依赖路径：

```text
router -> views
views -> components/composables
views -> services
views -> db              <- 当前层级泄漏
services -> services
services -> db
services -> types
provider/db -> infrastructure
```

静态扫描未发现模块循环依赖。

最大耦合点：
- `ChatRoom.vue`：42 个内部依赖。
- `domain.ts`：约 62 个内部模块依赖它。
- `database.ts`：约 30 个内部模块依赖它。
- `resourceBindingService.ts`：约 8 个内部引用。

建议 V0.5.0 采用“轻量四层”，不一次性搬家：

```text
UI               views / components / composables
Application      runtime / use-cases
Domain           pure rules / parsers / types
Infrastructure   db / provider / backup / browser APIs
```

第一步只把 ChatRoom 的应用编排抽到 `runtime`，现有 service 文件暂时保留，避免大爆炸式重构。

## 4. 超大文件清单

| 文件 | 行数 | 主要问题 | V0.5.0 处理 |
|---|---:|---|---|
| `src/views/ChatRoom.vue` | 4433 | lifecycle 已部分外移，Generation Runtime 仍集中 | P0 继续拆 |
| `src/views/CharacterCreate.vue` | 1427 | 创建事务、导入、头像处理都在 View | P1 拆 |
| `src/services/ai/provider.ts` | 1030 | HTTP/SSE/error/model parsing 混合 | P1 拆 |
| `src/services/characterCardImportService.ts` | 1154 | 多格式 adapter/PNG/import/export 混合 | P1 拆 |
| `src/views/ModelSettingsView.vue` | 897 | 配置、拉模型、测试连接、测试视觉与 UI 混合 | P2 |
| `src/views/CharacterEditView.vue` | 880 | 表单逻辑偏重 | P2 |
| `src/db/database.ts` | 890 | 当前 schema + 多版本 migration 同文件 | P1 |
| `src/services/lorebookService.ts` | 823 | 核心引擎 + DB 查询，无直接测试 | P0 测试先行 |
| `src/services/interactionProtocol.ts` | 792 | parser/projection/naturalness 混合 | P2，已有较多测试 |
| `src/types/domain.ts` | 847 | 超高 fan-in 单体类型文件 | P1 渐进拆 |

## 5. 技术债

1. **View 直连 IndexedDB**：至少 13 个 View 直接使用 `db`；alpha.3 后 `ChatRoom.vue` 仍约 52 处 `db.*` 调用，较初审下降但尚未达成 UI Adapter 目标。
2. **Conversation lifecycle 正在收口**：alpha.3 后 delete/reset/rewind/branch/opening 已有 Runtime 入口；剩余主要风险转向 generation persistence 与个别 View 直写。
3. **旧数据修复发生在 ChatRoom 加载路径**：每次进入会话会执行 legacy normalization/cleanup，增加加载开销与副作用；应迁到 migration/repair service。
4. **资源查询存在全表扫描**：`resourceBindingService` 多处 `toArray()`；`lorebookService` 构建 Prompt 时读取全部 LorebookEntry 再过滤。资源规模增大后会变慢。
5. **路由全量 eager import**：19 个 View 被路由同步导入，不利于手机首屏；可以 lazy route。
6. **Pinia Store 死代码**：`useAppStore` 无调用，`unlocked/currentWorldId` 没有成为真实状态。
7. **未使用依赖**：`zod` 在 `src` 中没有调用；`@vite-pwa/assets-generator` 也没有项目内调用脚本。
8. **Domain 类型单体化**：`domain.ts` 会随 Moments/Diary/Forum 等 App 加速膨胀。
9. **PWA + IndexedDB 升级缺少发布保护**：Service Worker auto-update 与复杂 migration 组合，需要 migration regression + backup recovery 验收。
10. **主动消息不是后台主动**：当前 `planProactiveMessage()` 只在打开 `ChatRoom` 的 `loadConversation()` 时触发；App 关闭时不会真正后台生成消息。UI/论文应明确“回访触发主动消息”，或后续增加受限后台机制。

## 6. 潜在 Bug / 数据一致性风险

### 已处理（alpha.1/alpha.3）：删除消息与派生数据一致性

初审时 `deleteSelectedMessage()` 只处理 Message。现在已通过 Conversation Mutation + State Replay 统一处理：
- 自动 Memory；
- ConversationStateHistory；
- PromptDebugTrace；
- 当前 ConversationState；
- 其它消息的 `replyTo.messageId`。

结果：一条用户消息已经被删除，但角色仍可能“记得”它，Presence/地点/关系状态也可能继续保留。

**当前状态**：delete 已进入 `ConversationMutationService`；alpha.3 又把 rewind truncate 纳入同一 plan，并对 source-less history 增加时间 cutoff。

### 已处理（alpha.1/alpha.3）：Restart / Greeting / Free Opening 语义收口

Restart 已统一清消息、派生状态、Prompt Debug；手工/导入记忆按产品语义保留。alpha.3 进一步把 greeting/free opening 的 reset/write 放入 `conversationOpeningService`；显式切换开场仍按“新剧情”语义清空本会话记忆。

### 已处理（alpha.1）：快速切换会话 stale load

`loadConversation()` 已使用递增 epoch；旧异步结果不能覆盖当前 route 对应 refs。后续若把 load 迁入 Runtime，再保留同一提交门禁。

### P1：备份导入只有浅层结构验证

`parseBackupFile()` 主要检查顶层数组存在，之后直接 cast 为 Domain 类型；没有字段级 schema、referential integrity 或大小限制。

可能导入：
- orphan messages；
- 无效 conversation/member id；
- 非法 message images/data URL；
- 非法 resource binding；
- 极大 JSON 导致浏览器卡死。

项目已经依赖 `zod`，但目前未使用。V0.5.0 应把它用在 Backup/Community Import 的边界校验，或删除依赖。

### P2：Backup UI 与实际数据不一致

V13 起 relationship stores 已删除，`createBackup()` 中 `relationships/relationshipEvents` 永远写空数组，但 `DataBackupView` 仍写“关系成长记录”，并显示两个统计项。

此外按钮称“导出全部数据”，实际没有导出 `modelSettings` 和 `promptDebugTraces`。不备份 API Key 是合理的，但 UI 应明确写出排除项。

### P2：锁屏目前只是视觉页，不是访问控制

`useAppStore.unlocked` 没有调用，router 没有 guard，用户可以直接进入 `/home`、`/chat/...`。若锁屏只做拟真效果，这是可接受设计；若论文或 UI 声称“锁定/隐私保护”，则当前实现不成立。

### P2：PWA 子路径需要专项验收

Vite `base` 为 `/ai-companion-phone/`，manifest 中显式设置 `start_url: '/'` 与 `/icon.svg` 绝对路径。GitHub Pages 在 repo 子路径部署时应专项验证“安装后启动路径、图标、离线刷新”是否仍落在 repo base 内。

### P2：API Key 本地明文存储

`modelSettings.apiKey` 存 IndexedDB。对于纯前端 BYOK App 很常见，但它不是安全密钥库；任何同源脚本执行漏洞都能访问它。由于项目会展示不可信社区 HTML，`SafeRichHtml` 必须作为安全边界持续做恶意输入回归测试。

## 7. 测试缺口

当前源码定义 37 个测试文件、308 个 `it/test` 声明。Regex / Interaction / Community UI 与 Conversation Runtime 都已有基础行为测试，但 Lorebook 主引擎、Backup schema、DB migration、安全渲染仍是最大缺口。

### V0.5.0 P0 测试

1. `lorebookService.test.ts`
   - keyword / regex / constant / selective；
   - recursion；
   - sticky/cooldown/delay；
   - group scoring；
   - token budget；
   - position/depth/outlet；
   - resource binding / session continuation。
2. `conversationMutationService.test.ts`
   - delete message；
   - clear/reset；
   - edit + rewind；
   - branch；
   - automatic memory/history/debug cleanup；
   - manual/imported memory 保留。
3. `promptComposer.test.ts`
   - V2/V3 system override；
   - `{{original}}`；
   - free opening；
   - structured UI / phone-enhanced；
   - Persona/macro；
   - Author Note/Depth position。
4. `dataBackup.test.ts`
   - V1→V9 import；
   - V9 roundtrip；
   - invalid schema；
   - orphan reference；
   - image excluded/included；
   - 关系旧字段迁移。
5. `database.migration.test.ts`
   - 至少覆盖 V8/V9/V12/V13/V14 的关键迁移。
6. `SafeRichHtml` security tests
   - script/event/iframe/srcdoc；
   - javascript/data URL；
   - SVG/MathML；
   - CSS `@import/url()`；
   - greeting safe interaction。

### P1 集成/E2E

项目当前没有 Vue Test Utils / jsdom/happy-dom / Playwright。

建议增加 5 条最小 E2E：
- 创建/导入角色 → 新会话；
- 发送消息 → stream → 持久化；
- 编辑用户消息 → rewind → 重生成；
- branch → 状态/记忆独立；
- backup export → clear → restore。

## 8. V0.5.0 重构方案

### 0.5.0-alpha.1：Conversation reliability baseline

- Conversation Mutation 第一批；
- Restart Runtime；
- stale load epoch；
- CI test gate；
- docs 收敛。

### 0.5.0-alpha.2 / alpha.2.1：清兼容层红灯

- Character Card / Community UI / Regex / Tavo pipe 回归修复；
- scene-merged 与显式 multiBubble 行为合同收敛；
- docs cleanup 真正落地。

### 0.5.0-alpha.3：Conversation Runtime 第二刀（当前）

```text
src/runtime/conversation/
  conversationMutationService.ts
  conversationStateReplayService.ts
  conversationBranchService.ts
  conversationOpeningService.ts
```

把 delete/reset/rewind/branch/greeting/free opening 的跨表生命周期从 View 收口；引入 point-in-time replay，阻止 Future Memory/State 穿越到旧节点。

### 0.5.0-alpha.4：Generation Orchestrator

计划新增：

```text
src/runtime/generation/
  assistantReplyOrchestrator.ts
  generationContextBuilder.ts
  promptTurnBuilder.ts
  responsePipeline.ts
  streamSession.ts
  responsePersistence.ts
```

目标是把 `requestAssistantReply()` 拆成明确阶段：

```text
load runtime context
→ build memory/worldbook/resources
→ compose prompt/history
→ provider request
→ regex/community UI/protocol projection
→ persist messages/state/memory/debug
```

第一步不会一次拆完；优先抽“上下文构建 + response persistence”两端，保留 streaming UI 状态在 ChatRoom，减少回归面。

### 0.5.0-alpha.5：基础设施热点与安全边界

- `provider.ts` 分离 SSE/error/model parsing；
- Character Card adapters 渐进拆分；
- Lorebook 主引擎补直接测试；
- Backup Zod / referential integrity：alpha.5.1.12 已完成 envelope + 主要跨表引用 preflight；后续继续细化逐实体完整 schema、迁移回归与更大备份压力测试；
- SafeRichHtml / Community interaction bridge 安全测试；
- database migration tests。

### 0.5.0-beta：性能和持久化

- ResourceBinding/Lorebook 索引查询；
- message list 分页/virtualization；
- router lazy load；
- 图片 Blob 迁移单独评估；
- PWA / backup / migration 发布演练。

### 0.5.0-rc：毕业稳定版

- 固定 Community Compatibility Corpus（第三方原始素材不提交仓库）；
- 真实 Provider 验收矩阵；
- Backup migration 演练；
- PWA GitHub Pages install/offline/update 验收；
- 性能实验与论文数据冻结；
- 功能冻结，只有 P0/P1 bug 可进入 RC。

**V0.5.0 最终目标仍是：ChatRoom 总行数 < 1500、script < 900；View 不再直接维护跨表事务。**

## 9. 毕设开发路线图

### M0：冻结范围

毕业核心只保留：Character Card / Persona / Conversation+Branch / Prompt / WorldBook / Regex+Community UI / Memory / Backup / PWA。

Moments、Diary、Forum、Wallet 等只在 Runtime 稳定后作为“扩展 App Surface”做 1~2 个展示样例，不作为毕业前必做全家桶。

### M1：可靠性基线

完成本报告 P1 bug + P0 tests。论文可开始写“需求分析、架构设计、数据模型、兼容策略”。

### M2：V0.5 Runtime 重构

把 ChatRoom 变成 UI Adapter，把 Conversation/Generation 变成可独立测试 Runtime。这一阶段是论文“系统设计与关键实现”的核心素材。

### M3：实验设计

至少做三组对照：
- Memory off vs on；
- WorldBook off vs on；
- Community Runtime off vs on / 原卡兼容模式。

记录：Prompt 字符/Token 规模、响应时间、命中率、角色一致性人工评分、分支状态一致性、备份恢复成功率。

### M4：性能与安全

- 长会话 1k/5k 消息加载；
- 100/500/2000 WorldBook entries；
- 大图/多图存储；
- malicious community HTML corpus；
- backup corruption cases。

### M5：论文冻结

论文叙事建议围绕：

> “面向社区角色卡生态的本地优先 AI Companion Runtime：角色资源兼容、长期会话状态、分层记忆、安全社区 UI 与可分支剧情。”

这比“做了一个仿手机聊天网页”更能体现毕业设计的工程和研究价值。

### M6：答辩 Demo

固定 5 分钟稳定演示链：

```text
导入角色卡
→ 选择 Persona/开场
→ 世界书 + Regex/HTML 生效
→ 连续对话 + Memory 命中
→ 编辑历史消息/Branch
→ Prompt Debug 展示运行时依据
→ Backup 导出
```

## 10. 下一步执行顺序

第一批代码变更建议只做三件事：

1. 新建 `conversationMutationService`，修 message delete / clear / rewind 统一一致性；
2. 给它补测试；
3. 给 `loadConversation` 加 stale-load guard。

这三项改动范围小、收益高，而且会为后面拆 `requestAssistantReply()` 提供安全地基。
