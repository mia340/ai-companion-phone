# AI Companion Phone 项目状态

## 当前版本

V0.3.3

## 当前阶段

项目已经形成单角色沉浸式陪伴聊天闭环，完成多模态图片理解、消息可靠性和流式回复升级，并开始拆分超大型聊天页面组件。

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
- 输入框自动增高、草稿保存、引用回复和图片预览
- 长按消息复制、回复、删除、重新生成和重新发送
- 消息发送中、发送失败、停止和异常恢复
- AI 回复可在气泡中逐步生成，并显示轻量光标
- 停止生成后保留已出现的文字
- 流式中断后保留部分内容并标记状态
- 重新进入页面时恢复遗留的 pending 消息
- 回到最新消息按钮和底部面板下滑关闭

### 多模态图片理解

- OpenAI 兼容 `image_url` 多模态消息
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
- `ChatComposer.vue` 负责输入、图片选择、待发送预览和引用预览
- `ChatRoom.vue` 保留会话编排、请求、记忆、关系和音乐逻辑
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
- 当前只支持一次发送一张图片
- 图片仍以 Data URL 保存，大量图片会占用 IndexedDB
- 图片理解结果尚未保存为可确认的结构化视觉记忆
- 数据只保存在当前浏览器，不会自动跨设备同步
- 长消息列表尚未使用分页或虚拟列表
- `ChatRoom.vue` 已开始拆分，但设置、音乐和心理活动面板仍可继续组件化
- 群聊、朋友圈、日记、钱包和游戏仍未完成

## 下一里程碑

V0.3.4 建议聚焦：

- 一次发送 2～4 张图片
- 相机直接拍摄
- 视觉内容确认后写入长期记忆
- 关系事件时间线与记忆回顾
- 继续拆分聊天设置和底部面板
