# AI Companion Phone 续开发交接说明

> **当前交接版本：V0.4.2.5**  
> 这份文档用于在新的 AI 对话中继续开发。用户通常会同时上传本文件和最新项目 ZIP。请先检查代码，再直接完成下一版本，不要让用户重复解释整个项目。

---

## 1. 新 AI 收到文件后的执行顺序

1. 解压最新项目 ZIP。
2. 阅读 `package.json`、`src/types/domain.ts`、`src/db/database.ts`、`src/views/ChatRoom.vue`、`src/services/promptComposer.ts`、`src/services/memoryService.ts`、`src/services/interactionProtocol.ts` 和本文件。
3. 以代码中的实际版本和 schema 为准，不凭 ZIP 名称猜测。
4. 保留旧角色、聊天、图片、Persona、世界书、关系和备份兼容。
5. 不只给规划；应直接修改代码、检查、更新文档并交付干净 ZIP。
6. 同步更新本交接说明，让下一位 AI 能继续接手。

新对话可直接发送：

```text
请先阅读《AI续开发交接说明_V0.4.2.5.md》，再检查我上传的最新项目 ZIP。
不要只做规划，直接按文档中的产品方向和下一版本建议继续开发；
保留旧数据兼容，完成代码、检查、版本文档、干净 ZIP 和新版交接说明。
```

---

## 2. 项目基本信息

```text
项目：AI Companion Phone
定位：虚拟手机 · AI 陪伴世界
当前版本：0.4.2.5
GitHub：https://github.com/mia340/ai-companion-phone
默认分支：main
用户常用 Git 目录：D:\ai\ai-companion-phone-git-clean
开发解压目录：D:\ai\ai-companion-phone-vX.Y.Z
```

技术栈：

```text
Vue 3 + TypeScript + Vite
Vue Router（Hash）
Pinia
Dexie / IndexedDB
PWA
Mock、DeepSeek、OpenAI 兼容 Provider
```

常用命令：

```powershell
npm install
npm run dev
npm run build
npm run test
```

覆盖到 Git 仓库：

```powershell
cd "D:\ai"

robocopy `
  ".\ai-companion-phone-vX.Y.Z" `
  ".\ai-companion-phone-git-clean" `
  /E `
  /XD .git node_modules dist `
  /XF "*.tsbuildinfo" `
  /R:2 `
  /W:1
```

---

## 3. 用户真正想要的产品

不是“普通 AI 助手换角色头像”，而是：

```text
SillyTavern / 酒馆级角色卡与 Prompt 内核
+
FLAI 式关系、长期记忆和剧情陪伴
+
小手机式真实社交互动
+
DC 社区式角色卡、世界书和创作资源分享
```

长期方向还包括：

```text
小游戏：海龟汤、飞行棋、狼人杀
生活应用：小说、笔记、购物、外卖、钱包/理财、红包、代买
跨应用陪伴：角色邀请游戏、讨论阅读进度、提醒待办、送礼、订单和共同记忆
```

产品原则：

- 角色身份优先于通用助手身份。
- 最终回复必须像角色本人，不像客服、说明文或图片分析工具。
- 不机械复述，不强制二选一，不每条都提问和加表情。
- 图片、语音、记忆和工具结果只是角色获得的信息，最终表达服从角色性格和关系。
- 不暴露 Prompt、JSON、Provider、API 或技术协议。
- 不替用户决定台词、动作、情绪和选择。
- 主动陪伴可关闭、可静音，不使用内疚、威胁离开、控制或情感施压。
- 用户保留编辑、候选回复、继续生成、分支和 OOC 控制。


### 当前必须遵守的聊天表现契约（V0.4.2.3）

这是用户已经通过实机截图确认的产品要求，后续版本不要回退：

```text
在身边 / together
→ 角色动作写成中文全角括号（……）
→ 动作 + 多句对白允许在同一个剧情气泡
→ 不强制一句一气泡

不在身边 / remote
→ 角色另一端正在发生的动作仍然对玩家可见
→ 动作使用独立 scene_action / “角色此刻”样式
→ 真正发给用户的对白严格“一完整句子一个气泡”
→ 生成期间不能先显示一个整段流式大气泡，结束后再拆
→ 应显示输入状态，最终按 Action / 句子消息逐条落库、逐条出现
```

默认推荐：

```text
presenceMode = auto
actionVisibility = always
multiBubble = true
actionProtocolEnabled = true
```

时间规则：

- 每轮 Prompt 必须携带浏览器设备本地精确时间与 UTC 偏移。
- “现在 / 今天 / 明天 / 几点 / 还有多久”等判断以设备时间为准。
- 说“还有 X 小时/分钟”前必须精确计算；不确定就只说具体时间，不能估算。

用户事实规则：

- Persona、用户真实聊天原文、本轮命中的长期记忆，是用户习惯/偏好/作息/工作地点/旧经历/旧约定的有效事实来源。
- 角色卡示例对话、世界书示例、创作者备注、模型常识和“为了自然”进行的猜测，都不能当成用户事实。
- 严禁无依据生成“我记得你上次……”“你平时……”“你总是……”“你一直很喜欢……”。
- 用户本轮一次性表达（例如“今天想吃寿司”）不能自动升级为稳定习惯（“你一直爱吃寿司”）。
- 如果不知道，角色可以自然询问，但不能替用户补设定。

---

## 4. 当前完成能力

### 角色与沉浸内核

- 角色创建、详情、编辑和删除。
- 角色卡 V2：外貌、价值观、习惯、弱点、秘密、边界、场景、多开场、示例对话和最终规则。
- 多套 User Persona，并可按聊天切换。
- Lorebook：关键词、常驻、角色范围和优先级。
- 分层 Prompt Composer。
- `/ooc` 导演指令。
- 候选回复左右切换、继续生成、编辑历史消息和聊天分支。
- SillyTavern V2/V3 JSON 主要字段导入，V2 JSON 导出。
- 角色资源作者、版本、来源、许可和二改信息。

### 聊天与多模态

- 普通和 SSE 流式回复、停止生成、异常恢复和失败重试。
- 引用回复、长按操作、草稿、滚动恢复和软键盘适配。
- 语音输入、浏览器 TTS 朗读、角色独立音色和语速。
- 一条消息最多 6 张图片、相册多选、相机、多图压缩、排序和失败回退。
- OpenAI 兼容多模态 `image_url`。
- 图片内部观察与角色表达分离。

### 关系与小手机互动

- 关系阶段：初识、熟悉、亲近、依赖、特别关系。
- 动态情绪、心理活动和一起听歌。
- `<companion_packet>` 隐藏互动协议。
- text、emoji、voice、typing_pause、recall_message、react_to_message、image_placeholder。
- 连续消息节奏和角色回复速度联动。
- 状态正文分离，不在气泡中显示 JSON。


### V0.4.2.3 构建修复

V0.4.2.1 在用户 Windows 严格构建时暴露一个 `TS6133`：`displayedConversationState` 已声明但未使用。V0.4.2.3 不改功能协议和数据结构，只把解析后的相处状态实际传给心理活动与聊天设置面板。

```text
ChatThoughtPanel     ← displayedConversationState
ChatSettingsPanel    ← displayedConversationState
```

IndexedDB 仍为 V8，备份仍为 V7。

### V0.4.2.1 场景距离双模式消息与记忆纠偏

这是当前版本最重要的行为规则：

```text
在身边（together）
→ scene_action 用（中文括号）放进同一剧情气泡
→ dialogue 可与动作、多段对白共同存在一个气泡

远程（remote）
→ scene_action 作为独立 Action 样式，玩家仍能看到角色此刻在做什么
→ dialogue 按真实手机节奏拆成多条独立消息
→ typing / 撤回 / reaction 等仍是 phone action
```

设置：

```text
presenceMode：auto / together / remote
actionVisibility：always / together / off
```

`auto` 读取 `ConversationState.presence`。不能因为“我去找你 / 快到了”就提前切成 together，只有剧情中真正见面时才切换。

远程动作不是“用户手机收到的文字”，而是玩家视角的角色侧写；通常每轮 0～2 条，避免无意义微动作流水账。

消息落库：远程文本和 Action 都是独立 `Message`；同一轮共享 `replyGroupId`，并使用 `replySequence` 保序。

记忆纠偏：

- “请记住，我下周三有面试”保存为 fact/event，不是共同经历。
- “记得提醒我”可额外形成 promise。
- 重复事实合并。
- “有面试 / 没有面试”形成冲突。
- “下周三”指下一自然周星期三。
- 冲突页支持采用当前、采用另一条、两者都保留。
- 明确记忆指令通过 `memoryWriteNotice` 告知本轮角色，自然确认即可。
- 无历史/记忆依据时，角色不得编造“我记得你上次……”式共同经历。

### V0.4.2 长期记忆

六层结构：

```text
fact         客观事实
subjective   角色主观记忆
shared       共同经历
promise      承诺和约定
relationship 关系事件
story        长期剧情
```

已实现：

- “请记住、别忘了、提醒我”等明确记忆表达识别。
- 姓名、生日、偏好、过敏、面试、考试、旅行、复诊、约定等提取。
- 相似记忆合并。
- 单值主题不同内容的冲突标记。
- 日期解析与临近约定加权。
- 关键词、重要度、层级、锁定、日期、近期性和冲突惩罚综合检索。
- 命中次数、最近命中时间和命中原因。
- 角色关系感受/内心想法可形成主观记忆。
- 完整管理页：筛选、添加、编辑、锁定、降权、标错、解决冲突、删除。

入口：

```text
聊天页 → 右上角 ··· → 记忆 → 打开完整记忆管理
```

### V0.4.2 状态协议 V2

持续状态：

```text
地点
时间段
活动
心情
精力
关系感受
未完成话题
等待中的事件
短期目标
最近完成事件
```

- 用户消息可本地识别未完话题、等待事件和目标。
- 模型协议可增量更新必要字段。
- 变化写入 `conversationStateHistory`。
- 心理活动面板和记忆管理页自然显示，不泄露技术格式。

### V0.4.2 主动陪伴

主动消息来源：

```text
continue-topic     延续话题
promise-reminder   履行承诺
daily-share        分享日常
care               关心状态
story-event        剧情事件
```

控制项：

- 开关。
- 低 / 自然 / 较高频率。
- 最短联系间隔。
- 安静时段。
- 允许来源。
- 角色主动程度和关系阶段共同影响时间。
- 同一来源短期去重。
- 修复最后一条是角色消息时无法主动跟进的问题。

当前主动消息仍是“打开聊天时检查”，没有后台通知推送。

### V0.4.2 Prompt 调试器

可查看：

- 当前模型、Persona、模式和图片数量。
- Prompt 分区字符占用和建议预算。
- 较早消息省略与超预算风险。
- 世界书触发原因。
- 记忆命中层级、分数和原因。
- 影响回复的规则。
- 模型原始输出与用户可见输出。
- 互动动作解析结果。
- 一键复制完整调试报告。
- 角色一致性、AI 腔风险、重复、提问、长度、关系回应、用户重点和图片使用评分。

Prompt 调试记录最多保留每个聊天 20 条，只保存在浏览器，不进入备份。

---

## 4.1 V0.4.2.3 最新修复

- 设备本地精确时间进入每轮 Prompt。
- remote 多气泡不再先显示完整流式大气泡。
- remote 文本严格一完整句子一个气泡。
- remote + always 动作视角保证独立 Action，模型漏写时有状态兜底。
- together 继续保留括号动作 + 多句对白同气泡。
- 新增用户事实来源约束与无依据偏好/旧经历检测。
- 真实 Provider 检测到无依据用户事实时，会自动低温重写一次。
- IndexedDB 仍为 V8，备份仍为 V7。

## 5. 数据版本和兼容规则

```text
Dexie / IndexedDB：V8
备份格式：V7
可导入旧备份：V1～V6
```

主要表：

```text
worlds
characters
contactGroups
conversations
messages
userProfiles
modelSettings
chatSettings
memories
conversationStates
conversationStateHistory
musicStates
relationships
relationshipEvents
personas
lorebookEntries
promptDebugTraces
```

兼容要求：

- 不修改历史 Dexie version 的 schema；新升级继续新增 version。
- 新字段优先可选并提供默认值。
- 不改变已有表主键。
- 备份升级后继续接受旧版本。
- 清除浏览器站点数据会删除 IndexedDB，必须先提醒导出备份。
- 图片仍以 Data URL 保存，注意存储体积。
- Prompt 调试记录故意不导出，避免携带完整上下文。

---

## 6. 当前关键文件

```text
src/types/domain.ts
领域类型：角色、消息、记忆、状态、设置和调试追踪。

src/db/database.ts
Dexie V1～V8 schema 和迁移。

src/services/memoryService.ts
记忆提取、分层、合并、冲突、管理、检索和 Prompt。

src/services/stateHistoryService.ts
状态变化历史、用户消息状态识别和状态 Prompt。

src/services/interactionProtocol.ts
小手机动作协议 V2.1、场景距离解析、双模式动作整形、自然拆分和自然度评分。

src/services/relationshipService.ts
关系成长、情绪、主动消息与关系事件。

src/services/promptComposer.ts
角色卡、Persona、关系、记忆、状态、世界书、视觉和互动协议编排。

src/services/promptDebugService.ts
调试记录、分区预算、截断和报告生成。

src/services/dataBackup.ts
V7 备份导入导出。

src/views/ChatRoom.vue
会话总编排，仍较大：发送、Provider、流式、图片、关系、记忆、状态、动作协议、候选和分支。

src/views/MemoryManagerView.vue
完整长期记忆管理与状态变化历史。

src/views/PromptDebugView.vue
Prompt 预算、命中、自然度和输出诊断。

src/components/chat/ChatSettingsPanel.vue
聊天、主动消息、角色扮演、记忆和高级设置。
```

---

## 7. 已知限制和技术债

1. `ChatRoom.vue` 仍很大，后续应提取 `useChatStreaming`、`useMessageActions`、`useCompanionActions`。
2. 记忆检索是本地启发式，不是向量检索或 RAG。
3. 记忆冲突目前主要针对可识别的单值主题，不是完整语义矛盾检测。
4. 相对日期解析只覆盖常用中文表达，不支持复杂日历规则。
5. Prompt 预算是字符估算，不是精确 tokenizer。
6. 主动消息只在应用打开时检查，没有 Service Worker 后台推送。
7. `image_placeholder` 只是角色分享意图卡片，不会自动生成真实图片。
8. voice 是浏览器 TTS 样式消息，不是真实持久化音频。
9. 世界书尚无 AND/NOT、概率、扫描深度、插入位置和递归触发。
10. 尚无模型专属 Roleplay Preset / Prompt Manager。
11. 群聊没有真正的多 Agent 私密信息隔离。
12. 小说、笔记、购物、外卖、钱包、红包和游戏尚未开始。

---

## 8. 推荐下一里程碑：V0.5.0 Companion OS 底座

用户希望未来加入：

```text
海龟汤、飞行棋、狼人杀
小说阅读、笔记、购物、外卖、钱包/理财
聊天红包、代买、礼物和更强的跨应用陪伴
```

不要直接逐个把页面和逻辑堆进 `ChatRoom.vue`。下一版优先建设公共底座：

### 应用注册系统

- App ID、名称、图标、路由、权限和支持的 AI 工具动作。
- 桌面从注册表生成应用入口。
- 新应用不再修改大量核心页面。

### AI 工具动作系统

建议结构：

```text
open_app
invite_game
create_note
read_note
send_red_packet
accept_red_packet
add_to_cart
place_virtual_order
check_order
share_reading_progress
```

- 模型只选择动作和参数。
- 程序验证权限并执行。
- 技术 JSON 不显示给用户。

### 跨应用事件总线

例如：

```text
聊天邀请海龟汤
→ 打开游戏
→ 保存结果
→ 写入共同经历
→ 回到聊天继续讨论
```

### 虚拟钱包与订单

- 虚拟余额和收支。
- 红包、礼物、购物、外卖和代买共用订单状态。
- 不接真实支付和真实金融接口。

### 权限和通知

- 角色是否可读取指定笔记。
- 是否允许主动邀请游戏、发送红包和虚拟下单。
- 单次虚拟消费上限。
- 通知中心和待办事件。

建议完成顺序：

```text
V0.5.0：Companion OS 底座
V0.5.1：海龟汤 + 飞行棋 + 游戏结果记忆
V0.5.2：小说 + 笔记 + 共同日记
V0.5.3：虚拟购物 + 外卖 + 红包 + 代买
V0.5.4：狼人杀多 Agent 与身份隔离
```

---

## 9. 开发与交付规范

每个版本必须：

- 同步更新 `package.json` 与 `package-lock.json`。
- 数据库和备份版本保持一致。
- 保留旧数据默认值和旧备份导入。
- 检查 TypeScript、Vue SFC 脚本和模板。
- 为核心纯函数增加测试。
- 在用户 Windows 项目目录最终运行 `npm install` 和 `npm run build`。
- 更新 README、CHANGELOG、PROJECT_STATUS、ARCHITECTURE、开发日志、版本说明和本交接文档。
- 交付 UTF-8 中文文件名 ZIP。

干净 ZIP 不包含：

```text
.git
node_modules
dist
*.tsbuildinfo
```

绝对不要：

- 删除用户角色和聊天数据。
- 把 API Key 写进源码或调试记录。
- 在聊天界面显示协议 JSON、Prompt 或 Provider 技术名称。
- 未运行构建却声称构建成功。
- 只提供规划而不修改代码。

---


## V0.4.2.5 新增：Persona 资源导入导出与 Tavo 兼容

本版基于用户提供的 Tavo 社区样本和 SillyTavern / Tavo 官方资料补齐 Persona 资源层。

新增：

```text
Persona JSON / TXT / MD 导入
本项目 Persona V2 JSON 导出
Tavo / 酒馆文本人设 GB18030 兼容
Character Card V2 / V3 显式转换 Persona
世界书 / 预设 / 正则资源识别与误导入拦截
导入预览
同名覆盖 / 另存
未知字段 extraFields 保真
Persona 标题、年龄、性别、生日、身高、职业、公开/私下表现、优缺点、兴趣、明确习惯、生活状态、标签、作者/来源
```

核心文件：

```text
src/services/personaImportService.ts
src/services/personaImportService.test.ts
src/services/personaService.ts
src/views/PersonaManagerView.vue
src/types/domain.ts
```

重要规则：

- 资源类型必须先识别，不能把世界书、预设、正则塞进 Persona。
- Character Card 转 Persona 必须明确提示用户这是“转换”，不能静默当成用户身份。
- 社区自定义字段不能静默丢弃，保存在 `extraFields`。
- `description` 是迁移保真字段；当已有结构化 Persona 字段时，不重复整段注入 Prompt，避免上下文重复。
- 用户事实仍遵循白名单来源：Persona、可信记忆、真实聊天。没有来源的习惯/偏好/经历一律未知。
- 数据库仍为 V8、完整备份仍为 V7；Persona 新字段均为可选，不需要表迁移。

### V0.4.2.5 验收

```text
[ ] package.json version = 0.4.2.5
[ ] 导入 ai_companion_persona V2 JSON
[ ] 导入通用 Persona JSON
[ ] 导入 Tavo 风格 TXT，GB18030 中文正常
[ ] Character Card V2/V3 显示转换警告并可导入
[ ] 世界书 / 预设 / 正则不能误导入 Persona
[ ] 同名可覆盖或另存
[ ] 未识别字段保存在 extraFields
[ ] Persona 导出 JSON 后可再次导入
[ ] Prompt 不重复注入结构化字段和整段原始描述
[ ] 未在 Persona / 记忆 / 聊天中出现的用户习惯不得编造
[ ] npm run build 在用户 Windows 电脑通过
```

---

## 10. V0.4.2.3 验收清单

```text
[ ] package.json version = 0.4.2.3
[ ] Dexie version = 8，backup version = 7
[ ] ChatThoughtPanel 使用 displayedConversationState
[ ] ChatSettingsPanel 使用 displayedConversationState
[ ] npm run build 在用户 Windows 电脑通过
[ ] V0.4.2.1 双模式消息、动作视角和记忆纠偏功能无回归
```

---

## 11. V0.4.2.1 历史验收清单

```text
[ ] package.json version = 0.4.2.1
[ ] Dexie version = 8，backup version = 7
[ ] 远程模式：scene action 独立显示，文字真正分成多个消息气泡
[ ] 在身边模式：动作显示为（括号）并与对白合并进同一剧情气泡
[ ] 动作视角 always / together / off 三档正常
[ ] auto presence 能读取持续状态，且不会仅因“我去找你”提前切换
[ ] “请记住，我下周三有面试”进入事实/事件层，不进入共同经历
[ ] 重复同一记忆不会新增重复记录
[ ] “有面试 / 没有面试”进入待处理冲突
[ ] 冲突三种处理按钮正常
[ ] “下周三”解析为下一自然周星期三
[ ] 明确记忆消息得到自然确认，不机械回复“然后呢？”
[ ] 无依据时不编造“我记得你上次……”
[ ] 旧角色、聊天、图片、Persona、世界书和记忆继续兼容
[ ] npm run build 在用户 Windows 电脑通过
```

---

## 12. V0.4.2 历史验收清单

```text
[ ] package.json version = 0.4.2
[ ] Dexie version = 8
[ ] backup version = 7
[ ] 旧角色、聊天、图片、Persona 和世界书仍存在
[ ] “请记住……”会形成记忆
[ ] 相似记忆会合并
[ ] 冲突事实可在记忆管理页处理
[ ] 记忆可编辑、锁定、降权、标错和删除
[ ] 本轮命中显示分数和原因
[ ] 状态 V2 不泄露 JSON
[ ] 未完话题、事件和目标能持续
[ ] 主动消息可控制频率、安静时段和来源
[ ] 主动消息能延续具体话题或约定
[ ] typing_pause / recall / reaction / image placeholder 正常
[ ] Prompt 调试器可复制报告并显示自然度评分
[ ] V1～V6 备份可导入
[ ] npm run build 在用户 Windows 电脑通过
```

---

## 13. 最后提醒

用户最在意的是“活人感”，不是字段数量。每次回归都要检查：

```text
角色是否先回应用户真正想表达的内容
是否保持自己的语言习惯和关系反应
是否记得并自然提起共同经历
是否避免客服腔、分析报告腔和连续追问
是否允许短句、停顿、撤回、反应表情和不提问
主动行为是否具体、自然、可关闭且不操控用户
跨应用功能是否真正回流到关系、状态和记忆
```


## V0.4.2.5 新增
创建角色页已经可以直接选择 SillyTavern / Tavo V2/V3 JSON，不再先创建空角色。导入会预填角色信息，并保留高级角色卡字段；内嵌 character_book 会转换成角色专属世界书。后续优先继续完善 PNG 角色卡、V3 扩展字段和社区资源安全导入。
