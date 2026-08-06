
## V0.3.7 图片与消息体验完整升级

- 单图自适应尺寸与 2～6 图网格重排。
- 全屏滑动、缩略图导航和当前图片保存。
- 图片逐张容错、重复过滤、处理进度和提示自动消失。
- 数据库不变，旧消息与备份继续兼容。

# AI Companion Phone 项目状态

## 当前版本

V0.3.6

## 当前阶段

项目已经形成单角色沉浸式陪伴聊天闭环，完成多模态图片理解、流式回复、语音输入、角色朗读和消息可靠性升级，并完成语音与滚动逻辑解耦、心理活动和音乐面板拆分，以及最多 6 张图片的多图消息闭环。

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
- 图片最长边 1280 像素和目标体积压缩
- 首次选择图片的隐私确认

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

IndexedDB 仍为 V5，无需新增索引：

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

备份格式仍为 V4，可选择是否包含图片，并兼容导入 V1、V2、V3。

## 当前限制

- 流式效果取决于接口是否正确实现 OpenAI SSE；普通 JSON 接口只能一次显示完整回复
- 图片仍以 Data URL 保存，大量图片会占用 IndexedDB
- 图片理解结果尚未保存为可确认的结构化视觉记忆
- 数据只保存在当前浏览器，不会自动跨设备同步
- 长消息列表尚未使用分页或虚拟列表
- `ChatRoom.vue` 仍包含流式请求、消息操作、记忆和关系编排，可继续提取 composables
- 群聊、朋友圈、日记、钱包和游戏仍未完成

## 下一里程碑

V0.3.7 建议聚焦：

- 提取 `useChatStreaming.ts` 与 `useMessageActions.ts`
- 多图拖动排序和画质选择
- 将用户确认过的视觉描述写入长期记忆
- 角色主动语音消息与未读语音状态
- 长消息列表分页或虚拟列表
