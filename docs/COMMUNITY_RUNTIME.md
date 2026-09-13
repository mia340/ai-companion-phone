# Community Runtime｜社区资源兼容运行时

> V0.5.0-alpha.4.2 当前规则：**手机壳归 App，消息内部 UI 默认归社区作者资源**。Rich Regex / WorldBook HTML / 作者直接 HTML 优先于原生气泡；`first_mes` 与后续回复共享同一 Presentation Contract。

> V0.5.0-alpha.3.2 明确 Presentation 边界：**Chat 继续完整承载 Character Card / WorldBook / Regex / Community UI；朋友圈、音乐、海龟汤等原生 App 不执行或展示模型生成的第二层 UI**。旧兼容 fallback 仍以“不改作者原资源、不执行未知脚本”为边界。

> 当前文档只描述通用协议与运行边界。测试角色卡只能作为回归样本，生产逻辑禁止按角色名、作者名、卡 ID 或文件名特判。


## 0. V0.5.0-alpha.4.2 Presentation Priority

默认 `scene-merged` 下按以下顺序选择显示路径：

```text
1. assistant-output Regex 生成的 Rich HTML
2. WorldBook / Preset 声明的固定 HTML UI contract
3. 角色作者直接输出的 HTML
4. 作者结构化 / 纯文本内容
5. 原生手机聊天气泡
```

约束：

- Regex 只做显示投影时不改 canonical / raw 存储；富文本 Regex 的来源标记为 `regex`。
- WorldBook 固定 HTML 合同只允许本地 Compiler 把已有状态 / 正文填入作者模板，来源标记为 `worldbook-ui`。
- 作者直接 HTML 来源标记为 `card-ui`。
- `first_mes` 与 alternate greetings 会先解析角色卡、Preset、WorldBook、assistant-output / world-info Regex，再决定展示；这保证开场与后续回复连续。
- 对历史 `isGreetingSeed`，加载会话时允许做一次确定性呈现升级；不会生成新文本。
- `<br>` / `&lt;br&gt;` 在进入固定作者模板前只作为逻辑换行解析，之后再安全 escape，避免字面量泄漏。
- HTML 仍经过 `SafeRichHtml`；未知脚本不执行，固定宽度内容受手机 Surface 宽度约束。
- `phone-text` / `phone-split` 属于用户主动 presentation override，可以明确关闭作者 Rich UI。

## 1. 目标

AI Companion Phone 的社区兼容层面向：

- Character Card V2 / V3 与常见 Tavern JSON；
- PNG metadata 角色卡；
- WorldBook / Lorebook；
- Prompt Preset；
- Regex；
- HTML / structured markup 社区 UI；
- Persona 与 `{{user}}` 模板。

```text
Raw Community Resource
        ↓
无损归档 / Local Index（0 Token）
        ↓
ResourceBinding
        ↓
Prompt Compiler / Runtime
        ↓
AI 原始回复
        ↓
Regex / Structured Parser / Safe Community UI
```


## 1.1 Character Card 字段语义校准（V0.4.6.0）

| 字段 | 默认 Runtime 用途 | 默认进 Prompt |
| --- | --- | --- |
| name / V3 nickname | 身份与 `{{char}}` | 是 |
| description | 角色定义 | 是 |
| personality | 人格 | 是 |
| scenario | 作者建议/初始场景，可被当前 Conversation 事实覆盖 | 是 |
| first_mes | 选中时成为第一条真实 assistant 历史 | 否（不是 system） |
| alternate_greetings | 新聊天开场池 | 否（选中后进历史） |
| mes_example | 示例对话 | 是，按上下文预算 |
| creator_notes | 作者给使用者看的说明 | **V2/V3 否** |
| system_prompt | V2/V3 system override，支持 `{{original}}` | 是 |
| post_history_instructions | 历史后的作者最终指令 | 是 |
| character_book | WorldBook Runtime | 按触发 |
| regex_scripts | Regex Pipeline | 按阶段 |
| unknown extensions/assets/source | Raw escrow / 安全兼容 | 默认否 |

### V3 宏

V0.4.6.0 的 Prompt/开场兼容层支持 `{{user}}`、V3 nickname 驱动的 `{{char}}`，以及常见 `{{random:A,B}} / {{pick:A,B}} / {{roll:N}} / {{// comment}}`。`{{pick}}` 对同一 Prompt 使用稳定选择；`{{random}} / {{roll}}` 在每次 Prompt 编译时按规范随机。UI 展示层不会重新执行这些随机宏。

### 标准优先 + 社区兼容兜底

V3 `use_regex` 有自己的 key matcher 语义。若条目存在 regex keys，则按标准关键词路径执行；对于真实旧社区导出中 `constant=true + use_regex=true + keys=[]` 的矛盾数据，兼容层保留 constant 常驻，避免旧卡整本世界书失活。该兜底只处理可识别的冲突数据，不作为新的全局协议。


## 1.2 Regex Pipeline V2（V0.4.7.0）

社区 Regex 现在按 SillyTavern 常见语义拆成三个实际阶段：

| 配置 | 聊天存储 | 用户看到 | 下一次 AI 看到 |
| --- | --- | --- | --- |
| markdownOnly=false, promptOnly=false | **改写** | 改写后的 canonical | 改写后的 canonical |
| markdownOnly=true, promptOnly=false | 不改 | **临时显示替换** | canonical 原文 |
| markdownOnly=false, promptOnly=true | 不改 | canonical 原文 | **临时 Prompt 替换** |
| markdownOnly=true, promptOnly=true | 不改 | **临时显示替换** | **临时 Prompt 替换** |

`placement` 当前执行：1 用户输入、2 AI 回复、5 World Info；3 Slash 与 6 Reasoning 字段无损保留，主聊天暂未接对应运行时。`minDepth/maxDepth` 以最近消息为 Depth 0。手动编辑时只有 `runOnEdit=true` 的脚本重跑。

因此典型社区状态 UI 可以保持：AI 输出 XML/占位符存在于 canonical 历史，`markdownOnly` Regex 只在屏幕上转换成作者 HTML；若另有 `promptOnly` 隐藏脚本，下一轮发给模型时才移除内部标签。显示 HTML 不再被误存回聊天历史。

## 1.3 Community UI 承载与作者模板连续性（V0.4.7.1）

当作者世界书明确提供每轮 HTML 状态栏模板，而模型输出的是 `【状态栏】...【正文】...` 这类数据形态时，Community UI Compiler 可以确定性地把 AI 已生成的数据填回作者模板。`状态栏` 与 `状态信息` 都视为通用状态前导标签；应用只替换模板槽，不创造角色状态。

Rich HTML 的宿主表面按内容能力判定：作者 HTML 自带 background/border/shadow 时不套额外气泡；只有旧社区 `<details>/<br>` 等没有视觉表面的开场才提供中性承载背景。HTML 中混用的 `![](https://...)` Markdown 图片会转换成静态 `<img>`，之后仍由 SafeRichHtml 执行 URL/DOM 安全清洗。

三种呈现继续独立于 Presence：纯手机多条 text 必须共同回应最新用户消息；动作/台词分开模式可在远程场景展示角色自己一端的自然 `scene_action`，但不能暗示用户物理可见，也不能本地生成动作。

## 1.4 Chat-only Community Presentation（V0.5.0-alpha.3.2）

社区资源的 UI 能力不被全局禁用，而是限定在合适的 Surface：

- 聊天中的普通自然语言：本地白色 / 浅蓝气泡；
- 聊天中的作者状态栏、Regex UI、HTML 卡片：继续进入 `SafeRichHtml`；
- 一条 Rich 回复同时含普通正文和作者 UI：正文由 `SafeRichHtml` 的 local narrative wrapper 恢复白色气泡，作者 UI 不再被第二层外壳包住；
- 朋友圈 / 音乐 / 海龟汤：即便模型误输出 `<div>`, `<style>`, `<script>` 或 Markdown UI，`appPresentationPolicy` 也只保留自然语言内容，由 App 自己渲染。

这不是降低社区兼容，而是避免把“Chat 的作者 Presentation 能力”错误扩散到每一个 App Surface。

## 2. 核心原则

### 2.1 原卡是内容权威

角色台词、动作、心理、关系、NPC、剧情和状态字段只能来自 AI 与作者资源。本地运行时只做编排、解析、状态持久化和安全渲染，不本地续写角色内容。

### 2.1.1 Community UI 状态继承边界

Regex/XML 驱动的每轮状态 UI 若本轮正文已成功、但模型漏掉部分状态标签，运行时先从最近历史 `rawContent` 复用**上一轮真实 AI 已经生成过**的同名字段，再交给作者原 Regex 渲染。当前轮已有值永远优先。

若历史状态仍不足以补齐，允许一次**紧凑状态字段补全**：第二次请求只携带与 UI 直接相关的作者规则、角色核心摘要、当前 ConversationState、用户本轮真实消息和第一版 AI 正文，并要求模型只返回作者声明的状态标签。第一版正文不重写，不再次发送完整聊天历史和整份世界书。补全结果只能填充合同已声明的标签，额外标签丢弃；字段仍不完整时直接降级保留正文，应用不得本地编造好感、心声、计划或剧情。

合并后的作者结构写入消息 `rawContent`，用于下一轮 Regex/UI 状态连续性；用户可见正文仍以第一版真实 AI 回复为准。

### 2.2 Regex 是后处理器

Regex 单独存在时不能反推出“模型必须输出这个结构”。

```text
AI 原始回复
↓
Regex 命中 → 替换
Regex 未命中 → 保留原文
```

只有角色卡 / WorldBook / Preset / System Prompt 明确声明固定输出格式时，才建立强输出合同。

### 2.3 Community UI 与第三方 JavaScript

作者 HTML/CSS 可以安全呈现；未知第三方 JavaScript 不直接执行。

运行时优先：

1. 使用作者静态 HTML/CSS；
2. 从 AI 已生成的数据中解析动态字段；
3. 使用安全本地交互重建常见 Tab / details / data-target；
4. 无法安全还原时保留正文并提示脚本被阻止。

### 2.4 User Message Ownership

AI 不得替 `user / {{user}} / 自己 / 我方` 凭空新增真实用户消息。微信、短信、群聊等模板中的用户侧气泡只能引用真实用户历史。

### 2.5 资源调度

大型、作者明确“按需打开”的功能模块可以休眠；作者要求“每轮必须输出”的状态栏或固定协议不得因为 Token 优化被休眠。

Resource Intent Router 依据资源标题、keys / secondary keys、作者触发语句、用户当前意图与 Active Resource Session。禁止通过角色名硬编码触发。

## 3. 当前输出层次

```text
AI Raw Reply
├─ Author Text Status Header
├─ Action
├─ Dialogue
├─ Structured Contract
└─ Community Resource UI
```

三种聊天呈现方式只影响用户如何看回复，不自动决定世界事实：

- `scene-merged`：场景合并；
- `phone-text`：纯手机，只投影角色真正发送/说出的语句；
- `phone-split`：动作与台词分离。

## 4. WorldBook Engine V2

V0.4.5.0 开始把此前已归档的 ST/Tavo 高级字段真正接入执行层。

V0.4.6.0 进一步按 Character Card V3 规范校准：`use_regex=true` 且存在 keys 时，条目按 Regex key 匹配，`constant` 不主导激活；对于真实旧社区导出中 `constant=true + use_regex=true + keys=[]` 的矛盾数据，保留 constant 常驻作为窄兼容兜底。这样既不把旧卡整本判死，也不把兼容例外升级成新的全局协议。

### 4.1 初始匹配

支持：

`constant / keys / secondary keys / useRegex / matchWholeWords / caseSensitive / selective / selectiveLogic / scanDepth / probability / useProbability / persona/character/scenario/creator-note matching`

`selectiveLogic` 按 SillyTavern 当前语义执行：

```text
0 = AND ANY
1 = NOT ALL
2 = NOT ANY
3 = AND ALL
```

这修正了旧运行时把 1/2 对调的兼容错误。

### 4.2 Timed Effects

`sticky / cooldown / delay` 以**消息数**为时间单位，并保存在当前 Conversation 的 `lorebookRuntime`：

- Sticky：首次激活后继续保持 N 条消息，期间不重复刷新概率；
- Cooldown：Sticky 结束后（或无 Sticky 时从首次激活后）N 条消息内禁止重新激活；
- Delay：聊天消息数未达到 N 时不允许激活；
- 条目被编辑后 `updatedAt` 改变，旧 timed effect 自动失效；
- Branch 只继承分支节点以前仍有效的 effect。

### 4.3 Recursive Scanning

已支持：

- 激活条目内容继续触发其它条目；
- `excludeRecursion`：目标不能被递归触发；
- `preventRecursion`：该条目激活后不再触发下游；
- `delayUntilRecursion`：初始扫描不触发，只允许递归波次激活；
- 世界书 `recursiveScanning=false` 时禁止该资源参与递归链；
- 内部最多 8 层安全防环，后续再开放用户级 Max Recursion Steps。

### 4.4 Inclusion Group / Scoring

支持一个条目属于多个逗号分隔 group。

- 同组同时激活时只保留赢家；
- 默认按 `groupWeight` 加权随机；
- `groupOverride` 存在时按较高 `order/insertionOrder` 确定性优先；
- `useGroupScoring` 时先按命中 key 数评分，只让最高分子集继续竞争；
- AND ANY / AND ALL 的 secondary key 会参与分数，NOT ANY / NOT ALL 不加分。

### 4.5 生成前 Token Budget

世界书资源本身已有 `tokenBudget` 字段。V0.4.5.0 正式执行：

- 只有资源明确配置预算时才硬裁剪；
- 没有预算时只估算，不使用应用私有默认预算删作者内容；
- Focus / Active Resource Session / 作者每轮强制合同优先保护；
- 普通常驻、直接关键词、Sticky、递归条目按来源与 order 决定预算优先级；
- Prompt Debug 显示估算 Token、预算淘汰与原因；API 返回 usage 时仍以真实 usage 为最终依据。

当前估算不是 provider tokenizer 的精确结果，后续可按模型接 tokenizer。

### 4.6 Position / Depth / Outlet

当前映射：

```text
0 Before Char      → 角色卡前
1 After Char       → 角色卡后
2 Author Note Top  → 当前单-system 架构中的近历史高影响区顶部
3 Author Note Bottom → 近历史高影响区底部
4 @D               → 真正插入 chat messages，支持 system/user/assistant role + depth
5 Example Top      → 示例对话前
6 Example Bottom   → 示例对话后
7 Outlet           → 保存为 outlet，Prompt Preset 可用 {{outlet::Name}} 读取（名称大小写敏感）
```

其中 2/3 仍是兼容映射：本项目当前没有 SillyTavern 那种独立 Author's Note frequency 执行器，因此不能宣称 100% 同构。

### 4.7 Debug

Prompt Debug 新增：

- evaluated entries；
- initial / recursive activation；
- recursion steps；
- estimated budget / used tokens；
- budget drop；
- Sticky / Cooldown / Delay；
- Group 淘汰；
- @D title/depth/role。

### 4.8 下一阶段

仍待：

- Min Activations / Max Depth；
- 用户可配置 Max Recursion Steps；
- vectorized / embedding trigger；
- Author Note 真正独立频率；
- decorators / automation / outlet 更完整语义；
- provider tokenizer 精确预算。
