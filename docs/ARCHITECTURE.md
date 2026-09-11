# AI Companion Phone 当前架构

> 当前文档版本：**V0.5.0-alpha.3.5**。
> V0.5.0 开始把 Conversation / Generation 应用编排从 `ChatRoom.vue` 迁入 `src/runtime/`，数据库当前为 IndexedDB V16 / Backup V11（朋友圈与主屏幕个性化已纳入备份）。
> 历史架构演进已合并到 `RELEASE_HISTORY.md`。

## V0.5.0-alpha.3.1 App Surface 边界

用户新增的朋友圈、音乐、海龟汤不直接进入 Conversation Runtime，而作为独立 App Surface 使用各自 service：

```text
Home / Router
  ├─ MomentsView -> momentService / momentGeneration / autoActivity
  ├─ MusicAppView -> musicCompanionService -> Provider
  └─ TurtleSoupView / HostView -> turtleSoupService -> Provider
```

本轮明确三个约束：

- 重交互 App 使用 route-level lazy import，避免它们全部进入首屏主包；
- 后台/自动 AI 行为必须显式 opt-in、前台运行且禁止重入，不能静默制造持续费用；
- UI 页面只负责展示与交互，AI prompt / 解析继续留在 service，后续可再迁入 `runtime/`，但不把新逻辑塞回 `ChatRoom.vue`。

## V0.5.0-alpha.3.5 Memory Ownership 与主屏幕个性化

### 多聊天记忆不再“选一个聊天”

同一角色允许拥有多个独立聊天后，**其他 App 不应该随机挑一个聊天作为“角色记忆源”**。当前运行时采用双层记忆：

```text
Character Shared Memory
  ├─ fact
  ├─ shared
  ├─ promise
  └─ relationship
        ↓
  可跨多个聊天 / Moments / future native apps 读取

Conversation Memory
  ├─ subjective
  └─ story
        ↓
  只属于当前剧情线，默认不跨聊天
```

用户可以在“记忆管理”中手动把任意记忆提升为“角色共享”，或移回“仅当前聊天”。这样既避免“第二个聊天突然知道第一条支线剧情”的污染，也不会让角色在换聊天后忘掉姓名、偏好、承诺等稳定事实；共同经历默认属于当前剧情线，确认后再共享。

Chat 的 Prompt 读取顺序现在是：**当前聊天记忆 + 该角色全部聊天中的角色共享记忆**；同一内容跨聊天重复时去重，冲突仍保留并交给现有冲突机制处理。

原生 App Surface（当前已落地朋友圈）不读取某个随机聊天，而是通过 `listCharacterSharedMemories(characterId)` 获取角色共享记忆；如果以后需要“从某个聊天跳进 App 并临时带入剧情”，应使用显式 handoff context，而不是改变共享记忆归属。

### 主屏幕 App Icon

首页 App 图标从 Emoji 占位升级为统一的轻量 SVG 图标系统：简洁轮廓、柔和双色底、玻璃高光和一致安全区，遵循 Apple 对图标“简单、可识别、主体居中”的设计方向。

用户可进入首页“编辑”，为 App 上传自己的图片；本地会裁成 512×512 并压缩为 WebP，按世界保存到 IndexedDB。自定义图标也会进入 Backup，恢复数据后不会丢失。

## V0.5.0-alpha.3.2 Presentation Policy

“AI 输出什么”与“页面怎么长”正式拆开：

```text
Chat Surface
  AI / Character Card / WorldBook / Regex
        ↓
  text + structured/community presentation
        ↓
  ChatMessageItem / SafeRichHtml
  （允许作者 UI，但未知 JS 仍禁止执行）

Native App Surface
  Moments / Music / Turtle Soup / future apps
        ↓
  AI = natural-language content / business data only
        ↓
  deterministic sanitizer
        ↓
  local Vue renderer owns layout + controls + state UI
```

关键规则：

- **Chat 有 UI**：普通回复使用本地白色/浅蓝气泡；作者明确声明的 Community UI / Regex HTML 可作为特殊消息 Surface。
- **Native App 不让模型造 UI**：App 本身已经是界面，模型只产文字、图片引用或结构化业务数据，避免 UI 套 UI、Token 浪费和脚本风险。
- `appPresentationPolicy.ts` 提供统一 Prompt 规则与输出清洗；未来新增 Diary / Forum / Calendar 等 App 必须复用，不再各写一份“禁止 HTML”逻辑。
- `SafeRichHtml` 只属于 Chat / Community Renderer。它会把“普通剧情正文 + 作者 UI”中的 loose narrative 包成白色叙事气泡，同时保留作者 UI 的独立 Surface。

## 1. 总体边界

AI Companion Phone 是本地优先的虚拟手机 / AI 角色陪伴 PWA。

```text
Phone Shell / Views
        ↓
Conversation Runtime
        ↓
Prompt + Community Resource Runtime
        ↓
Provider
        ↓
IndexedDB Persistence
```

核心原则：

- AI / 原卡负责角色内容；
- 本地运行时负责上下文、协议、状态、安全和渲染；
- Character 与 Conversation 分离；
- Community Resource 使用共享资源本体 + ResourceBinding；
- 不针对具体角色、作者、文件名写生产逻辑。

### V0.5 Runtime 分层目标

V0.5 不做大爆炸式目录搬迁，先增加 Application Runtime 层：

```text
UI
views / components / composables
        ↓
Application Runtime
src/runtime/conversation
src/runtime/generation（后续）
        ↓
Domain / Services
memory / worldbook / regex / protocol / card compatibility
        ↓
Infrastructure
Dexie / Provider / Backup / Browser APIs
```

alpha.3 后 `src/runtime/conversation/` 已形成四个明确边界：

- `conversationMutationService.ts`：删除、重启、rewind truncate 的派生数据一致性；
- `conversationStateReplayService.ts`：按某个剧情节点重放 ConversationState；
- `conversationBranchService.ts`：从选定消息创建独立会话分支；
- `conversationOpeningService.ts`：greeting / free opening 的重置与落库事务。

View 仍负责 greeting 的宏、Regex、Community UI 显示投影，以及 generation pipeline；但 destructive conversation lifecycle 不再散落维护。

Conversation mutation 的目标边界：

```text
UI intent
  ↓
Conversation Mutation Runtime
  ├─ Message
  ├─ Automatic Memory
  ├─ ConversationStateHistory
  ├─ PromptDebugTrace（可精确关联时）
  ├─ Reply Reference
  └─ Conversation metadata
  ↓
Rebuild current ConversationState
```

`ChatRoom.vue` 目前仍保留 generation pipeline、Provider streaming、response projection 等大块编排；下一阶段重点转向 `requestAssistantReply()` / Generation Runtime。

### Conversation point-in-time replay（V0.5.0-alpha.3）

rewind 与 branch 都不能简单复制“当前最新 ConversationState”。Runtime 现在按目标节点重新构建：

```text
retained Message prefix
+ source-linked ConversationStateHistory
+ greeting seed facts
+ cutoff-safe ephemeral runtime (branch only)
        ↓
ConversationState snapshot
```

关键约束：

- rewind 的锚点用户消息保留，但该消息旧版本产生的 Memory / StateHistory 与后续消息一起失效，随后重新应用当前锚点内容；
- source-less StateHistory 只有在时间不晚于目标节点时才可重放，避免“未来状态”穿越回旧剧情；
- branch 中 manual/imported memory 可持续继承；无 sourceMessageId 的 automatic memory 只有创建时间不晚于分支节点才继承；
- reply reference / reply group 在新会话中重新映射 ID，避免新分支依赖父会话内部消息 ID；
- thought / active resource / lorebook timed effect 只有在分支节点前已经成立时才可继承；rewind 一律先清掉再由后续生成重新建立。

### 会话加载并发边界

`loadConversation()` 使用递增 epoch 保护异步提交。旧路由加载即使更晚完成，也不能再覆盖当前 Conversation refs；组件卸载同样会使旧 epoch 失效。

## 1.0.1 Character Card Compatibility Layer（V0.4.6.0）

```text
Raw Card / PNG metadata
        ↓
无损归档（Source of Truth）
        ↓
Compatibility Adapter
├─ V2 语义
├─ V3 语义
└─ 常见旧 Tavern / 社区兼容兜底
        ↓
CharacterRuntimeManifest（可重建 / 0 Token）
        ↓
现有 Prompt / WorldBook / Regex / Conversation Runtime
```

该层故意保持“薄”：不替换 Character、ResourceBinding 或 Conversation 数据模型，只校准字段该去哪里。标准底层尽量跟生态，手机交互与安全渲染继续做本项目特色。

关键字段边界：

- `description/personality/scenario`：角色 Prompt 资产；
- `first_mes/alternate_greetings`：选择后才成为真实 assistant 历史；
- `creator_notes`：V2/V3 阅读器资料，不默认进 Prompt；
- `system_prompt`：V2/V3 override，`{{original}}` 可引用默认 system；
- `post_history_instructions`：历史之后的最终作者指令；
- `character_book`：交给 WorldBook Runtime；
- Regex：交给 Regex Pipeline，不展平到角色 description；
- 未识别 `extensions/assets/source`：Raw escrow 保留，能安全理解的再进入 Runtime。


## 1.0.2 Regex Pipeline V2（V0.4.7.0）

Regex 不再被视为“统一后处理器”。运行时把一条消息维护成多个视图：

```text
Provider raw output
        ↓
Storage Regex（两项 ephemerality 都未勾选）
        ↓
Canonical Message Storage
        ├─ Display Regex（markdownOnly） → displayContent / Safe Rich UI
        └─ Outgoing Regex（promptOnly） → 下一次请求的临时 ChatTurn
```

关键约束：

- `placement` 决定来源，当前主聊天执行 1(User Input) / 2(AI Response) / 5(World Info)；
- `markdownOnly` 与 `promptOnly` 是临时视图开关，不是脚本类型；
- 两项都不勾才永久改写消息存储；
- 两项都勾时显示与模型上下文都改变，但 canonical 存储保持原文；
- `promptOnly` 永远不再对整个 System Prompt 运行；
- `minDepth/maxDepth` 只按真实聊天行计数，内部导演指令不参与 depth；
- `runOnEdit` 只在用户手动编辑消息时决定是否重跑；
- Rich HTML 仍走 Safe Community UI，未知第三方 JS 不执行。

这层只负责生态兼容；Presence、三种呈现、Resource Session、Memory 等产品 Runtime 不被 Regex 反向控制。

## 1.0.3 Renderer Surface + Message Rewind（V0.4.7.1）

V0.4.7.1 不改变 Regex Pipeline V2 的三视图，只补两个产品边界：

1. **Rich Surface 判定**：作者 HTML 本身声明 `background / border / box-shadow` 时，聊天气泡只做透明承载；只有旧社区裸 markup 没有视觉表面时，宿主提供中性背景。宿主不重写作者色彩与布局。
2. **User-message rewind**：编辑或选择某条用户消息后可从该节点重新生成。运行时截断后续消息，并把 ConversationState 重建到该节点之前，再重放编辑后的用户消息产生的显式场景变化和自动记忆。该操作只清理当前失效分支产生的自动状态，不删除 Character / Persona / ResourceBinding / 手工记忆。

这两个能力都属于应用 Runtime / Renderer，不改变 Character Card、WorldBook 或 Regex 的作者语义。

## 1.1 参考项目学习后的架构约束

公开小手机项目反复出现一个共同趋势：长期稳定的项目不是“聊天页加功能”，而是“角色运行时 + 多个应用表面”。因此本项目后续按下列边界演进：

```text
Character Runtime
├─ Identity / Persona relationship
├─ Conversation / Branch
├─ World State / Presence
├─ Memory / Summary / Recall
├─ Community Resource Runtime
└─ Capability Permissions
        ↓
App Surfaces
├─ Chat
├─ Messaging
├─ Forum / Moments
├─ Diary / Calendar
├─ Music
└─ Future apps
```

App Surface 不拥有角色人格；它只改变交互入口、可见数据和可调用能力。这样才能保证角色跨聊天、跨 App、跨时间仍然是同一个角色。

## 2. Phone Shell

主要入口：

- `PhoneFrame.vue`；
- `StatusBar.vue`；
- `LockScreen.vue`；
- `HomeScreen.vue`；
- `DockBar.vue`；
- Vue Router Hash；
- Pinia。

应用自身视觉为白色 + 极淡蓝；作者社区 HTML/CSS 不被主题强制改色。

## 3. Character 与 Conversation

Character 保存角色身份与角色卡来源。Conversation 是一次独立剧情。

同一 Character 可以有多份 Conversation。新聊天支持：

```text
自由开局
作者默认开场
备用开场
```

自由开局不会把 `first_mes` 写入历史；角色卡、WorldBook、Regex、Preset 和 Persona 仍正常工作。

Branch 从指定历史消息节点产生新的 Conversation，并复制节点以前的 messages、settings、state/history、可追溯 memories、resource session 和 music state。状态按节点以前的 StateHistory 重建。

## 4. Prompt 架构

`promptComposer.ts` 是 system prompt 的主要编排入口。

典型输入：

```text
Character Card
Persona
Current World State
Memory
Lorebook
Preset
Runtime Rules
Presentation Mode
```

原则：

- imported community card 默认 card-first；
- 本地索引与原卡阅读器 0 Token；
- 不重复注入本地拆分字段；
- `{{user}}` 原卡模板避免重复；
- 默认第二人称“你”，作者明确第三人称协议可覆盖；
- Token/context/quota 硬错误不本地续写角色内容。

## 5. Community Resource Runtime

详见 `COMMUNITY_RUNTIME.md`。

```text
LorebookResource
RegexScript
PromptPreset
        ↓
ResourceBinding
(global / character / conversation / persona)
```

```text
角色 / Persona / Memory / State
        ↓
Bound WorldBook Sources
        ↓
WorldBook Engine V2
  ├─ initial keyword / constant / Focus
  ├─ selective logic
  ├─ timed effects
  ├─ recursive scanning
  ├─ group competition / scoring
  ├─ explicit token budget
  └─ position / depth / outlet routing
        ↓
Resource Intent / Active Session
        ↓
Preset + Prompt Regex
        ↓
Provider
        ↓
Assistant Regex
        ↓
Structured / Community UI
        ↓
IndexedDB
```

## 6. Resource Intent / Session

Resource Intent Router 根据资源标题、keys、作者触发语句和用户意图决定 Focus。

大型按需功能未调用时可以休眠。明确打开后建立 Active Resource Session，后续短消息可继续当前资源，并使用精简 session prompt 降低重复注入。

## 7. Presence / Scene Transition

Presence 只表示世界事实：

```text
together
remote
unknown
```

与聊天呈现方式独立。

用户明确动作可在生成前更新 Presence，例如：

- `（上车）`：remote → together；
- `我回家了`：together → remote；
- `我先走了`：together → remote。

弱意图如“想见你”“快到了”不会提前切换。

## 8. 三种呈现

### scene-merged

最接近 RP / 社区卡，可保留作者文本状态头、Regex UI 和 Community UI。

### phone-text

只投影角色真正发送 / 说出的语句；动作、旁白、心理、状态 UI 不进入可见聊天流；短消息可自然多气泡，小作文保持完整。

### phone-split

Action 独立，Dialogue 使用普通消息气泡，状态字段不误当 Action。

## 9. Parser

### Action Parser V2

先保护 HTML/XML/code block、状态栏、地点/人物/衣着/相对位置等结构字段和物品备注，再识别动作、表情、视线、停顿和说话状态。

### Dialogue Parser V2

区分真正说出/发出的消息与备忘录、文件、屏幕文字、引用和用户侧社区消息。纯手机没有 Dialogue 时，不把旁白 fallback 成消息。

### Author Text Status Header

识别 `【地点∶...】` 等格式，兼容 `: / ： / ∶ / ﹕ / ︰`。

## 10. Community UI Compiler V2

第一阶段：

```text
作者固定 HTML/CSS 外壳
        +
AI 生成动态字段 / 正文
        ↓
本地安全填回作者模板
```

本地不创建角色事实；未知第三方 JavaScript 不直接执行。

## 10.1 WorldBook Engine V2

V0.4.5.0 将 WorldBook 从“字段导入 + 单轮关键词扫描”升级为会话级执行器。

```text
Initial Scan
  ↓
Timed Effect Gate (delay / sticky / cooldown)
  ↓
Selective Logic + Probability
  ↓
Group Competition / Scoring
  ↓
Recursive Waves (max internal guard)
  ↓
Explicit Resource Token Budget
  ↓
Position Router
  ├─ Before Char
  ├─ After Char
  ├─ Author Note mapped area
  ├─ @D role/depth
  ├─ Example Messages top/bottom
  └─ Outlet → Preset macro
```

Timed Effects 保存在 `ConversationState.lorebookRuntime`，因此属于聊天状态而不是角色卡本体；Branch 只继承分支节点以前仍有效的效果。这个字段不需要新 IndexedDB store，因此数据库仍为 V14。

Token Budget 原则：只有资源自己导入/用户手动设置了 `tokenBudget` 才硬裁剪；没有显式预算时只做估算与 Debug，不用应用默认值擅自删作者设定。

## 11. Memory

当前有六类：

- fact；
- subjective；
- shared；
- promise；
- relationship；
- story。

检索主要为本地关键词、重要度、时间、层级、锁定、日期和冲突评分，不是完整向量 embedding 引擎。

## 12. Provider

统一 OpenAI-compatible Provider，支持常规/streaming、usage、硬错误识别与中止请求。

## 13. Data

Dexie / IndexedDB：

```text
IndexedDB：V14
Backup：V9
```

图片主要使用 Data URL；当前没有跨设备云同步。

## 14. Prompt Debug

用于检查 prompt 分区、usage、memory hit、WorldBook hit、resource Focus/defer、estimated saved characters、scene transition、presence、runtime contract、raw/visible reply。

## 15. 当前技术债

- `ChatRoom.vue` 仍过大；
- WorldBook Engine V2 第一阶段已实现 recursion / sticky / cooldown / delay / group scoring / token budget / depth-position；仍需继续对齐更多 SillyTavern 边界语义、跨分支 timed-effect 细节与更精确的 provider tokenizer；
- Community UI Compiler 尚未覆盖全部结构；
- 图片 Data URL 占用较多 IndexedDB；
- 长消息列表未完整虚拟化/分页；
- 无跨设备同步。

## 16. 文档规则

当前架构只维护在本文件。历史实现细节统一归档到 `RELEASE_HISTORY.md`。
