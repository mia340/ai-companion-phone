# AI Companion Phone 续开发交接说明 · V0.4.3.5

## 当前基线

- 应用版本：0.4.3.5
- IndexedDB：V10
- 完整备份格式：V9
- 产品方向：local-first 的 AI Companion Phone / 角色世界持续运行手机，同时尽可能兼容 Tavo / SillyTavern 社区资源。
- 安全边界：社区 HTML/CSS 走安全 Rich Runtime；第三方 JavaScript 继续只归档、不直接执行。

## 本版为什么做

V0.4.3.5 由真实通讯录、聊天截图和两张社区角色卡触发，重点不是增加新 App，而是先把“角色一导入就像刚出生”和 `{{user}}` 身份边界修正确。

用户反馈集中在三点：

1. 所有角色初始动态都显示“刚刚来到这个世界”，与角色卡已有剧情明显冲突。
2. 某些 Tavo 角色卡明明包含 user 人设，但导入后没有自动识别。
3. Tavo 开场里的 `<br>` 被普通文本气泡原样显示；多开场也需要与首条消息使用同一套兼容管线。

## 初始状态策略

### 不再伪造统一出生状态

新角色不再默认写入：

```text
心情：期待认识你
活动：刚刚来到这个世界
```

现在规则为：

```text
角色卡明确活动/状态
→ 使用角色卡内容

没有明确活动
→ 留空，不猜
```

例如墨清尘的 first_mes 含：

```text
💛负手立于田埂
▪关系:师徒
```

导入后应得到：

```text
关系：师徒
活动：负手立于田埂
```

通讯录显示为：

```text
师徒 · 负手立于田埂
```

而不是：

```text
朋友 · 刚刚来到这个世界
```

### 旧数据懒迁移

`ContactsView` 与 `ChatRoom` 加载角色时会调用 `normalizeLegacyCharacterInitialState()`：

- 历史 `activity === "刚刚来到这个世界"`：尝试从 first_mes 明确状态提取；提取不到就清空。
- 历史 `mood === "期待认识你"`：改为“平静”。
- 如果旧关系是空 / “朋友” / “未设定”，而 first_mes 明确写了 `关系:`，则采用卡内关系。

不升级 IndexedDB schema。

## `{{user}}` / Persona 的最终边界

### `{{user}}` 本身不是用户名

社区角色卡中的：

```text
{{user}}
```

只是运行时占位符，不能仅凭它推断用户是谁。

V0.4.3.5 明确分成三层：

1. **当前聊天 Persona**：当前会话真正用于替换 `{{user}}` 的用户身份。
2. **角色卡专属 Persona**：原卡明确提供独立 user 人设时，可创建并只绑定这个角色。
3. **角色世界剧情身份**：世界书中散落的“妻子 / 徒弟 / 旧职业 / 某段历史”等事实，只属于当前角色世界和剧情，不写回全局“我的资料”。

### 可以自动识别的情况

除 description 传统：

```text
{{user}}:
  ...
```

现在还扫描内嵌 character_book 中名称 / comment 类似：

```text
user人设
用户人设
user persona
user设定
用户设定
```

并支持自然语言首句：

```text
{{user}}我是洛梨,墨清尘徒弟,筑基期剑修,20岁...
```

实测解析为：

```text
name = 洛梨
age = 20
identity = 墨清尘徒弟、筑基期剑修
scope = character
```

创建角色时默认可建立“角色专属 Persona”，不会设成全局默认，也不会影响其它角色。

### 不应该自动猜的情况

如果卡里到处使用 `{{user}}`，并提供“配偶、前明星”等剧情事实，却没有独立、安全可提取的 user 姓名 / Persona 块：

- 不猜名字；
- 不新建假的“真实用户”；
- first_mes / alternate greetings 中 `{{user}}` 使用当前聊天 Persona 名称；
- 剧情身份仍通过 Character / WorldBook / Scenario 进入当前角色 Prompt；
- 不污染全局用户资料。

这就是“离婚的诱惑”这类 V3 卡的处理方式。

## 开场 / Alternate Greeting 兼容

### 普通 `<br>`

`normalizeCommunityPlainText()` 现在把普通文本中的：

```html
<br>
<br/>
<br />
```

转换为真实换行。

如果内容本身是完整 Rich HTML，则不破坏 HTML，仍交给 Safe Rich Runtime。

### alternate greetings

ChatRoom 插入备用开场时现在统一执行：

```text
{{user}} / {{char}} 宏
→ 当前启用 Regex
→ Rich HTML 判定 / 安全渲染
→ Role Card UI 状态抽取
→ ConversationState 更新
```

不再把 alternate greeting 当普通纯文本直接塞入消息。

### Tavo 状态头

`extractRoleCardUiHints()` 扩展识别：

```text
📆日期｜时间｜时段
🗺地点
♥内心
😶在场角色
```

以及常见 XML：

```xml
<日期>...</日期>
<时间>...</时间>
<地点>...</地点>
```

注意：XML 原文不在这一层强行删除，以免破坏社区 Regex / Rich UI 规则。

## 当前修改文件

核心：

- `src/services/characterCardImportService.ts`
- `src/services/characterInitialStateService.ts`（新增）
- `src/services/regexRuntime.ts`
- `src/services/roleCardUiService.ts`
- `src/services/promptComposer.ts`
- `src/views/CharacterCreate.vue`
- `src/views/ContactsView.vue`
- `src/views/ChatRoom.vue`

测试：

- `src/services/characterInitialStateService.test.ts`
- `src/services/regexRuntime.test.ts`
- 既有 Character Card / Role Card UI 测试继续保留。

## 实际资源验证

### 墨清尘 Tavo V2

真实文件验证结果：

```text
name: 墨清尘
relationship: 师徒
embedded user: 洛梨
age: 20
identity: 墨清尘徒弟、筑基期剑修
initial activity: 负手立于田埂
```

### 离婚的诱惑 V3

真实文件验证结果：

```text
name: 离婚的诱惑
explicit embedded user persona: 无
{{user}} placeholder: 有
result: 不猜用户姓名，运行时使用当前 Persona
```

卡内关于用户的剧情身份仍作为本卡世界设定使用。

### 旧社区样本回归

对前一轮 32 张 Character Card 重新解析：

```text
32 / 32 成功
0 parse failure
```

## 已执行检查

- 85 个 TS / Vue script block TypeScript parser 语法扫描：0 diagnostics。
- 对象字面量重复字段扫描：0。
- 核心纯 TypeScript 服务严格类型检查通过。
- 两张本轮真实角色卡解析回归通过。
- V0.4.3.4 既有 32 张角色卡回归 32/32。

当前容器没有项目 `node_modules`，所以完整：

```text
vue-tsc -b && vite build
```

仍必须以用户 Windows 环境结果为最后确认。

## 下一主线

V0.4.3.5 先把角色“出生状态”和 User Resolver 边界修稳。构建、浏览器回归稳定后，再进入：

### V0.4.3.6 建议

1. WorldBook Engine V2：递归、sticky/cooldown/delay、group scoring、token budget、命中调试。
2. Preset Prompt Manager：可视化 prompts / prompt_order、角色/全局作用域、启停与重排。
3. Regex 编辑器：查看、修改、试跑、作用域、顺序、错误定位。
4. Theme Runtime V1：安全 Theme JSON / CSS token / 壁纸 / 图标 / Chat Theme / per-conversation override。
5. User Resolver Debug：在 Prompt Debug 中明确显示“本轮 {{user}} 来自哪套 Persona / 哪些世界书剧情身份命中”。

优先级仍是：**兼容正确性与数据边界 > 新 App 数量**。
