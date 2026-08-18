# AI Companion Phone 当前架构

> 当前文档版本：**V0.4.4.7.2**。  
> V0.4.4.7.2 仅整理文档；运行架构沿用 V0.4.4.7 / V0.4.4.7.1。  
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
Bound WorldBook Scan
        ↓
Resource Intent Routing
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
- WorldBook Engine V2 未完整实现 recursion/cooldown/sticky/group scoring/token budget；
- Community UI Compiler 尚未覆盖全部结构；
- 图片 Data URL 占用较多 IndexedDB；
- 长消息列表未完整虚拟化/分页；
- 无跨设备同步。

## 16. 文档规则

当前架构只维护在本文件。历史实现细节统一归档到 `RELEASE_HISTORY.md`。
