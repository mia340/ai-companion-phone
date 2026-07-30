# AI Companion Phone 项目状态

## 当前版本

V0.3.1

## 当前阶段

项目已经形成单角色沉浸式陪伴聊天闭环，当前重点从“功能可用”转向“像真实手机一样自然操作”。

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
- 页面切换动画
- 安全区和软键盘 Visual Viewport 适配
- 全项目隐藏浏览器滚动条并保留惯性滚动

### 用户与角色

- 用户资料、照片头像与简介
- 角色创建、编辑、详情和删除
- 人设、身份、说话方式、背景、喜好、心情和活动
- 通讯录分组与单聊自动创建

### 聊天体验

- 双方头像和左右气泡
- 草稿保存、滚动位置恢复、时间分隔
- 输入框自动增高
- 正在输入、自然发送间隔和多气泡回复
- 停止等待回复
- 回到最新消息按钮
- 长按消息复制、回复、删除和重新生成
- 引用回复气泡
- 图片消息、自动压缩和全屏预览
- 气泡出现动画
- 心理活动、音乐、设置和消息菜单下滑关闭

### 陪伴能力

- 角色心理活动和公开可见状态
- 三层聊天记忆：最近消息、旧对话摘要、重要记忆
- 关系成长：初识、熟悉、亲近、依赖、特别关系
- 动态情绪与关系事件
- 久未聊天时的主动陪伴消息
- 一起听歌和角色陪听反应

### Provider 与设置

- 本地模拟回复
- DeepSeek
- OpenAI 兼容接口
- 模型列表拉取、连接测试和错误中文说明
- 技术信息仅放在聊天设置“高级”区域

### 数据

当前 IndexedDB 表：

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

备份格式为 V3，包含角色、聊天、图片消息、记忆、音乐状态、关系成长和关系事件，并兼容导入 V1、V2 备份。

## 当前限制

- 数据只保存在当前浏览器，不会自动跨设备同步
- 图片使用 Data URL 保存，大量图片会增加 IndexedDB 和备份文件体积
- 图片消息暂不支持说明文字、多图组合和角色视觉识别
- 长消息列表尚未使用分页或虚拟列表
- 群聊、朋友圈、日记、钱包和游戏仍未完成
- 当前环境无法联网安装 npm 依赖，完整生产构建需在 Windows 本地确认

## 下一里程碑

V0.4.0 建议聚焦长期陪伴内容：关系事件时间线、记忆回顾、图片说明文字、多图消息和更自然的流式回复。
