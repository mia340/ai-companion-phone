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
