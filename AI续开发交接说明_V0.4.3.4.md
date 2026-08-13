# AI Companion Phone 续开发交接说明 · V0.4.3.4

## 当前基线

- 应用版本：0.4.3.4
- IndexedDB：V10
- 完整备份格式：V9
- 当前产品方向：长期陪伴内核 + Tavo / SillyTavern 社区资源兼容运行时。
- 安全边界：社区 HTML/CSS 可经安全渲染链路运行；第三方 JavaScript 只归档，不直接执行。

## 本版为什么做

V0.4.3.4 是基于真实聊天截图和一整包社区 JSON / ZIP / TXT 资源完成的可靠性与兼容修复，不是只修一种 `scene_action` 写法。

本轮同时处理：

1. 最大输出只有 576 / 600 导致回复截断、半截 XML 和“回复中断”。
2. Prompt 调试记录把 Vue Proxy / 不可克隆对象直接写 IndexedDB 导致 `DataCloneError`。
3. `scene_action` 属性、空格、大小写或流式半截标签泄漏到聊天正文。
4. 动作与对白显示策略固定，不能满足“远程默认分开、同场默认合并、用户可手动覆盖”。
5. 旧直接接触正则把普通“把你 / 将你”误判成身体接触。
6. Character Card / Lorebook / Preset / Regex / Persona 的真实 Tavo / SillyTavern 字段仍有漏读或只归档不运行的问题。
7. “我的资料”中角色专属 Persona 的 Data URL 头像被当普通文本显示，页面被撑坏。

## 已完成：聊天可靠性

### 最大输出长度

- 默认 `maxTokens` 从旧 576 / 600 提升到 2048。
- 已保存的旧默认值 576 / 600 在读取时自动迁移为 2048。
- 用户自己设置的其它值不强制覆盖。
- Provider 内部兜底值同步改为 2048。

### Prompt Debug DataCloneError

`promptDebugService` 写 Dexie 前统一经过 `toPlainStorageValue()`，不再把 Vue Proxy / reactive 嵌套对象直接交给 IndexedDB。

目标错误：

```text
Failed to execute 'put' on 'IDBObjectStore':
[object Object] could not be cloned. DataCloneError
```

### Scene Action 容错

现在兼容：

```xml
<scene_action>...</scene_action>
<scene_action perspective="remote">...</scene_action>
< scene_action perspective=" remote " >...</scene_action>
<scene-action>...</scene-action>
```

并对流式截断的：

```text
<scene_act
<scene_action perspective="remote">动作...
```

做可见文本清理。标签碎片不应再进入普通聊天气泡。

历史消息加载时也会清理已经保存的残缺 scene_action 标记。

### Presence 冲突解析

仍保持：

```text
用户手动指定
> 明确直接身体接触
> 明确用户在场
> 结构化 presence
> “周围=独处”弱信号
> 上一轮状态
```

同时收紧直接接触匹配，不再用单独的“把你 / 将你”作为强证据：

```text
把你介绍给导演           -> 不强制 together
将你说的话记下来         -> 不强制 together
把你圈进怀里             -> together
将你捞进怀里             -> together
轻轻拍了下你的后背       -> together
```

## 已完成：动作与对白排版

`ChatSettings` 新增：

```ts
actionTextLayout: 'auto' | 'separate' | 'merged'
```

规则：

- `auto`：remote 默认分开；together 默认合并。
- `separate`：无论当前 presence，动作与对白都分开。
- `merged`：无论当前 presence，动作与对白都合并。

合并格式不插入换行：

```text
（翻过身，手臂一伸，将你捞进怀里）我也没睡着。
```

而不是：

```text
（翻过身，手臂一伸，将你捞进怀里）
我也没睡着。
```

用户手动选择排版优先于自动排版；presence 的手动指定仍保持场景判定最高优先级。

## 本轮真实社区资源复核

用户提供的资源包实际包含：

- Character Card V2/V3：32 张
- Lorebook：10 本，共 211 条 entries
- Prompt Preset：7 份
- Regex ZIP：2 个，共 8 条有效 Regex JSON
- TXT：2 个，其中一份用户 Persona 为 GB18030 编码

定向解析回归结果：

```text
Character Card  32 / 32
Lorebook         10 / 10
Lorebook entry  211 / 211
Prompt Preset     7 / 7
Regex JSON        8 / 8
GB18030 Persona   可正确解码并提取
```

详细兼容审计见：

```text
docs/COMMUNITY_JSON_COMPAT_V0.4.3.4.md
```

## Character Card 兼容

新增/加强：

- `data.extensions`
- root `extensions`
- `talkativeness`
- `depth_prompt`
- `depth_prompt.prompts[]`
- `world`
- root / data `regex_scripts`
- `group_only_greetings`
- root avatar
- root 其它元数据无损保留

运行时实际使用：

- `talkativeness`：参与角色主动程度与远程消息节奏。
- `depth_prompt`：进入角色运行时 Prompt。
- `world`：作为角色卡世界提示保留并进入上下文。
- `regex_scripts`：随角色作为角色专属 Regex 导入。
- `{{user}}` 模板：继续可生成角色专属 Persona。

`tavern_helper`、`puppybot` 等未知/脚本扩展保存原始数据；JavaScript 不自动执行。

导出 V2 时会尽量回写这些已识别扩展，并保留 root extension 兼容信息。

## Lorebook 兼容

真实资源大量使用 camelCase。V0.4.3.4 已同时识别 camelCase / snake_case，重点包括：

```text
uid
key / keysecondary
order
selectiveLogic
caseSensitive
matchWholeWords
groupOverride / groupWeight
scanDepth
excludeRecursion / preventRecursion / delayUntilRecursion
useGroupScoring
matchPersonaDescription
matchCharacterDescription
matchCharacterPersonality
matchCharacterDepthPrompt
matchScenario
matchCreatorNotes
```

`vectorized / addMemo / automationId / displayIndex` 等暂未完整运行的字段保存在 `rawExtensions`，不静默丢失。

Lorebook 运行时在相应 match flags 打开时，会把当前 Persona、角色描述、人格、Depth Prompt、Scenario、Creator Notes 纳入匹配来源。

## Prompt Preset 兼容

修复旧逻辑“只拿第一个 `prompt_order`”。

真实资源中存在：

```text
prompt_order group A: 11 项
prompt_order group B: 212 项
```

新版按 prompt identifier 覆盖率与完整度选择实际运行组，因此会选 212 项，而不是误选 11 项；所有 order groups 仍完整保存。

支持常用文本宏：

```text
{{char}}
{{user}}
{{scenario}}
{{personality}}
{{persona}}
{{description}}
{{lastChatMessage}}
{{lastUserMessage}}
{{setvar::...}}
{{getvar::...}}
{{random::...}}
```

未知动态占位符不乱删，继续保留给模型/未来兼容层。

Preset 自带 temperature / top_p / model / reasoning 等供应商参数无损保存，但不自动覆盖本 App 的 API 与模型设置。

## Regex / Rich UI

- ZIP 自动跳过 `__MACOSX` 与 `._*` macOS 资源叉。
- ZIP 未标 UTF-8 flag 但文件名实际为 UTF-8 时，会优先严格 UTF-8 解码，再回退 GB18030，避免中文名乱码。
- 两个真实 Regex ZIP 共 8 条有效 JSON 均可解析。
- User Input / AI Response / World Info / Prompt Only 基础管线继续运行。
- Lorebook / Regex 诱导模型生成的 HTML/CSS UI 继续由 SafeRichHtml 隔离渲染。
- `script`、事件属性、`iframe`、`javascript:` 等危险内容继续阻止。

## Persona 与“我的资料”

Persona 文本导入新增 UTF-8 -> GB18030 解码回退。真实 GB18030 用户人设可以读取姓名、年龄、身高、外貌、性格等内容。

“我的资料”页面重新整理为：

1. 顶部手机基础身份概览；
2. Persona 概览，区分全局 Persona / 角色专属 Persona；
3. 基础昵称、身份、简介和头像编辑。

角色专属 Persona 头像改用 `CharacterAvatar` 组件渲染，Data URL / base64 不会再直接作为一长串文字显示。

## 数据兼容

- IndexedDB：V10
- 完整备份：V9
- 本版本没有修改 Dexie schema，因此不需要数据库迁移。

## 本版有意保留的限制

这些项目不要在后续交接中误写成“已经 1:1 完整支持”：

1. WorldBook recursion / sticky / cooldown / delay 现在仍是兼容近似，不是原客户端完整逐消息状态机。
2. `vectorized` 只保存，未启用向量检索。
3. Preset marker / Prompt Order 已能基础运行，但还没有完整的可视化 Prompt Manager / 顺序编辑器 / 单项调试界面。
4. Regex 已有运行时，但还没有完整可视化编辑器、排序器与测试台。
5. 独立 Theme JSON 仍以识别和无损归档为主；本次测试包也没有独立 Theme JSON。
6. 第三方 JavaScript 不因兼容目标而放开执行。

## 已做验证

- 82 个 TS / Vue script block 语法扫描：0 syntax diagnostics。
- 核心 interaction runtime：Scene Action 半截标签、同场合并、远程分开、手动排版、presence 冲突与误判案例通过。
- 32/32 Character Card、10/10 Lorebook、211/211 entries、7/7 Preset 定向解析通过。
- 2 个 Regex ZIP 共 8/8 有效 Regex JSON 解析通过。
- GB18030 Persona 实文件解析通过。
- Preset `setvar / getvar / random` 定向运行通过。

当前容器没有完整可用的项目依赖缓存；`npm ci --offline` 缺少 `zod-3.25.76`，因此这里无法完成完整 `vue-tsc -b && vite build`。最终完整构建仍请在 Windows 项目目录执行：

```powershell
npm run build
```

## 下一版建议：V0.4.3.5

不要再扩普通聊天功能，继续完成社区兼容主线：

1. **WorldBook Engine V2**：递归扫描、sticky/cooldown/delay、token budget、position/depth 的更精确状态机。
2. **Preset Prompt Manager**：所有 Prompt 节点、order group、marker、启停、拖拽排序、运行结果和宏变量调试。
3. **Regex 编辑器**：placement、depth、display-only/prompt-only、排序、单条测试、处理前后预览。
4. **Theme Runtime V1**：对独立 Theme JSON 做安全结构化映射，不执行第三方 JS。
5. **兼容报告 UI**：明确显示“已运行 / 部分运行 / 仅保留 / 安全阻止”，并可查看原始字段。

## 新对话继续开发提示

上传最新版 ZIP + 本文件后可直接说：

“请先完整阅读 `AI续开发交接说明_V0.4.3.4.md` 和项目源码。当前基线 V0.4.3.4 / IndexedDB V10 / backup V9。不要退回普通聊天 App；继续 Tavo / SillyTavern 社区资源兼容主线，并保留第三方 JS 不执行的安全边界。完成代码后要做定向回归、版本文档、干净 ZIP 和新的交接说明。”
