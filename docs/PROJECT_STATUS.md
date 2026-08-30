# AI Companion Phone 项目状态

## V0.4.7.1｜Community UI / 编辑后重生成稳定补丁

本轮不是新协议大改，而是对 V0.4.7.0 真实角色卡验收暴露的四条运行链做通用修复：

- Community UI Compiler 的状态前导解析同时识别 `状态信息 / 状态栏`，AI 已生成状态数据时可本地填回作者原 HTML，不为 UI 重写剧情；
- Rich UI 外层不再一律透明：作者 HTML 已自带背景/边框/阴影时保持透明承载，只有裸 `<details>/<br>` 等旧开场时增加中性表面；旧 HTML 开场内的 Markdown 图片转成安全静态 `<img>` 后仍由 SafeRichHtml 清洗；
- 纯手机多气泡要求共同回应最新用户消息，禁止为了手机感拆成语义断裂的泛泛短句；是否追问具体细节仍由角色与语境决定；
- 动作/台词分开模式在存在自然反应且作者未要求纯消息时，优先要求至少一个有情境价值的 `scene_action`；远程动作只描述角色自己一端，不改变 Presence；
- 用户消息可“从这条消息重新回复”：确认后截断后续旧分支，回滚该分支的状态历史、调试记录与自动记忆，再按编辑后的真实消息重新生成；手工/导入记忆不会被误删；
- IndexedDB V14 / Backup V9 不变，不需要清库或重导角色卡。

## V0.4.7.0｜Regex Pipeline V2 / Renderer 分层

本轮继续“大改”，但只重构生态兼容层，不推翻 Conversation、WorldBook、Memory 或数据库。核心目标是把同一条消息拆成 **模型原始输出 / 规范化存储 / 显示投影 / 下一次发给 AI 的临时投影**，避免社区 Regex 把 HTML 写进历史或把 promptOnly 错套到整个 System Prompt。

- User Input / AI Response / World Info 按 placement 分源执行；
- persistent / markdownOnly / promptOnly / 两者同时四种语义分离；
- Depth 0=最近消息，minDepth/maxDepth 在出站历史上执行；
- 出站 Prompt 的候选筛选不提前假定 depth=0，`minDepth>0` 会在真实历史行上逐条判断；
- 开场与手动编辑进入同一 Regex Pipeline；
- markdownOnly Rich UI 继续由 Safe Community UI 渲染，底层 canonical 内容保持作者原结构；
- Prompt Debug 可直接观察每一阶段实际命中的 Regex；
- Slash / Reasoning placement 完整保留，当前主聊天暂不执行，避免假装兼容；
- IndexedDB V14 / Backup V9 不变。

## V0.4.6.0｜Character Card Compatibility Alignment

本轮把开发方向从“继续发明更多角色卡运行规则”改为“**社区底层跟成熟生态，产品体验保留小手机特色**”。核心改动：

- 新增轻量 `Character Compatibility Layer / Runtime Manifest`，不改 IndexedDB schema；
- V2/V3 `creator_notes` 只供阅读，默认 0 Prompt Token；
- V2/V3 `system_prompt` 与 `post_history_instructions` 按 override 语义执行，支持 `{{original}}`；原生角色继续保持原有 append 行为；
- V3 `nickname` 成为 `{{char}}` 宏名，支持常见 `{{random}} / {{pick}} / {{roll}} / {{// comment}}`；
- `first_mes / alternate_greetings` 只作为用户选择后的真实 assistant 历史，不再从社区开场推断永久格式规则；
- V3 导入/再导出保留 nickname、multilingual creator notes、source、assets、日期字段及未知扩展，不强制降为 V2；
- WorldBook 对 `constant + use_regex` 改为标准优先、旧社区无 key 冲突数据兼容兜底；
- Regex/XML 社区 UI 本轮漏状态时，优先复用上一轮**真实 AI 已生成**的同名状态字段；若仍不完整，第二次 AI 调用只补作者状态标签，不再重跑完整角色 Prompt/历史或重写正文；不本地生成剧情/好感/心声；
- Prompt Debug 新增 Character Card Runtime，可直接查看卡版本、system prompt 模式、宏名与 creator_notes 是否进 Prompt。

### 本轮没有推翻的特色

- 三种聊天呈现方式；
- Presence / Conversation State；
- 多聊天与 Branch；
- Resource Session；
- WorldBook Engine V2；
- 六层记忆；
- Safe Community UI；
- Prompt Debug；
- IndexedDB V14 / Backup V9。

## 当前版本

```text
应用：V0.4.7.1
IndexedDB：V14
Backup：V9
```

V0.4.7.1 延续 **Regex Pipeline V2 / Renderer 分层**，重点稳定 Community UI、三种呈现与用户消息编辑后的分支生命周期；底层协议与数据版本不变。

## 当前阶段

项目重点：

> **通用 Character Card / WorldBook / Preset / Regex / Community UI Runtime + 多会话剧情状态管理。**

生产逻辑禁止按测试角色名、作者名、卡 ID 或文件名特判。

## 已完成

### Phone / PWA

- 手机外壳、锁屏、桌面、Dock、设置；
- PWA / generateSW；
- 白色 + 极淡蓝应用主题；
- 本地持久化与备份恢复。

### Character / Persona

- 原生角色；
- 常见 SillyTavern / Tavo V2/V3 JSON；
- PNG metadata；
- 原卡阅读器；
- Persona 导入/导出；
- 角色专属 Persona；
- 同源角色卡重复导入提示。

### Conversation

- 同一角色多聊天；
- 自由开局；
- 多开场；
- 候选回复；
- Branch V2；
- 分支状态/记忆/resource session 快照；
- 基础消息编辑与删除。

### Prompt / AI

- 统一 Provider；
- streaming；
- Token usage；
- context/max token/quota 硬停止；
- Prompt Debug；
- card-first；
- 默认第二人称 user；
- 图片理解入口。

### Memory / World State

- 六层记忆；
- 提取、合并、冲突；
- 相关记忆评分；
- ConversationState / StateHistory；
- Presence；
- pre-generation scene transition；
- 主动消息基础能力。

### Community Runtime

- Shared Resource + ResourceBinding；
- WorldBook；
- Regex；
- Prompt Preset；
- Resource Intent Router；
- 大型按需模块休眠；
- Active Resource Session；
- Safe Rich HTML；
- User Message Ownership；
- Author Text Status Header；
- Action Parser V2；
- Dialogue Parser V2；
- Community UI Compiler V2 第一阶段。

## 当前限制

### WorldBook

V0.4.5.0 已完成 Engine V2 第一阶段：

- corrected selectiveLogic：0=AND ANY、1=NOT ALL、2=NOT ANY、3=AND ALL；
- recursive scanning，支持 excludeRecursion / preventRecursion / delayUntilRecursion；
- sticky / cooldown / delay 按“消息数”进入会话级生命周期；
- inclusion group、多 group、groupWeight、groupOverride 与 useGroupScoring；
- 仅在世界书明确设置 tokenBudget 时启用生成前硬预算，不用应用默认预算擅自裁掉作者设定；
- position 0/1/4/5/6 路由，@D 按 role/depth 注入聊天历史；
- position 7 Outlet 可被 Prompt Preset 的 `{{outlet::Name}}` 宏按名称大小写精确读取；
- Prompt Debug 显示递归、Timed Effects、Group、预算与 @D 注入。

仍需继续补齐：

- Author Note Top/Bottom 与 SillyTavern 原生“按频率注入”并非完全同构，目前映射到当前单-system Prompt 的近历史高影响区；
- Min Activations / Max Depth / Max Recursion Steps 用户配置；
- vectorized / embedding 触发；
- 更完整的 outlet / decorators / automation 语义；
- provider tokenizer 级精确预算（当前是生成前 Token 估算 + API usage 事后真实统计）。

### Community UI

- 未知第三方 JavaScript 不执行；
- 复杂 JS UI 仍可能安全降级；
- UI Compiler V2 尚未覆盖全部 HTML/DOM 模式。

### Memory / Data

- 核心检索仍是关键词/评分，不是完整向量数据库；
- 图片 Data URL 会增加 IndexedDB 占用；
- 无跨设备实时同步；
- 长消息列表仍需分页/虚拟化。

### Code

`ChatRoom.vue` 仍然过大，需要继续拆 generation pipeline、branch runtime、presentation projection。

## 下一里程碑

1. 用真实社区 WorldBook 回归 V0.4.5.0 的 recursion / timed effects / group / budget / @D；
2. WorldBook Engine V2 第二阶段：Author Note / Min Activations / vectorized / 更完整 position/outlet；
3. Community UI Compiler V2 扩展；
4. 把 Character Runtime / Conversation Runtime / App Surface 从 `ChatRoom.vue` 继续拆开；
5. 建立“角色—NPC—群聊—地点—事件”的 Entity Graph 基础；
6. 再进入群聊、朋友圈、日记、钱包、论坛/购物等上层 Phone OS 功能，并逐步引入 App read/write capability 权限。

## 参考项目学习后的长期决策

新一批公开参考项目（StoryPhone、Miya、InternalBeyond Mobile、Melt、Plume、汪汪机、FLOAT 等）只作为设计/工程参考，不代表本项目已经拥有它们的全部功能。当前吸收的长期原则：

- **Character Runtime 是核心，App 是 Surface**：微信、论坛、日记、购物等未来不应继续堆进单个 ChatRoom。
- **世界事实 / 通讯渠道 / 呈现方式三分离**：Presence 不等于微信，纯手机也不等于远程。
- **同一角色多会话是基础能力**：角色身份、资源与多个剧情存档分开。
- **上下文只装当前需要的内容**：WorldBook / Memory 都应“存很多、召回少量”，并可解释为什么命中/为什么没注入。
- **主动消息也走完整 Runtime**：时间、关系、记忆、世界书、未完成事件共同决定，而不是定时器直接写台词。
- **未来 App 引入能力权限**：读日历、写日历、发动态、查手机等 read/write capability 必须显式授权。
- **Community UI 走安全能力编译**：尽量把常见 DOM/Tab/数据绑定转成受控能力，未知第三方 JS 不直接执行。
- **本地优先继续保持**：IndexedDB + Backup + PWA 不推翻，未来同步是可选层，不成为角色运行时前提。

详细来源与学习记录见 `DEVELOPMENT_LOG.md`。

## 测试原则

底层更新至少覆盖：

- 简单纯文字卡；
- 多 WorldBook；
- Regex；
- Regex → HTML；
- 作者强制状态 UI；
- 大型按需资源；
- V3 / Depth Prompt；
- Persona / `{{user}}`；
- 多会话 / Branch；
- 三种呈现方式。

测试角色只能用于测试，不得进入生产条件分支。
