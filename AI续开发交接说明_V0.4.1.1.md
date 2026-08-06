# AI Companion Phone 续开发交接说明

> **当前交接版本：V0.4.1.1**  
> 这份文档是给下一次新聊天中的 AI 开发者阅读的。用户通常会同时上传本文件和最新项目 ZIP。请先完整检查项目，再直接继续开发，不要只给规划或让用户重复解释背景。

---

## 1. 新 AI 收到文件后应该怎么做

1. 解压并检查最新项目 ZIP，读取 `package.json`、`src/types/domain.ts`、`src/db/database.ts`、`src/views/ChatRoom.vue`、`src/services/promptComposer.ts` 和本文件。
2. 核对项目实际版本，不要凭文件名猜测。
3. 保留现有角色、聊天、图片、Persona、世界书和备份兼容，不随意重置数据库。
4. 根据“下一版本建议”直接实现一个完整可运行版本，而不是只输出方案。
5. 修改后同步更新版本号、README、CHANGELOG、PROJECT_STATUS、ARCHITECTURE、开发日志和版本说明。
6. 交付一个干净 ZIP：不包含 `.git`、`node_modules`、`dist`、`*.tsbuildinfo`。
7. 尽可能运行 `npm install`、`npm run build` 和测试。当前环境无法完成时，要明确写出实际完成的检查，不能假称构建通过。
8. 同步更新本交接文档，让下一位 AI 能继续接手。

可以把下面这句话作为新对话中的直接任务：

```text
请先阅读《AI续开发交接说明_V0.4.1.1.md》，再检查我上传的最新项目 ZIP。不要只做规划，直接按文档中的产品方向和下一版本建议继续开发，保留数据兼容，完成代码、文档、检查和干净 ZIP 交付。
```

---

## 2. 项目基本信息

```text
项目名称：AI Companion Phone
中文定位：虚拟手机 · AI 陪伴世界
当前版本：0.4.1.1
GitHub：https://github.com/mia340/ai-companion-phone
默认分支：main
用户本地 Git 仓库：D:\ai\ai-companion-phone-v0.3.1-git
常用开发目录：D:\ai\ai-companion-phone-vX.Y.Z
```

技术栈：

```text
Vue 3
TypeScript
Vite
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

覆盖到 Git 仓库的标准方式：

```powershell
cd "D:\ai"

robocopy `
  ".\ai-companion-phone-vX.Y.Z" `
  ".\ai-companion-phone-v0.3.1-git" `
  /E `
  /XD .git node_modules dist `
  /XF "*.tsbuildinfo" `
  /R:2 `
  /W:1
```

提交方式：

```powershell
cd "D:\ai\ai-companion-phone-v0.3.1-git"
npm install
npm run build
git status
git add .
git commit -m "feat: 发布…… vX.Y.Z"
git push origin main
```

---

## 3. 用户真正想做的产品

这不是“AI 助手换一个角色头像”，而是：

```text
酒馆 / SillyTavern 级角色内核
+
FLAI 式关系、记忆、剧情和陪伴
+
小手机式真实社交软件互动
+
DC 社区式角色卡、世界书、预设和创作分享
```

最重要的产品原则：

- 角色身份永远优先于通用助手身份。
- 回复必须像“这个角色会说的话”，不能像客服、图片分析助手或说明文。
- 图片、语音、记忆和工具信息只是角色看到或使用的内容，最终表达仍服从角色人格和关系。
- 角色可以简短、停顿、调侃、嘴硬、吃醋、主动分享，不需要每条都总结、提问和加表情。
- 不机械复述用户，不提供惯用二选一，不频繁说“你分享了”“我注意到”“从图片中看”。
- 不暴露 AI、模型、API、Prompt、JSON 或系统规则。
- 不能未经用户表达替用户决定台词、动作、情绪或选择。
- 主动陪伴必须可关闭，不使用内疚、威胁离开、占有控制或情感施压。
- 保留用户对候选回复、编辑、继续生成、分支和 OOC 的创作控制权。

---

## 4. 产品参考理解

### SillyTavern / 酒馆

需要学习的是内核，不是照搬桌面界面：

- Character Card：角色描述、性格、场景、第一条消息、备用开场、示例对话、系统规则。
- Persona：用户在当前故事中的身份，与角色卡分离。
- Lorebook / World Info：按关键词和条件动态注入人物、地点、规则和事件。
- Prompt Manager：控制角色卡、Persona、世界书、记忆、历史和最终指令的顺序与预算。
- Swipes、编辑、继续生成、分支、OOC、Prompt 查看。
- 不同模型需要不同预设和消息格式，不能永远共用一套 Prompt。

### FLAI

重点参考：

- 关系和情绪持续变化。
- 长期记忆与共同经历。
- 编辑、续写、重答和剧情分支。
- 语音、主动问候和多人互动。
- 用户能够快速创建和分享角色。

需要避免：功能很多但角色仍重复、短、失忆或过度付费依赖。项目核心仍是角色稳定性、记忆准确性和自然表达。

### 小手机

小手机不是固定 APP，而是一类“酒馆内核 + 手机社交外壳”的实现：

```text
连续短消息
正在输入
消息时间和状态
语音消息
表情和图片
撤回
延迟回复
主动消息
朋友圈
通话
角色状态变化
```

理想实现是让模型选择结构化动作，程序负责渲染，而不是把动作说明或 JSON 直接显示给用户。

### DC / Discord 社区

社区通常承担角色资源市场、创作者交流、测试反馈和技术支持。项目应保留：

```text
作者
资源版本
来源
许可和署名
是否允许二改
标签
兼容版本
更新日志
```

不要移除来源与许可信息，也不要鼓励盗卡、倒卖或无授权转载。

---

## 5. 当前完成到哪里

### V0.4.0 已完成

- 角色卡 V2 编辑器。
- 多套 User Persona。
- 基础 Lorebook。
- 分层 Prompt Composer。
- 图片观察与角色表达分离。
- 去 AI 腔规则。
- 候选回复左右切换。
- 编辑历史消息、继续生成、聊天分支。
- `/ooc` 导演指令。
- 多开场白。
- IndexedDB V6，备份 V5。

### V0.4.1 已完成

#### 互动动作协议

- `src/services/interactionProtocol.ts`
- 模型可在回复末尾输出隐藏 `<companion_packet>`。
- 支持 `text`、`emoji`、`voice` 多条动作消息。
- 支持结构化 `mood`、`activity`、`location`、`relationshipNote`、`innerThought`。
- 流式过程中隐藏未完成协议，解析失败回退纯文本。

#### 小手机消息节奏

- 连续消息可以逐条出现。
- 设置支持 `off / quick / natural / slow`。
- 结合角色 `replySpeed`、消息长度和消息类型计算间隔。
- emoji 使用大号无气泡样式。
- voice 使用语音气泡样式，并通过浏览器 TTS 播放。

#### 主动陪伴基础

- `src/services/relationshipService.ts`
- 打开聊天时满足间隔才检查主动消息。
- 优先延续面试、考试、生病、承诺、未完结果等旧话题。
- 主动语气参考角色主动程度、说话风格和关系阶段。

#### Prompt 调试器

- `src/services/promptDebugService.ts`
- `src/views/PromptDebugView.vue`
- 每个聊天最多保留 20 次本地记录。
- 查看 System Prompt、最近历史、Persona、世界书命中、记忆命中、图片数、原始输出、可见回复和自然度警告。
- 调试记录不进入备份。

#### 相关记忆选择

- `src/services/memoryService.ts` 中的 `selectMemoryHits()`。
- 按关键词重合、重要度、类型和更新时间排序，不再每轮注入全部记忆。

#### 酒馆角色卡 JSON 兼容

- `src/services/characterCardImportService.ts`
- 支持 SillyTavern V2 / V3 JSON 主要字段和旧版 JSON。
- 支持 `{{user}}`、`{{char}}`、`<START>` 示例格式。
- 支持导出 V2 JSON。
- 当前不支持 PNG 卡内嵌数据。

#### 数据版本

```text
IndexedDB：V7
备份格式：V6
新增表：promptDebugTraces
旧备份兼容：V1～V5
```

---

## 6. 当前关键目录和职责

```text
src/types/domain.ts
领域类型、角色卡、消息、设置、状态和调试追踪。

src/db/database.ts
Dexie schema 和 V1～V7 数据库升级。

src/services/ai/provider.ts
Mock、DeepSeek、OpenAI 兼容请求、SSE 流式、多模态。

src/services/promptComposer.ts
把角色卡、Persona、关系、记忆、世界书、视觉规则和互动协议编排成 System Prompt。

src/services/characterCardService.ts
角色卡提示词、示例对话解析和序列化。

src/services/characterCardImportService.ts
酒馆 JSON 导入和 V2 JSON 导出。

src/services/personaService.ts
用户 Persona 管理与 Prompt。

src/services/lorebookService.ts
基础关键词触发世界书。

src/services/memoryService.ts
记忆提取、保存、相关性命中和摘要。

src/services/interactionProtocol.ts
多消息、表情、语音样式和角色状态协议解析。

src/services/promptDebugService.ts
本地 Prompt 追踪记录。

src/services/relationshipService.ts
关系成长、情绪、主动消息和关系事件。

src/views/ChatRoom.vue
当前聊天总编排：发送、Provider、流式、图片、记忆、关系、协议、状态、候选和分支。文件仍很大。

src/components/chat/
聊天头部、消息列表、气泡、输入框、设置、图片预览、心理活动、音乐和长按操作。

src/views/CharacterCardEditorView.vue
角色卡 V2、资源元数据、酒馆 JSON 导入导出。

src/views/PromptDebugView.vue
Prompt、世界书、记忆和输出诊断。
```

---

## 7. 数据与兼容要求

- 不随意修改已有表主键。
- 新字段优先使用可选字段和默认值迁移。
- 升级数据库时新增新的 Dexie version，不修改旧 version 的历史 schema。
- 备份格式升级后继续接受旧版本导入。
- 图片仍以 Data URL 保存在 IndexedDB；大量图片会占用空间。
- 覆盖源码前建议用户先导出备份。
- 清除 PWA 的 “Clear site data” 会删除 IndexedDB，必须先提醒备份。
- Prompt 调试记录故意不导出，避免把完整上下文写入备份。

---

## 8. 当前已知限制和技术债

1. `ChatRoom.vue` 仍承担太多编排逻辑，需要继续提取 `useChatStreaming`、`useMessageActions`、`useInteractionProtocol`。
2. 世界书只有基础关键词、常驻、角色范围和优先级，尚无次关键词、AND/NOT、概率、扫描深度、插入位置和递归触发。
3. 尚无模型专属 Roleplay Preset / Prompt Manager。
4. 角色卡只支持 JSON，未解析 PNG 的 `chara` / `ccv3` 元数据。
5. 语音消息是浏览器 TTS 样式，不是真实音频生成与持久化。
6. 主动消息没有后台 Service Worker 推送，只在应用打开时检查。
7. 表情只有模型输出的 Unicode 表情，尚无贴纸资源库和自定义表情包。
8. 朋友圈、动态、评论、点赞、电话和通知动作尚未完成。
9. 记忆相关性为本地文本启发式，不是向量检索或 RAG。
10. Prompt 调试以字符数估算，不是精确 tokenizer。
11. 不同 OpenAI 兼容模型对 system、图片和结构化协议的服从程度差异较大。
12. 群聊仍未形成多角色轮流发言与角色隔离系统。

---

## 9. 推荐下一版本：V0.4.2

建议版本名：

```text
V0.4.2 世界书引擎与模型预设升级
```

建议一次完成以下内容：

### A. 高级世界书引擎

- 主关键词、次关键词。
- 任意、全部、排除条件。
- 扫描最近 N 条消息。
- 触发概率。
- 优先级和 token / 字符预算。
- 插入位置：角色卡前、角色卡后、历史前、历史指定深度、最新消息前。
- 消息角色：system / user / assistant。
- 全局、角色、当前聊天范围。
- 递归触发与防循环。
- 世界书关键词测试器和本轮触发原因。

### B. Roleplay Preset / Prompt Manager

- 新增模型预设实体和管理页。
- OpenAI 兼容、Claude 风格、Gemini 风格、本地模型分别配置。
- 可调整 Prompt 模块顺序、启用状态和注入位置。
- system 不支持时的合并策略。
- 示例对话格式和 post-history instruction 位置。
- 上下文字符预算与模块占用预览。
- 当前聊天选择预设。

### C. 调试器升级

- 显示每个 Prompt 模块的字符占用。
- 显示世界书为什么触发或没有触发。
- 显示最终模块顺序，而不只是一大段文本。
- 提供“复制脱敏调试报告”，移除隐私内容后方便排错。

### D. 基础兼容

- 继续保留纯文本模型回退。
- 数据库建议升级 V8，备份升级 V7。
- 不要在同一版同时加入朋友圈和真实音频，避免改动过大。

V0.4.2 验收标准：

```text
世界书支持 AND / NOT / 概率 / 深度
能解释每条世界书触发原因
不同聊天可选择不同模型预设
Prompt 模块可排序和开关
Prompt 调试器显示模块预算
旧角色、旧聊天和 V1～V6 备份可继续使用
npm run build 成功
```

后续建议：

```text
V0.4.3：表情包、真实语音消息与动作资源库
V0.4.4：朋友圈、点赞评论、通知和主动行为工具
V0.5.0：向量记忆、剧情时间线、群聊和社区角色资源包
```

---

## 10. 开发和交付规范

每个版本至少完成：

- `package.json` 与 `package-lock.json` 版本一致。
- 数据 schema 与备份格式一致。
- 旧数据默认值兼容。
- TypeScript 严格检查。
- Vue SFC 脚本和模板检查。
- 核心纯函数测试。
- Windows 本地 `npm run build` 最终复核。
- README、CHANGELOG、PROJECT_STATUS、ARCHITECTURE、开发日志和版本说明同步。
- 更新本交接文档。
- ZIP 使用 UTF-8 文件名，不能再出现 `#Uxxxx` 中文文件名乱码。

绝对不要：

- 把 `.git`、`node_modules`、`dist` 打进交付包。
- 删除用户原有角色或聊天数据。
- 把 API Key 写进代码、文档或调试记录。
- 在聊天界面暴露 JSON、协议名、Provider 技术错误或 Prompt。
- 只给用户一份宏大规划而不修改代码。
- 未运行检查却声称构建或测试通过。

---

## 11. V0.4.1 验收清单

新 AI 接手前可以快速检查：

```text
[ ] package.json version = 0.4.1.1
[ ] Dexie version = 7
[ ] backup version = 6
[ ] 聊天设置有小手机互动协议和消息节奏
[ ] 模型纯文本回复仍能正常显示
[ ] companion_packet 不会显示在气泡里
[ ] 多条 text / emoji / voice 可以分开发送
[ ] 心理活动面板能显示地点和关系感受
[ ] Prompt 调试器能查看世界书和记忆命中
[ ] 角色卡能导入 V2 / V3 JSON 主要字段
[ ] 角色卡能导出 V2 JSON
[ ] 旧角色、图片、语音、流式、候选、分支正常
[ ] npm run build 在用户 Windows 电脑通过
```

---

## 12. 给下一位 AI 的最后提醒

用户非常在意“活人感”。评价一个功能是否成功，不是看字段数量，而是看实际聊天：

```text
是否先回应用户的情绪和关系含义
是否保持角色自己的语言习惯
是否记得共同经历
是否避免通用 AI 句式
是否允许短句、沉默、连续消息和不提问
图片是否只是角色看到的内容，而不是把角色变成图片助手
主动行为是否自然且不操控用户
```

请把每次开发都落实到真实对话回归样例，不要只优化后台结构。
