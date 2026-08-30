# AI Companion Phone 当前架构

> 当前文档版本：**V0.4.7.1**。  
> V0.4.6.0 在现有 Runtime 上增加薄兼容层：角色卡字段语义优先跟随 V2/V3 与成熟社区生态，不通过大改数据库来重新定义角色卡。  
> 历史架构演进已合并到 `RELEASE_HISTORY.md`。

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
