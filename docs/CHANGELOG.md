## V0.4.3.6.1

- 修复 `ChatRoom.vue` 构建错误：`lorebookPrompt` 未定义。
- 用户事实支持上下文改用 `runtimeLorebookPrompt`。
- IndexedDB V10 / backup V9 不变。

## V0.4.3.6 · 社区 UI 输出接管

- 社区 JSON 自带 UI / 状态栏 / 固定输出协议时自动接管回复格式。
- assistant-output Regex 在 UI 模式改为处理模型原始输出。
- UI 模式绕过默认动作/对白拆分、合并与私有协议注入。
- 移除“动作与对白排版”手动选择；普通角色只按场景自动处理。
- 完整 HTML document 适配 Shadow DOM Rich Runtime。
- Prompt Debug 增加社区 UI 接管提示。
- IndexedDB V10 / Backup V9 不变。

## V0.4.3.5 · 初始状态与 User Persona 识别修复

### Fixed
- 移除新角色固定“刚刚来到这个世界 / 期待认识你”占位；有开场活动则提取，没有则留空。
- 通讯录和聊天加载旧角色时懒迁移历史占位状态，并允许开场明确关系覆盖旧通用“朋友”。
- 普通角色开场中的 `<br>` 归一为换行，不再作为字面标签显示。
- alternate greeting 与首条消息统一处理 `{{user}} / {{char}}`、Regex、Rich HTML 和 Role Card UI 状态。

### User Resolver
- Character Card 除 description 外，也会扫描内嵌世界书的“user人设 / 用户人设 / user persona”条目。
- 明确写出“我是洛梨 / 我叫…”的卡可生成并绑定角色专属 Persona。
- 只有 `{{user}}` 占位、但没有安全可提取姓名/独立 Persona 的卡不会猜名字；当前聊天 Persona 负责名字与真实用户资料。
- 角色卡 / 世界书里分散的“妻子、徒弟、旧职业”等剧情身份只作为当前角色世界观事实使用，不覆盖全局用户资料。

### Compatibility
- 墨清尘 Tavo V2 实测识别：关系“师徒”、专属 Persona“洛梨 / 20岁 / 墨清尘徒弟、筑基期剑修”、初始活动“负手立于田埂”。
- “离婚的诱惑”V3 实测保留 `{{user}}` 剧情关系但不臆测用户姓名；多 alternate greetings 继续保留。
- IndexedDB V10 / backup V9 不变。

## V0.4.3.4 · 可靠性与社区 JSON 兼容修复

### Fixed
- 模型输出旧默认 576 / 600 自动迁移到 2048，降低长回复被截断和协议只生成一半的问题。
- Prompt Debug 写入 Dexie 前转为 plain storage value，修复 Vue Proxy 触发的 IndexedDB `DataCloneError`。
- Scene Action 解析支持属性、异常空格、`scene-action`、未闭合与流式半截标签；历史泄漏标记也会清理。
- 收紧直接身体接触正则，普通“把你介绍给……”和“将你说的话……”不再误判为 together。
- “我的资料”中角色专属 Persona 的 Data URL / base64 头像改为头像组件渲染。

### Added
- 聊天新增动作/对白排版：自动、分开、合并。自动模式 remote 分开、together 合并；合并时不插入换行。
- Character Card 兼容 `talkativeness`、`depth_prompt`、`world`、root/data extensions、root avatar 与 `group_only_greetings`。
- Lorebook 兼容真实 Tavo camelCase 字段和 Persona / Character / Scenario 匹配来源。
- Prompt Preset 支持多 `prompt_order` 择优以及常用 `setvar/getvar/random` 文本宏。

### Compatibility
- 真实资源回归：32/32 Character Card、10/10 Lorebook、211/211 entries、7/7 Preset、8/8 Regex JSON；原有 GB18030 Persona 解码链路也通过真实文件复核。
- Regex ZIP 自动忽略 `__MACOSX` / `._*`，并兼容未标 UTF-8 flag 的中文文件名。
- IndexedDB 保持 V10，完整备份保持 V9。
- 第三方 JavaScript 继续只归档、不自动执行。

## V0.4.3.3 · 场景冲突与 Scene Action 解析修复

- 新增场景冲突解析：直接身体接触 > 角色卡“独处”/模型 remote 报告。
- scene_action XML 支持任意属性和不完整开标签兜底，不再原样显示。
- together 本轮即时生效，动作与对白继续合并为剧情气泡；remote 才保留独立 Action。
- ConversationState 记录 reportedPresence、presenceResolutionReason、presenceResolutionSource。
- Prompt Debugger 展示场景判定与冲突原因。

# Changelog

## V0.4.3.2 · 社区资源导入构建修复

- 修复角色卡内嵌世界书写入对象重复 `characterId` / `lorebookId` 导致的 TS1117。
- 数据库 V10、备份 V9 与 V0.4.3.1 功能保持不变。

## V0.4.3.1 · 社区资源无损归档与全局作用域升级

### Added
- 新增 `communityResourceArchives`，保存社区资源原始 JSON / 文本、来源、识别格式与兼容报告。
- 资源库可查看原始资源归档，并复制 / 导出原文。
- Universal Inspector 新增 Character Card、Persona、Theme 与未知 JSON 的安全识别；不能直接运行的资源不再被误导入。
- 世界书、Prompt Preset、Regex 支持“全局 / 当前角色”两级作用域。
- 创建角色时保存 Character Card 原始 JSON，避免扩展字段在标准化映射中丢失。

### Changed
- 运行时读取资源时同时合并全局绑定和当前角色绑定；角色级 Preset 优先。
- 旧资源绑定迁移为显式 `scope / scopeId`。
- 完整备份升级为 V9，并包含社区原始资源归档。
- IndexedDB 升级为 V10。

### Compatibility
- Theme / 未识别扩展目前以“无损归档 + 报告”为主，不自动覆盖 App 样式或执行第三方 JavaScript。
- 后续兼容器可直接基于已保存原始资源重新解释，无需用户再次找文件导入。

## V0.4.3 · Tavo / SillyTavern 资源兼容运行时

### Added
- “世界”升级为世界书、世界状态、预设、正则、资源库五合一中心。
- 新增 Lorebook Resource、Prompt Preset、Regex Script、Resource Binding 数据表与角色绑定。
- 支持独立世界书 / Preset / Regex JSON 和正则 ZIP 导入。
- Character Card V2/V3 内嵌 character_book 与 regex_scripts 随角色创建。
- 新增安全 Rich HTML/CSS 渲染，支持 details/summary、图片和 CSS 动画。
- 新增 Tavo 管线式状态头解析和 Rich 消息 rawContent 历史保留。

### Changed
- Lorebook 触发保留更多社区字段，并允许角色专属世界书自由启停。
- Regex 基础运行范围覆盖 User Input / AI Response / World Info / Prompt Only。
- Prompt 预设按 prompt_order 基础编排；供应商参数仍由本 App 模型设置控制。
- IndexedDB 升级到 V9，备份格式升级到 V8。

### Security
- 第三方 script、iframe、事件处理属性、javascript: URL 不执行；HTML/CSS 在 Shadow DOM 隔离。

## 0.4.2.9

### Fixed
- 修复 `CharacterCreate.vue` 创建“角色 + 角色专属 Persona”时 Dexie `transaction()` 传入 6 张表导致的 TypeScript `TS2554`。
- 使用表数组开启同一读写事务，V0.4.2.7 的角色卡 `{{user}}` 自动 Persona 和绑定逻辑保持不变。
- IndexedDB 保持 V8，备份格式保持 V7。

## 0.4.2.7

### Added
- 检测角色卡 `{{user}}` 模板并可一键生成角色专属 Persona。
- 创建角色时自动绑定卡内 Persona 到新私聊。
- 角色卡编辑页新增卡内用户模板查看与 Persona 重建入口。
- 我的资料页新增全局/角色专属 Persona 概览。

### Fixed
- 角色专属 Persona 不再可能被 `ensureDefaultPersona()` 误设成全局默认。
- 当前角色聊天的 Persona 下拉列表会隐藏其他角色的专属 Persona。

# Changelog

## V0.4.2.3 · 实时多气泡、Action 与事实约束修复

- 把设备本地日期、星期、精确时间和 UTC 偏移加入每轮角色 Prompt。
- 远程多气泡模式取消临时完整流式大气泡，避免“整段先出现、结束后再拆”的跳变。
- 远程文本改为一完整句子一个独立气泡。
- “远程 + 始终显示动作”要求至少一条 `scene_action`，并增加状态驱动兜底。
- 加强用户事实来源规则，示例对话、世界书示例和模型猜测不能作为用户习惯依据。
- 检测无依据用户偏好/旧经历陈述后自动进行一次纠偏重写。
- 数据库保持 V8，备份保持 V7。


## V0.4.2.2 · 构建修复

- 修复 `displayedConversationState` 未使用导致的 TypeScript `TS6133`。
- 将解析后的相处状态传给心理活动和聊天设置面板，使界面状态与双模式消息逻辑一致。
- 数据库保持 V8，备份保持 V7，旧数据无需迁移。

## V0.4.2.1 · 场景距离双模式消息与记忆纠偏

- 新增相处状态 `auto / together / remote` 与动作视角 `always / together / off`。
- 在身边：场景动作转换为括号描写，与对白合并为同一剧情气泡。
- 远程：场景动作保存为独立 Action，角色对白真正拆成多条独立消息。
- 新增 `scene_action` 动作类型和消息 `replySequence`。
- 修复未来事件记忆层级、重复合并、正反事实冲突和“下周三”解析。
- 记忆冲突增加采用当前、采用另一条、两者都保留三种处理。
- 明确记忆指令注入写入结果，减少无关“然后呢？”回复。
- 增加共同经历真实性约束，避免无依据编造过去互动。
- 数据库保持 V8，备份保持 V7。

## V0.4.2 · 长期记忆与主动陪伴系统升级

- 新增六层长期记忆、自动提取、相似合并和事实冲突检测。
- 新增记忆管理页面与锁定、降权、标错、冲突解决功能。
- 状态协议升级至 V2，并保存地点、精力、话题、事件和目标变化历史。
- 主动消息新增来源、频率、安静时段、关系阶段与重复控制。
- 小手机动作协议新增输入停顿、撤回、消息回应和图片占位。
- Prompt 调试器新增预算、截断、命中原因、规则影响、复制报告和自然度评分。
- IndexedDB 升级至 V8，备份格式升级至 V7。

# 更新日志

## V0.4.1.1 - 构建修复

- 将 `db.personas.first()` 改为 `db.personas.toCollection().first()`，兼容 Dexie `EntityTable` 类型。
- 删除未使用的 `saveAssistantBubbles()`，解决严格 TypeScript 构建错误。
- 数据库仍为 V7，备份格式仍为 V6。

---
## V0.4.1 - 角色互动引擎与小手机行为系统

### 小手机互动

- 新增隐藏互动动作协议，支持连续文字、表情和语音样式气泡。
- 流式输出会隐藏未完成协议，协议失败自动回退纯文本。
- 新增四档消息节奏，并结合角色回复速度与内容长度。
- 主动消息优先延续尚未结束的话题，并参考主动程度和语言风格。

### 状态、记忆与调试

- 角色正文与心情、活动、地点、关系感受和心理活动状态分离。
- 新增相关记忆选择，按关键词、重要度、类别和时间命中。
- 新增 Prompt 调试器，查看世界书、记忆、最终 Prompt、原始输出和自然度提醒。
- 调试记录仅本地保存，每个聊天最多 20 次，不进入备份。

### 角色卡兼容

- 支持 SillyTavern V2 / V3 JSON 主要字段和旧版 JSON 导入。
- 支持酒馆示例对话占位符与 V2 JSON 导出。
- 增加作者、资源版本、来源、许可和二改信息。

### 数据

- Dexie 升级至 V7，新增 `promptDebugTraces`。
- 备份升级至 V6并继续兼容 V1～V5。

---

## V0.4.0 - 角色卡与沉浸剧情系统升级

### 角色系统

- 角色卡 V2 增加场景、多开场、示例对话、人格细节和表达控制。
- 新增用户 Persona 管理，并可按聊天独立选择。
- 新增关键词触发的世界书 Lorebook。
- 新增分层 Prompt 编排器与去 AI 腔规则。

### 聊天操作

- AI 回复支持候选版本左右切换。
- 支持编辑消息、继续生成和从任意消息创建聊天分支。
- 支持 `/ooc` 导演指令和聊天内插入角色开场白。
- 图片观察与角色表达分离，优先回应附言和关系语境。

### 数据

- Dexie 升级至 V6，新增 Persona 和世界书表。
- 备份升级至 V5并继续兼容 V1～V4。

---

## V0.3.8 - 图片处理可靠性与多图理解升级

### 图片处理可靠性

- 多图串行处理并在每张完成后释放解码对象和 Canvas。
- `ImageBitmap` 解码失败自动回退 `HTMLImageElement`。
- 优先尝试 JPEG，失败后自动切换 WebP，再回退安全原图。
- 安全格式支持原图兜底，单张失败不影响其他图片。
- 显示文件名、失败原因、格式、原始体积和处理尝试路径。
- 失败图片可单独重试、使用原图或移除。

### 发送前体验

- 显示处理进度和当前文件名。
- 显示图片尺寸、压缩前后体积与处理方式。
- 支持待发送图片前移、后移。
- 重复、失败和超出数量上限分别统计。

### AI 图片状态

- 显示图片已发送、能力检查、正在查看和组织回复状态。
- 回复完成后标记 AI 是否真正读取了图片。
- 多图请求附带图片顺序和文件名，提升比较与指代准确性。

---


## V0.3.7 图片与消息体验完整升级

- 单图自适应尺寸与 2～6 图网格重排。
- 全屏滑动、缩略图导航和当前图片保存。
- 图片逐张容错、重复过滤、处理进度和提示自动消失。
- 数据库不变，旧消息与备份继续兼容。


## V0.3.6 - 聊天逻辑解耦与多图陪伴升级

### 多图与相机

- 一条消息最多发送 6 张图片
- 相册多选和移动端相机拍摄入口
- 发送前缩略图列表、逐张移除、清空和总体积提示
- 多图作为同一轮视觉输入发送给兼容模型
- 多图网格气泡、轮播预览和批量保存
- 旧单图消息自动兼容

### 架构

- 新增 `useChatScroll.ts`
- 新增 `useChatSpeech.ts`
- 新增 `useBottomPanel.ts`
- 新增 `ChatThoughtPanel.vue`
- 新增 `ChatMusicPanel.vue`
- 语音、滚动和底部面板拖动逻辑从 `ChatRoom.vue` 移出

### 数据与验证

- `Message.images` 以可选字段扩展，不升级 Dexie 索引版本
- 备份图片统计与排除图片导出适配多图
- `vue-tsc -b` 严格类型检查通过
- 27 个 Vue 单文件组件解析与模板编译通过
- 当前容器缺少 Rollup Linux 可选模块，最终 Vite 打包需在 Windows 复核

---

## V0.3.5 - 聊天页面组件化与语音设置优化

### 架构

- 新增 `ChatHeader.vue`
- 新增 `ChatMessageList.vue`
- 新增 `ChatSettingsPanel.vue`
- 新增 `ChatActionSheet.vue`
- 新增 `ChatImagePreview.vue`
- `ChatRoom.vue` 继续保留会话编排和请求生命周期，减少模板职责

### 语音体验

- 设置面板新增当前角色声音试听
- 试听沿用角色音色、语速、情绪和关系阶段的节奏调整

### 兼容与验证

- 保留流式回复、停止生成、图片理解、引用、重试、记忆、关系和音乐功能
- TypeScript 严格类型检查通过
- 当前容器因 Rollup Linux 可选模块缺失未完成最终 Vite 打包，需在 Windows 执行 `npm run build` 复核

---

## V0.3.3 - 流式陪伴与聊天架构升级

### 新增

- OpenAI 兼容 SSE 流式回复
- 图片理解流式输出
- 本地模拟回复逐步显示
- 聊天设置新增“边想边回复”
- 流式气泡输入光标

### 可靠性

- 停止生成后保留已经出现的文字
- 流式中断后保留部分回复并显示状态
- 页面刷新后恢复遗留的 pending 消息
- 非 SSE 接口自动按普通 JSON 处理
- 视觉降级和本地兜底继续适用于流式请求

### 架构

- 新增 `ModelProvider.chatStream()` 增量接口
- 新增 OpenAI SSE 解析与增量回调
- 流式内容节流写入 IndexedDB
- 使用 `requestAnimationFrame` 控制自动滚动
- 拆分 `ChatMessageItem.vue` 与 `ChatComposer.vue`

# AI Companion Phone 更新记录

## V0.3.2 — 2026-07-30

### 新增

- OpenAI 兼容多模态图片输入
- 图片与附言作为同一条消息发送
- 图片发送前预览、移除与确认
- 图片理解自动检测、强制启用和关闭模式
- 模型设置页图片理解测试与能力状态
- 消息发送中、发送失败、停止等待和重新发送
- 图片消息保存到设备
- 首次选择图片的隐私确认

### 优化

- 图片最长边调整为 1280 像素，并继续压缩到约 900 KB 目标体积
- 历史图片不重复发送给模型，减少请求体积
- 不支持视觉的模型自动改用不猜测细节的自然兜底
- 图片附言参与记忆提取，图片分享参与关系成长与动态情绪
- 图片回复等待状态改为“正在认真看你发来的图片”
- 手机外框在路由切换时保持稳定，不再整机淡出再出现

### 数据与备份

- 消息新增图片尺寸、体积、视觉使用和视觉降级元数据
- 备份格式升级至 V4
- 导出时可选择是否包含聊天图片
- 备份预览显示图片数量与图片体积
- 继续兼容 V1、V2、V3 备份导入

### 验证

- TypeScript 源码与 Vue `<script setup>` 语法解析通过
- ChatRoom、ModelSettingsView、DataBackupView 模板标签结构检查通过
- 当前执行环境无法访问 npm registry，因此完整 `npm run build` 需在 Windows 本地再次确认

---

## V0.3.1 — 2026-07-30

### 新增

- 输入框自动增高与手机软键盘适配
- 回到最新消息按钮
- 引用回复与引用气泡展示
- 图片消息、自动压缩和全屏预览
- 底部面板下滑关闭
- 气泡出现动画

### 优化

- 全局隐藏浏览器滚动条并保留触摸滚动
- 去除移动端点击高亮与不必要的文字选中
- 加强安全区、Home Indicator 和惯性滚动适配
- 长按消息菜单加入回复操作和设备触觉反馈

### 数据与备份

- 消息新增图片数据、图片名称与引用消息快照
- 备份格式升级至 V3
- 关系成长和关系事件进入备份，继续兼容 V1、V2 导入

### 验证

- 新增代码已完成 TypeScript 语法和关键类型检查
- Vue 模板标签结构检查通过
- 当前执行环境无法联网补齐 npm 依赖，因此完整 Vite 构建需在本地运行 `npm run build` 再确认

---

## V0.3.0 — 2026-07-30

### 新增

- 关系成长阶段：初识、熟悉、亲近、依赖、特别关系
- 动态情绪与情绪原因
- 久未聊天后的主动陪伴消息
- 一起听歌关系事件
- 关系成长记录与关系事件数据表

### 调整

- 关系阶段参与角色回复语气与亲近程度
- 心理活动面板展示当前关系阶段与情绪原因
- 聊天设置新增主动来找你和间隔时间

### 数据与架构

- Dexie 数据库升级至 V5
- 新增 `relationships` 与 `relationshipEvents` 表

---

## V0.2.0 — 2026-07-26

### 新增

- 重做沉浸式聊天页，主界面不展示模型和 API 技术状态
- 自定义聊天顶部：角色入口、一起听歌入口和聊天设置入口
- 面向用户展示的角色心情、活动与虚构心理活动
- 一起听歌第一版：歌曲名称、歌手、网络音频、本地音频、播放进度与陪听反应
- 聊天设置：回复长度、多气泡、输入动画、自然发送间隔和心理活动可见程度
- 三层记忆：最近聊天、旧消息摘要、重要记忆
- 自动记忆提取与记忆手动新增、删除、清空
- 长按消息复制、删除、重新生成
- 停止生成、输入草稿保存、滚动位置恢复和消息时间分隔
- 技术错误与模型状态移动到聊天设置的高级页面

### 数据与架构

- Dexie 数据库由 V3 升级至 V4
- 新增 `chatSettings`、`memories`、`conversationStates`、`musicStates` 表
- 消息新增 Provider、模型、降级、回复组和错误元数据
- Provider 请求支持 `AbortSignal`
- 备份格式升级至 V2，并兼容导入 V1 备份

### 验证

- `vue-tsc -b` 类型检查通过
- 旧数据库可通过 Dexie 自动升级保留角色与聊天数据

---

## V0.1.0 — 2026-07-25

### 新增

- 保留 DeepSeek 与 OpenAI 兼容接口两类在线模型配置
- 模型名称下拉框
- 通过 OpenAI 兼容 `GET /models` 接口拉取可用模型
- 拉取模型时的加载状态、模型数量和当前模型提示
- 接口不支持模型列表时可切换为手动填写
- 已拉取模型列表保存在 IndexedDB，刷新后继续显示
- 测试连接成功后显示当前模型与大致耗时
- API 错误代码参考

### 调整

- DeepSeek 默认模型更新为 `deepseek-v4-flash`
- DeepSeek 下拉框默认提供 `deepseek-v4-flash` 与 `deepseek-v4-pro`
- 自动迁移旧的 `deepseek-chat` 和 `deepseek-reasoner` 设置
- API 地址会自动清理末尾的 `/models`、`/chat/completions` 和多余斜杠
- OpenAI 兼容接口支持第三方中转、本地模型及其他兼容服务

### 修复

- 将 API Key 名称误填为模型名称后无法连接的问题
- 模型名称只能手动输入，容易填写错误的问题
- 服务端错误信息缺少中文解释的问题
- 部分 OpenAI 兼容接口返回不同模型列表格式时无法识别的问题

### 验证

- TypeScript 类型检查通过
- 本地模拟 Provider 继续可用
- 在线 Provider 支持模型拉取、手动填写、连接测试和保存

---

## V0.0.8 — 2026-07-24

### 新增

- 角色详情页
- 角色资料编辑页
- 角色完整资料展示与修改
- 角色详情页进入私聊
- 角色安全删除
- 删除角色时同步清理对应单聊会话与消息
- 群聊成员移除兼容逻辑
- 删除前确认与备份提醒
- `characterService.ts` 角色业务服务
- 角色改名时同步更新单聊标题
- 通讯录点击角色进入详情页

### 修复

- `/characters/new` 路由重复
- 固定创建路由与动态角色路由冲突风险
- `characterService.ts is not a module`
- 编辑页类型断言换行导致的 TypeScript 解析错误
- 通讯录旧聊天跳转逻辑残留
- 创建角色入口无法点击
- `openCreatePage` 未使用导致 `TS6133`

### 验证

- 可以创建角色
- 可以查看角色详情
- 可以修改角色
- 可以安全删除角色
- 已通过 `npm run build`

---

## V0.0.6 — 2026-07-23

### 新增

- 本地角色化回复
- CharacterReplyContext
- 角色风格识别
- 用户资料参与 AI 上下文
- 最近聊天消息参与回复生成

### 修复

- 所有角色使用同一固定 Mock 文案
- 将不同浏览器数据库误判为角色丢失
- 删除不再需要的临时苏晚恢复逻辑

---

## V0.0.5 — 2026-07-23

### 新增

- UserProfile 类型
- userProfiles 数据表
- 我的资料页
- 用户头像、昵称、身份和简介
- 用户头像同步聊天
- Dexie V2

### 修复

- userProfile 文件名大小写不一致
- tsconfig.node.json 缺少 noEmit

---

## V0.0.4 — 2026-07-23

### 新增

- CharacterAvatar 通用头像组件
- 照片头像
- 人物卡粘贴识别
- 性格、说话方式和背景模板
- 微信式聊天布局
- 动态聊天列表

### 修复

- Base64 头像显示为文字
- 点击自建角色进入顾言
- 林夏重复显示
- 聊天头像横向拉伸

---

## V0.0.3 — 2026-07-23

### 新增

- 独立 StatusBar
- 实时时间
- PhoneFrame 统一接入状态栏

### 修复

- 重复状态栏
- npm 在错误目录运行
- TypeScript 配置问题

---

## V0.0.2 — 2026-07-23

### 新增

- 滑动解锁
- DockBar
- 项目文档体系

## 0.4.2.4

- Persona 支持 JSON / TXT / MD 导入与 V2 JSON 导出。
- 新增 Tavo / SillyTavern / 通用 JSON 资源识别与导入预览。
- Character Card V2/V3 可显式转换为 Persona；世界书、预设、正则会被拦截。
- 未识别社区字段保存在 extraFields，避免资源静默丢失。
- 扩展 Persona 结构化字段，并强化“未知用户事实不得编造”的 Prompt 约束。

## 0.4.2.6
- 创建角色页支持直接导入 SillyTavern / Tavo JSON 角色卡，并同步导入内嵌 character_book。


### 0.4.2.6
- 修复创建页直接导入 Tavo / SillyTavern JSON 后可能出现的 IndexedDB `DataCloneError`。
- 角色卡导入改用浅响应状态，角色、世界书与 Persona 入库前统一去除 Vue Proxy。
- 增加 Tavo null 集合和 DataClone 回归测试。
- 强化角色卡内置 `{{user}}` 模板与当前 Persona 的事实隔离。


## 0.4.2.10

- 修复 `UserProfileView.vue` 模板中 `{{user}}` 字面量导致的 Vite `Unterminated string constant`。
- 将动态兜底文案移到 `<script setup>` 常量，模板只引用变量。
- 全局复核 `CharacterCreate.vue`、`CharacterCardEditorView.vue`、`UserProfileView.vue` 中的 `{{user}}` 展示写法。
- 删除交付源码中的旧 `characterCardImportService.js` 残留。
- IndexedDB 仍为 V8，备份格式仍为 V7。


## V0.4.2.11
Persona 图片头像、已读位置、角色卡 UI 解析与同场景自动识别升级。
