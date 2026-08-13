# AI Companion Phone 项目状态

## 当前版本

V0.4.3.3

## 当前阶段

项目已进入“长期陪伴内核 + Tavo / SillyTavern 社区资源兼容运行时”阶段。角色聊天仍保留多层记忆、双模式消息、场景状态与事实约束，同时新增可组合的世界书、Prompt 预设、正则和安全 Rich UI。桌面“世界”现在是统一资源中心。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router（Hash 模式）
- Pinia
- Dexie / IndexedDB
- PWA
- Mock、DeepSeek 与 OpenAI 兼容 Provider

## 已完成

### Phone OS 与基础页面

- 锁屏、桌面、状态栏、Dock、Home Indicator
- 手机外框与移动端全屏布局
- 安全区和软键盘 Visual Viewport 适配
- 全项目隐藏浏览器滚动条并保留惯性滚动
- 路由切换时保持手机外框稳定

### 用户与角色

- 用户资料、照片头像与简介
- 角色创建、编辑、详情和删除
- 人设、身份、说话方式、背景、喜好、心情和活动
- 通讯录分组与单聊自动创建

### 沉浸角色扮演

- 角色卡 V2：人格细节、场景、多开场、示例对话和表达偏好
- 多套用户 Persona 与聊天独立选择
- 世界书 Lorebook：关键词、常驻、角色专属和优先级
- 角色、Persona、关系、记忆、世界书和视觉信息的分层 Prompt 编排
- 去 AI 腔规则与图片内部观察
- 候选回复切换、继续生成、消息编辑和聊天分支
- `/ooc` 导演指令


### 长期记忆与主动陪伴

- 六层记忆：客观事实、角色主观记忆、共同经历、承诺、关系事件和长期剧情
- 明确记忆自动识别、相似合并、单值事实冲突检测和日期提醒
- 本轮记忆命中分数、原因、次数和最近命中时间
- 完整记忆管理：添加、编辑、锁定、降权、标错、解决冲突和删除
- 状态协议 V2：地点、时间段、活动、心情、精力、关系感受、未完话题、事件和目标
- 状态变化历史与自然语言展示
- 主动消息来源、频率、最短间隔、安静时段和关系阶段控制
- 输入停顿、撤回、消息回应表情和主动分享图片占位
- Prompt 分区预算、截断风险、命中原因、规则影响和自然度评分

### Tavo / SillyTavern 资源兼容

- 社区资源原始文件无损归档，保存来源、完整 JSON / 文本和兼容报告。
- 资源作用域支持全局与角色级组合；后端已预留 conversation / persona 作用域。
- Character Card 创建后保留完整原始 JSON，可在未来兼容升级中重新解析未知 extensions。
- Theme / 未识别社区资源先安全归档，不会静默丢字段或直接执行陌生脚本。
- 世界中心：世界书 / 世界状态 / 预设 / 正则 / 资源库。
- Character Card V2/V3 内嵌世界书和正则随角色导入并支持启停。
- 世界书保留 selective、regex key、position、depth、probability、group、sticky 等常见字段。
- Prompt Preset 支持 prompts + prompt_order 基础运行。
- Regex Pipeline 支持用户输入、AI 输出、World Info、Prompt Only 基础作用域。
- Safe Rich HTML/CSS Renderer 支持社区状态栏、小手机卡片、details/summary、图片与 CSS 动画，同时禁止第三方 JavaScript。
- Rich 消息保存原始模型输出，后续 Prompt 不依赖渲染后的 HTML 文本。
- IndexedDB V10 / 备份 V9。

### 场景距离与双模式消息

- 相处状态支持自动 / 在身边 / 远程，并进入持续状态。
- 动作视角支持始终显示 / 只在身边 / 关闭。
- 在身边时 `scene_action` 转为括号动作，与对白合并在一个剧情气泡。
- 远程时 `scene_action` 保存为独立 Action，玩家仍可看到角色另一端的当前动作。
- 远程对白严格按一个完整句子一个独立消息，并保存同轮分组与顺序。
- 远程多气泡时不再先创建完整流式大气泡；生成期间显示输入状态，完成后逐条落库。
- “始终显示动作”下远程每轮至少有一条独立 Action，模型漏写时使用状态生成安全兜底。
- 每轮 Prompt 注入设备本地精确时间，避免错误的相对时间推断。
- 用户习惯、偏好和旧经历只能由 Persona、用户历史原文或长期记忆支持，检测到无依据陈述会尝试纠偏重写。
- 旧模型直接输出的 `（动作）`、`(动作)`、`*动作*`、`【动作】` 可转换为场景动作。
- Prompt 限制远程无意义微动作，通常每轮只保留 0～2 个有价值动作。

### 角色互动引擎与调试

- 隐藏 `<companion_packet>` 协议，支持 text、emoji、voice 多动作消息
- 连续消息节奏与角色回复速度联动
- 角色正文与心情、活动、地点、关系感受、心理活动状态分离
- 相关记忆选择与本轮记忆命中记录
- Prompt 调试器：世界书、记忆、最终 Prompt、原始输出和自然度警告
- 主动消息延续未完话题并遵守非操控设计
- SillyTavern V2 / V3 JSON 主要字段导入与 V2 JSON 导出
- 角色资源作者、版本、来源、许可和二改元数据

### 聊天体验

- 双方头像、左右气泡、时间分隔和滚动位置恢复
- 输入框自动增高、草稿保存、引用回复和多图轮播预览
- 长按消息复制、回复、删除、重新生成和重新发送
- 消息发送中、已发送、已读、发送失败、停止和异常恢复
- AI 回复可在气泡中逐步生成，并显示轻量光标
- 停止生成后保留已出现的文字
- 流式中断后保留部分内容并标记状态
- 重新进入页面时恢复遗留的 pending 消息
- 回到最新消息按钮和底部面板下滑关闭
- 流式回复期间可提前输入并保存下一条消息
- 失败或停止状态可直接点击重试

### 语音陪伴

- 点击或长按麦克风开始语音输入
- 支持录音时长、取消、识别中状态和失败重试提示
- 识别结果先填入输入框，由用户确认后发送
- AI 回复支持朗读、暂停、继续和停止
- 每个聊天角色独立保存声音、语速与自动朗读设置
- 根据角色风格、情绪和关系阶段轻微调整播放节奏
- 不支持时自动隐藏或降级为纯文字

### 多模态图片理解

- OpenAI 兼容 `image_url` 多模态消息
- 一条消息最多发送 6 张图片，并作为同一轮视觉输入
- 相册多选、移动端相机拍摄、逐张移除和多图网格气泡
- 图片与附言作为同一条消息发送
- 自动检测接口和模型的图片输入能力
- 自动、强制启用、关闭三种图片模式
- 不支持图片时自动改用自然文字兜底
- 图片按设备能力缩放至最长边 1080～1440 像素，并以约 760 KB 为压缩目标
- 首次选择图片的隐私确认
- 多图串行处理队列、逐张进度与资源释放
- PNG / JPEG / WebP 编码自动切换与安全原图兜底
- 失败图片显示真实文件名和原因，并支持单张重试
- 待发送图片详情、压缩前后体积和前后排序
- AI 图片读取状态与视觉兜底结果提示

### 流式 Provider

- `ModelProvider.chatStream()` 增量回复接口
- OpenAI 兼容 SSE `data:` 事件解析
- 普通 JSON 响应自动兼容
- 本地模拟 Provider 分段输出
- 图片理解、视觉降级和本地兜底继续适用于流式请求
- 通过节流写入 Dexie，并用 `requestAnimationFrame` 控制滚动刷新

### 陪伴能力

- 角色心理活动和公开可见状态
- 最近消息、旧对话摘要和重要记忆
- 图片附言参与记忆提取
- 关系成长：初识、熟悉、亲近、依赖、特别关系
- 图片分享参与亲密度、熟悉度和动态情绪
- 久未聊天时的主动陪伴消息
- 一起听歌和角色陪听反应

### 代码结构

- `ChatMessageItem.vue` 负责单条消息、头像、图片、引用和状态
- `ChatComposer.vue` 负责输入、图片选择、语音入口、待发送预览和引用预览
- `ChatHeader.vue` 负责聊天顶部导航与功能入口
- `ChatMessageList.vue` 负责消息列表、输入状态和滚动容器
- `ChatSettingsPanel.vue` 负责聊天、记忆、语音和高级设置
- `ChatActionSheet.vue` 负责消息长按操作
- `ChatImagePreview.vue` 负责多图全屏轮播预览
- `ChatThoughtPanel.vue` 负责角色心理活动
- `ChatMusicPanel.vue` 负责一起听歌界面和音频元素
- `useChatSpeech.ts` 负责语音识别与角色朗读
- `useChatScroll.ts` 负责滚动恢复与最新消息定位
- `useBottomPanel.ts` 负责面板拖动关闭
- `ChatRoom.vue` 保留会话编排、Provider、记忆、关系和流式请求逻辑
- Provider 层统一普通回复和流式回复能力

### 数据

IndexedDB 当前为 V8：

- worlds
- characters
- contactGroups
- conversations
- messages
- userProfiles
- modelSettings
- chatSettings
- memories
- conversationStates
- musicStates
- relationships
- relationshipEvents
- personas
- lorebookEntries
- promptDebugTraces（本地调试，不进入备份）
- conversationStateHistory

备份格式为 V7，可选择是否包含图片，并兼容导入 V1～V6。

## 当前限制

- 流式效果取决于接口是否正确实现 OpenAI SSE；普通 JSON 接口只能一次显示完整回复
- 图片仍以 Data URL 保存，大量图片会占用 IndexedDB
- 图片理解结果尚未保存为可确认的结构化视觉记忆
- 数据只保存在当前浏览器，不会自动跨设备同步
- 长消息列表尚未使用分页或虚拟列表
- `ChatRoom.vue` 仍包含流式请求、消息操作、记忆和关系编排，可继续提取 composables
- 群聊、朋友圈、日记、钱包和游戏仍未完成

## 下一里程碑

V0.5.0 建议先建设 Companion OS 公共底座：

- 应用注册与桌面扩展机制
- AI 工具动作和权限系统
- 跨应用事件总线
- 虚拟钱包、订单和礼物
- 通知中心与任务调度
- 为海龟汤、飞行棋、小说、笔记、购物、外卖和红包提供统一能力

先完成底座，再分版本加入小游戏和生活应用，避免把业务继续堆进 `ChatRoom.vue`。


### V0.4.2.4
用户 Persona 已具备 JSON/TXT 导入、资源类型识别、导入预览、同名处理、V2 JSON 导出与社区字段保真能力。


### V0.4.2.6
创建角色页已支持直接导入 SillyTavern / Tavo V2/V3 JSON，并同步导入角色卡内嵌 character_book。


## V0.4.2.6 当前状态
创建角色页可直接导入 Tavo / SillyTavern JSON；导入数据会在写入 IndexedDB 前转换为纯可克隆数据，避免 Vue Proxy 导致 `DataCloneError`。Persona 导入也使用相同保护。


### V0.4.2.9
- 已支持角色卡 `{{user}}` → 角色专属 Persona。
- 创建角色时可自动建立并绑定卡内用户身份。
- 我的资料页可查看全局与角色专属 Persona。
- IndexedDB V8 / 备份 V7 保持不变。


### V0.4.2.10

- 修复 `UserProfileView.vue` 中角色卡 `{{user}}` 字面量嵌套在 Vue 插值表达式导致的 Vite 模板解析失败。
- 模板表达式不再直接包含 `{{user}}` 字面量，改为脚本常量。
- 保留角色卡自带 `{{user}}` → 角色专属 Persona → 自动绑定聊天的完整流程。
- IndexedDB 仍为 V8，备份格式仍为 V7。
