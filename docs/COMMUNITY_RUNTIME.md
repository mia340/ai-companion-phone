# Community Runtime｜社区资源兼容运行时

> 当前文档只描述通用协议与运行边界。测试角色卡只能作为回归样本，生产逻辑禁止按角色名、作者名、卡 ID 或文件名特判。

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

## 2. 核心原则

### 2.1 原卡是内容权威

角色台词、动作、心理、关系、NPC、剧情和状态字段只能来自 AI 与作者资源。本地运行时只做编排、解析、状态持久化和安全渲染，不本地续写角色内容。

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

## 4. WorldBook 当前执行能力

当前已支持/读取的常见字段：

`constant / keys / secondary keys / selective / selectiveLogic / useRegex / matchWholeWords / priority / order / insertionOrder / position / depth / role / scanDepth / probability / useProbability / sticky / cooldown / delay / group / groupWeight / groupOverride / useGroupScoring / excludeRecursion / preventRecursion / delayUntilRecursion / persona/character/scenario/creator-note matching`

部分高级字段已经能导入、编辑和保存，但完整 SillyTavern 语义仍需 WorldBook Engine V2 收口，尤其是：

- recursive scanning；
- cooldown / sticky 完整生命周期；
- group scoring；
- 生成前 token budget；
- depth / position 精确插入；
- 命中链调试。

## 5. 历史兼容审计归档

下面三节来自原来的社区兼容专题文档，合并后保留原始测试结论和字段观察。

---

## 5.1 Community JSON Compatibility Audit · V0.4.3.4

# Community JSON Compatibility Audit · V0.4.3.4

## 实际测试语料

本轮不是基于假想 schema，而是对用户提供的整包社区资源进行结构统计和解析回归：

| 类型 | 数量 | 关键结果 |
|---|---:|---|
| Character Card V2/V3 | 32 | 32/32 可解析 |
| Lorebook | 10 | 211 条 entries，211/211 可解析 |
| Prompt Preset | 7 | 7/7 可解析，多 `prompt_order` 可择优 |
| Regex ZIP | 2 | 8 个有效 JSON 可解析；macOS 资源叉自动跳过 |
| TXT | 2 | UTF-8 聊天文本 + GB18030 Persona 文本 |

## Character Card 字段观察

32 张卡共同使用标准 V2/V3 data 字段，扩展中实际出现：

- `regex_scripts`
- `talkativeness`
- `world`
- `depth_prompt`
- `tavern_helper`
- root `puppybot`
- root `regex_scripts / depth_prompt / talkativeness`
- `group_only_greetings`

策略：能安全解释的字段映射到角色运行时；未知扩展保留原始数据；JS 只归档不执行。

## Lorebook 字段观察

211 条真实 entries 全部包含 Tavo camelCase 主字段，包括：

`uid / key / keysecondary / constant / vectorized / selective / selectiveLogic / order / position / disable / excludeRecursion / preventRecursion / delayUntilRecursion / probability / useProbability / depth / group / groupOverride / groupWeight / scanDepth / caseSensitive / matchWholeWords / useGroupScoring / role / sticky / cooldown / delay`

其中部分资源还包含：

`addMemo / automationId / displayIndex / display_index / matchPersonaDescription / matchCharacterDescription / matchCharacterPersonality / matchCharacterDepthPrompt / matchScenario / matchCreatorNotes`

V0.4.3.4 已把实际需要参与匹配和排序的字段纳入 typed runtime；其它字段进入 `rawExtensions`。

## Preset 字段观察

7 份预设共同包含标准 prompt 模板字段；2 份大型预设还包含采样与供应商配置。

本轮真实发现并修复：某预设有两个 `prompt_order`：一个只有 11 项，另一个有 212 项。旧逻辑固定拿第一组会严重漏 Prompt；新版按 prompt identifier 覆盖率自动选择更完整的一组，同时保存所有 order groups。

Preset 内容里大量出现：

- `{{user}}`
- `{{char}}`
- `{{scenario}}`
- `{{personality}}`
- `{{lastChatMessage}} / {{lastUserMessage}}`
- `{{setvar::...}} / {{getvar::...}}`
- `random` 变量表达式

V0.4.3.4 对常用宏做安全文本替换；未知动态占位符继续留给模型理解，不会随意删除。

## UI / 美化观察

本包没有独立 Theme JSON，但多本 Lorebook 的 `content` 中包含完整 HTML/CSS UI 指令，例如状态栏、微信/朋友圈、校园墙、演唱会榜单、小剧场等。

兼容链路：

1. Lorebook 命中后将规则注入 Prompt；
2. 模型输出 HTML/CSS；
3. ChatRoom 检测 Rich HTML；
4. SafeRichHtml 隔离渲染；
5. 危险脚本和事件属性继续拦截。

这与“直接执行社区 JS”严格区分。

## 有意不假装支持的字段

- `vectorized`：保留，当前不启用向量检索。
- 原客户端完整 recursion / sticky / cooldown / delay 状态机：当前为兼容近似。
- Preset 供应商采样参数：保留，但 App 自己的 API 设置仍是最终权威。
- `tavern_helper` / JavaScript：保存，永不自动执行。
- 外部相对头像路径：JSON 没带图片文件时不伪装成可用图片，也不把路径/BASE64 当普通头像文字。

---

## 5.2 社区 UI 输出优先级 · V0.4.3.6

# V0.4.3.6 · 社区 UI 输出接管

## 目标

社区角色卡、世界书、Preset 或 Regex 已经定义 UI / 状态栏 / 固定输出格式时，小手机不再用自己的“动作与对白分开/合并”规则覆盖作者格式。

优先级改为：

```text
社区 JSON 自带 UI / 输出协议
↓
角色卡 / Persona / WorldBook / Preset / Memory 等内容约束
↓
普通小手机场景与动作协议（仅无社区 UI 时兜底）
```

## 识别来源

运行时会综合检查：

- 本轮实际激活的 WorldBook Prompt；
- 当前绑定的 Prompt Preset；
- 当前角色绑定的 assistant-output Regex；
- 角色卡 system prompt / post-history instructions / depth prompt / creator notes / first message / raw extensions。

强特征包括：

- “每次回复必须 / 严格遵守 / 最高优先级 / 输出格式 / 状态栏格式 UI”；
- `<日期>...</日期>`、`<状态栏>...</状态栏>`、角色状态/心声/计划等固定 XML 标签；
- `<div> / <style> / <details> / <!DOCTYPE html>` 等 UI 模板；
- assistant-output Regex 把状态标签转换成 HTML/CSS。

## UI 接管时的行为

检测到社区 UI 后：

1. 不注入小手机 `scene_action / companion_packet` 输出协议；
2. 不执行默认“远程分开、同场合并”的气泡整形；
3. 不把社区标签改成中文括号动作；
4. assistant-output Regex 直接作用于模型原始输出，避免模型标签在正则执行前被解析器吃掉；
5. Regex 生成 HTML 时直接进入 Safe Rich HTML Runtime；
6. Regex 未生成 HTML 时也保留社区结构化文本，只移除小手机自己的私有协议残片；
7. 流式生成期间隐藏原始标签预览，完成后一次性按 UI 渲染，避免 HTML/XML 碎片闪现。

## 普通角色

没有检测到社区 UI 时保持自动规则：

- remote：动作独立、对白按手机消息显示；
- together：动作与对白自然合并；
- 不再提供“始终分开 / 始终合并”的手动选择。

旧数据库里已有 `actionTextLayout=separate/merged` 不删除，以保证备份兼容，但运行时不再让它覆盖自动场景规则。

## Full HTML Regex 兼容

社区 Regex 常返回完整：

```html
<!DOCTYPE html>
<html>
<head><style>...</style></head>
<body>...</body>
</html>
```

V0.4.3.6 会提取 `<head>` 中的 `<style>` 和 `<body>` 内容，再挂载到 Shadow DOM；完整 document 不再直接塞进聊天 div。CSS 中 `body/html { ... }` 会安全映射到 Shadow Host。

安全边界不变：`script / iframe / object / embed`、事件属性和 `javascript:` URL 不执行。常见 `data-target` Tab 会由小手机自己的安全交互绑定恢复切换效果，不执行原卡脚本。

## 真实资源验证

### Tavo_墨清尘_20251008T2000.json

世界书“状态栏”条目明确要求每次回复开头携带状态栏 UI，并包含 `<div>/<details>` HTML 模板。检测结果：

```text
active = true
mode = html-contract
reason = 世界书定义了每轮 UI / 状态栏输出格式
```

### cb118ca09fa1bd50.json（离婚的诱惑）

世界书明确要求每次回复末尾输出 `<日期>/<时间>/<地点>/...` 固定 XML 状态栏，同时内嵌“状态栏” Regex 将其转换为完整 HTML。检测结果：

```text
active = true
mode = regex-html
reason = 输出正则生成 UI + 世界书定义每轮状态栏
```

## 数据版本

```text
应用：V0.4.3.6
IndexedDB：V10
Backup：V9
```

无数据库迁移。

---

## 5.3 初始状态与 User Persona Resolver · V0.4.3.5

# V0.4.3.5 · 初始状态与 User Persona 识别修复

## 这版解决什么

### 1. “刚刚来到这个世界”不再写死

旧版所有新角色都会得到同一条 activity，导致已经有几十年、几万年经历甚至明确场景的角色看起来像刚出生。

现在：

- first_mes 有明确 `💛 / 活动 / 状态`：使用卡内内容。
- 没有明确内容：activity 留空。
- 旧数据打开通讯录或聊天时自动清理这条历史占位。

墨清尘实测从 first_mes 得到：

```text
关系：师徒
活动：负手立于田埂
```

### 2. `{{user}}` 不再被误解成“一个待识别的用户名”

`{{user}}` 是社区角色卡宏。V0.4.3.5 把来源分开：

- 当前聊天 Persona：真正用于本轮 `{{user}}` 名称和用户资料。
- 原卡独立 user 人设：创建为角色专属 Persona。
- 世界书剧情身份：只作为本角色世界设定，不改全局用户资料。

### 3. 墨清尘的 user 人设现在能识别

它不是写在 description 的旧式 `{{user}}:` 块，而是在 character_book 的“user人设”条目里：

```text
{{user}}我是洛梨,墨清尘徒弟,筑基期剑修,20岁...
```

现在会识别出：

```text
姓名：洛梨
年龄：20
身份：墨清尘徒弟、筑基期剑修
作用域：仅墨清尘
```

### 4. 没有明确姓名的卡不瞎猜

像“离婚的诱惑”这种卡大量使用 `{{user}}`，也写了角色世界中的婚姻/职业等关系，但没有独立可安全提取的用户名。

处理规则：

- 不猜名字；
- 运行时使用当前 Persona 名称；
- 卡内剧情关系继续进入本角色 Prompt；
- 不把剧情身份写进全局“我的资料”。

### 5. `<br>` 和备用开场

普通文本开场中的 `<br>` 会变成正常换行；真正的 HTML/CSS UI 仍走 Safe Rich Runtime。

备用开场现在与首条开场共用：

```text
宏替换 → Regex → Rich UI → Role Card UI 状态 → ConversationState
```

## 数据版本

```text
应用：V0.4.3.5
IndexedDB：V10
完整备份：V9
```

无需数据库迁移。
