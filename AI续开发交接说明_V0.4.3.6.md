# AI Companion Phone 续开发交接说明 · V0.4.3.6

## 0. 当前基线

- 应用版本：0.4.3.6
- IndexedDB：V10
- 完整备份：V9
- 技术栈：Vue 3 + TypeScript + Vite + Pinia + Dexie + PWA
- 产品方向：local-first 的 AI Companion Phone / 社区角色资源运行时，不只是聊天页面。
- 社区兼容目标：Tavo / SillyTavern Character Card、Persona、WorldBook、Prompt Preset、Regex、Theme/UI；未知字段尽量无损归档。
- 安全边界：第三方 JavaScript 不直接执行；Safe Rich HTML 过滤 script/iframe/事件属性/javascript URL。

V0.4.3.6 是对 V0.4.3.5 的格式优先级修正：用户明确不要再靠“小手机自己的动作/对白选项”决定社区角色回复；如果 JSON 本身定义 UI，就必须按照 JSON 原 UI/输出协议生成与显示。

## 1. 本版核心原则

```text
社区 JSON 自带 UI / 固定输出协议
↓ 最高格式优先级
角色卡 / Persona / WorldBook / Preset / Memory
↓
小手机默认动作 / 对白 / companion_packet
↓ 仅无社区 UI 时兜底
```

重点不是“检测到 HTML 就换个样式”，而是：

- 原 JSON 要求的 XML 标签继续输出；
- 原 WorldBook 要求的状态栏字段、顺序和位置继续输出；
- 原 Regex 需要什么输入标签，就在正则执行前保留什么标签；
- 原 HTML/CSS UI 直接走 Safe Rich Runtime；
- 小手机不能把这些内容先解析成 scene_action、括号动作或多气泡，导致社区 Regex 失效。

## 2. 新增 `communityUiRuntime.ts`

文件：`src/services/communityUiRuntime.ts`

主要接口：

- `detectCommunityUiContract(...)`
- `buildCommunityUiPriorityPrompt(...)`
- `regexProducesRichUi(...)`
- `sanitizeCommunityUiText(...)`

检测来源：

1. 本轮实际激活的 Lorebook Prompt；
2. 当前绑定 Prompt Preset；
3. 当前角色 assistant-output Regex；
4. prompt Regex；
5. Character system prompt / post-history instructions / depth prompt / creator notes / scenario / first message / alternate greetings / raw extensions。

强信号：

- “每次回复必须 / 最高优先级 / 严格遵守 / 输出格式 / 状态栏格式 UI”；
- `<日期> / <地点> / <状态栏> / <U状态> / <角色心声>` 等固定标签；
- `<div> / <style> / <details> / <!DOCTYPE html>`；
- assistant-output Regex replacement 生成 HTML/CSS。

返回 mode：

- `regex-html`
- `html-contract`
- `structured-contract`
- `none`

## 3. Prompt 运行时改动

`ChatRoom.vue` 在拿到：

- active Preset
- active assistant/user/world/prompt Regex
- 本轮 WorldBook Prompt

之后立即检测 `communityUiContract`。

如果 active：

- streaming preview 强制隐藏，避免半截 HTML/XML 闪进聊天；
- `composeRoleplaySystemPrompt` 不再注入 hardcoded RoleCard UI 模板；
- 不再注入 `buildInteractionProtocolPrompt`；
- 自然回复规则不再要求“一句话一个气泡 / 同场动作合并”；
- Preset / prompt Regex 完成后，在最终 system prompt 尾部追加“社区 UI 输出接管 · 最高优先级”；
- 明确要求模型不要自行加入 `<scene_action>` / `<companion_packet>`，除非社区资源自己要求。

## 4. Response / Regex 顺序修复

旧流程：

```text
模型原始输出
→ parseCompanionOutput
→ visibleText
→ assistant Regex
```

这会把某些社区 XML / 状态标签提前吃掉或改写。

V0.4.3.6 UI 模式：

```text
模型原始输出
→ assistant Regex（直接吃 raw output）
→ Rich HTML 检测
→ Safe Rich Runtime
```

若 Regex 没生成 Rich HTML，也保留社区结构化文本，只清理小手机自己的 `companion_packet / role_status / scene_action` 私有残片，不把社区 XML 改写成动作气泡。

普通角色仍走旧解析管线。

## 5. 动作 / 对白设置变化

聊天设置页已经删除：

```text
动作与对白排版
- 自动
- 始终分开
- 始终合并
```

现在普通角色只自动：

```text
remote   → 分开
 together → 合并
```

旧数据库的 `actionTextLayout` 字段继续保留，避免备份/类型兼容问题，但 `resolveActionTextLayout()` 不再让 `separate/merged` 覆盖自动场景逻辑。

“普通聊天动作”和“小手机互动协议”仍保留，但 UI 文案明确：只在没有社区 UI 时生效；检测到社区 UI 会自动让位。

## 6. Full HTML Runtime 修复

社区 Regex 常返回：

```html
<!DOCTYPE html>
<html>
<head>
<style>...</style>
</head>
<body>...</body>
</html>
```

旧 `normalizeRichHtml()` 只会去 Markdown fence，完整 document 再塞到 Shadow DOM 容器存在结构错位风险。

现在：

- 提取 `<head>` 中所有 `<style>`；
- 提取 `<body>` 内容；
- 合成为 Shadow DOM 可挂载 fragment；
- SafeRichHtml 将 CSS 的 `body/html { ... }` 映射为 `:host { ... }`。

安全过滤保持原样。

## 7. 两个用户真实 JSON 回归

### 墨清尘

文件：`Tavo_墨清尘_20251008T2000.json`

其内嵌世界书“状态栏”条目：

- constant = true
- 明确要求“每次扮演 {{char}} 回复正文开头必须携带状态栏格式 UI”；
- 提供 `<div>/<details>` HTML/CSS 模板。

V0.4.3.6 detector 实测：

```text
active = true
mode = html-contract
reason = 世界书定义了每轮 UI / 状态栏输出格式
```

### 离婚的诱惑

文件：`cb118ca09fa1bd50.json`

其世界书“状态栏”条目明确要求每次回复末尾输出：

```xml
<日期>...</日期>
<时间>...</时间>
<地点>...</地点>
...
```

内嵌 assistant Regex“状态栏”再把这组 XML 转成完整 HTML UI。

V0.4.3.6 detector 实测：

```text
active = true
mode = regex-html
reason = 输出正则生成 UI + 世界书定义了每轮 UI / 状态栏输出格式
```

## 8. Prompt Debug

Prompt 中新增分区：

```text
【社区 UI 输出接管 · 最高优先级】
```

Prompt Debug 的 rule influences 会显示：

```text
检测到社区 JSON 自带 UI / 固定输出协议；
本轮由社区格式接管，小手机动作/对白排版不会覆盖它。
```

UI 模式下 trace 的 `protocolEnabled` 记为 false，因为本轮实际没有注入小手机动作协议。

## 9. V0.4.3.5 仍需记住的上下文

上一版已完成：

- 删除“刚刚来到这个世界 / 期待认识你”固定初始占位；
- 从 first_mes 修复真实关系/活动；
- 从 Character Book “user人设”识别角色专属 Persona；
- `{{user}}` 只作为占位符，不瞎猜用户名；
- 普通 `<br>` 开场换行；
- alternate greetings 走宏 + Regex + Rich UI；
- 墨清尘可识别专属 Persona“洛梨”。

详细历史见 `AI续开发交接说明_V0.4.3.5.md`。

## 10. 验证

本容器没有完整项目 node_modules，因此完整：

```text
vue-tsc -b && vite build
```

仍需用户 Windows 构建确认。

本容器已完成：

```text
86 个 TS / Vue script block 语法扫描：0 error
重复对象 literal 属性扫描：0
communityUiRuntime + interactionProtocol + roleCardUiService strict tsc：通过
真实墨清尘 UI detector：html-contract
真实离婚的诱惑 UI detector：regex-html
旧 actionTextLayout=separate/merged：已验证不会再覆盖自动场景排版
```

## 11. 下一步建议

V0.4.3.7 再进入主线：

1. WorldBook Engine V2：真正 sticky/cooldown/delay/recursive/group scoring/token budget；
2. Preset Prompt Manager：可视化顺序、启停、角色/全局绑定；
3. Regex 编辑器：placement、test input/output、UI preview；
4. Theme Runtime V1：社区美化 JSON 的安全映射；
5. UI 兼容诊断：明确告诉用户“这张卡的 UI 来自哪个 WorldBook/Regex，哪些交互因 JS 安全边界降级”。


Safe Rich HTML 仍不执行第三方 JS；常见 `data-target` 标签页由本地安全交互层恢复 active 切换。
