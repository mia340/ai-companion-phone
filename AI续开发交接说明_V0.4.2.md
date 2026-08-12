# AI Companion Phone 续开发交接说明

> **当前交接版本：V0.4.2**  
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
请先阅读《AI续开发交接说明_V0.4.2.md》，再检查我上传的最新项目 ZIP。
不要只做规划，直接按文档中的产品方向和下一版本建议继续开发；
保留旧数据兼容，完成代码、检查、版本文档、干净 ZIP 和新版交接说明。
```

---

## 2. 项目基本信息

```text
项目：AI Companion Phone
定位：虚拟手机 · AI 陪伴世界
当前版本：0.4.2
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
小手机动作协议 V2、状态解析、自然拆分和自然度评分。

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

## 10. V0.4.2 验收清单

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

## 11. 最后提醒

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
