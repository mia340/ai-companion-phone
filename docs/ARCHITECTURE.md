# AI Companion Phone 架构文档

> 当前架构版本：**V0.4.4.1**。下方早期章节保留历史记录，最新运行原则以文末 V0.4.4.1 章节为准。

# AI Companion Phone 架构说明

## 1. 项目名称

AI Companion Phone

中文名称：

虚拟手机 · AI 陪伴世界

---

## 2. 项目定位

这是一个以“虚拟手机”为交互载体的 AI 陪伴类 PWA 应用。

用户可以在虚拟手机中：

- 创建多个原创 AI 角色
- 与角色进行私聊和群聊
- 查看角色朋友圈
- 建立角色关系
- 管理角色记忆
- 观察世界状态变化
- 使用日记、音乐、钱包、游戏等虚拟应用
- 创建多个彼此独立的虚拟世界

项目第一阶段采用前端本地运行模式。

主要技术：

- Vue 3
- TypeScript
- Vite
- Vue Router
- Pinia
- Dexie
- IndexedDB
- PWA

后续再加入：

- 云端数据库
- 用户账号系统
- 多设备同步
- AI 服务端代理
- 消息推送
- 内容审核与安全系统

---

## 3. 总体架构

```text
AI Companion Phone
│
├── Phone OS
│   ├── LockScreen
│   ├── HomeScreen
│   ├── StatusBar
│   ├── DockBar
│   ├── AppGrid
│   ├── Widget
│   ├── Notification
│   └── Wallpaper
│
├── App System
│   ├── Chat
│   ├── Contacts
│   ├── Moments
│   ├── Diary
│   ├── Music
│   ├── Wallet
│   ├── Games
│   ├── Character Profile
│   ├── Memory Manager
│   ├── World Status
│   ├── Appearance
│   └── Settings
│
├── AI Character System
│   ├── Character Profile
│   ├── Personality
│   ├── Relationship
│   ├── Emotion
│   ├── Goal
│   ├── Secret
│   ├── Autonomous Behavior
│   └── Role Isolation
│
├── Memory System
│   ├── Immediate Memory
│   ├── Short-term Memory
│   ├── Long-term Memory
│   ├── Core Memory
│   ├── Memory Retrieval
│   ├── Memory Summarization
│   └── Memory Editing
│
├── World System
│   ├── World Profile
│   ├── World Time
│   ├── World Rules
│   ├── Events
│   ├── Relationships
│   ├── Character Activities
│   └── Multiple Worlds
│
├── AI Provider System
│   ├── Provider Adapter
│   ├── Model Configuration
│   ├── Prompt Builder
│   ├── Context Builder
│   ├── Response Parser
│   ├── Real Provider Adapter（DeepSeek / OpenAI-compatible）
│   └── Token / Network Error Handling
│
├── Data System
│   ├── IndexedDB
│   ├── Repository Layer
│   ├── Data Migration
│   ├── Import and Export
│   ├── Backup
│   └── Future Cloud Sync
│
└── Safety System
    ├── Privacy Rules
    ├── Character Boundaries
    ├── Content Safety
    ├── Data Deletion
    ├── Permission Control
    └── Sensitive Information Protection
```

---

## 4. 当前目录结构

当前项目主要目录：

```text
ai-companion-phone
│
├── docs
│   ├── 开发日志.md
│   ├── PROJECT_STATUS.md
│   ├── ARCHITECTURE.md
│   ├── CHANGELOG.md
│   └── 毕业设计与论文素材.md
│
├── public
│
├── src
│   ├── assets
│   │
│   ├── components
│   │   ├── PhoneFrame.vue
│   │   ├── DockBar.vue
│   │   ├── StatusBar.vue
│   │   └── CharacterAvatar.vue
│   │
│   ├── db
│   │   ├── database.ts
│   │   └── seed.ts
│   │
│   ├── router
│   │
│   ├── services
│   │   ├── ai
│   │   │   └── provider.ts
│   │   └── userProfile.ts
│   │
│   ├── stores
│   │
│   ├── types
│   │   └── domain.ts
│   │
│   ├── views
│   │   ├── LockScreen.vue
│   │   ├── HomeScreen.vue
│   │   ├── ChatList.vue
│   │   ├── ChatRoom.vue
│   │   ├── ContactsView.vue
│   │   ├── CharacterCreate.vue
│   │   ├── PlaceholderApp.vue
│   │   └── SettingsView.vue
│   │
│   ├── App.vue
│   ├── main.ts
│   └── main.css
│
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
└── vite.config.ts
```

---

## 5. Phone OS 架构

Phone OS 负责模拟手机系统外壳和基础交互。

### 5.1 PhoneFrame

文件：

```text
src/components/PhoneFrame.vue
```

职责：

* 提供统一手机外框
* 提供顶部状态区域
* 提供底部安全区域
* 控制手机尺寸和页面显示范围
* 保证不同 App 在同一手机框架内展示

PhoneFrame 不负责具体业务数据。

---

### 5.2 LockScreen

文件：

```text
src/views/LockScreen.vue
```

当前功能：

* 显示时间
* 显示日期
* 显示通知卡片
* 支持向上滑动解锁
* 解锁后进入 HomeScreen

后续功能：

* 实时时钟
* 多条通知
* 锁屏壁纸
* 通知点击跳转
* 密码或生物识别模拟
* 音乐播放控件
* 快捷相机入口

---

### 5.3 HomeScreen

文件：

```text
src/views/HomeScreen.vue
```

当前功能：

* 显示欢迎组件
* 显示桌面 App 网格
* 显示 DockBar
* 点击 App 后进行路由跳转

后续需要拆分为：

```text
HomeScreen
├── ProfileWidget
├── AppGrid
├── AppIcon
├── DockBar
├── Wallpaper
└── DesktopPager
```

HomeScreen 后续只负责组合组件，不直接承载大量细节代码。

---

### 5.4 DockBar

文件：

```text
src/components/DockBar.vue
```

当前功能：

* 接收应用数据
* 显示 Dock 图标
* 点击图标进行路由跳转
* 提供毛玻璃背景效果

后续功能：

* 未读消息徽标
* 点击动画
* 长按菜单
* 拖拽排序
* 用户自定义 Dock
* 震动反馈
* 当前 App 状态提示

---

### 5.5 StatusBar

当前状态：

已完成基础拆分，并由 PhoneFrame 统一接入。

当前文件：

```text
src/components/StatusBar.vue
```

职责：

* 时间
* 网络状态
* 电量
* 通知状态
* 沉浸模式
* 不同 App 的状态栏主题

---

## 6. App System 架构

每个虚拟 App 应作为独立模块开发。

建议未来结构：

```text
src/apps
│
├── chat
│   ├── views
│   ├── components
│   ├── store
│   ├── service
│   └── types
│
├── contacts
├── moments
├── diary
├── music
├── wallet
├── games
├── memory
├── world
└── settings
```

当前项目规模较小，页面暂时保存在：

```text
src/views
```

当某个 App 文件超过约 5 个时，再迁移到独立模块目录，避免过早复杂化。

---

## 7. AI 角色系统

AI 角色是本项目的核心数据对象。

每个角色至少包含：

```text
Character
├── id
├── worldId
├── name
├── avatar
├── gender
├── age
├── identity
├── personality
├── speakingStyle
├── background
├── relationshipToUser
├── relationshipValues
├── currentEmotion
├── goals
├── secrets
├── permissions
├── privacyRules
├── createdAt
└── updatedAt
```

### 7.1 角色隔离原则

不同角色必须拥有独立的：

* 人设
* 记忆
* 情绪
* 关系
* 秘密
* 对话上下文
* 世界认知
* 主动行为状态

角色 A 不应自动知道角色 B 的私聊内容。

只有在以下情况才能共享信息：

* 出现在同一群聊
* 用户主动转述
* 世界事件公开传播
* 角色关系规则允许
* 用户设置允许读取

---

## 8. 四层记忆系统

计划采用四层记忆结构。

### 8.1 即时记忆

范围：

当前对话最近若干条消息。

用途：

保证连续对话。

特点：

* 直接加入上下文
* 容量小
* 更新频繁

---

### 8.2 短期记忆

范围：

近期对话摘要、近期事件和近期情绪变化。

用途：

帮助角色记住最近几天发生的事。

特点：

* 定期摘要
* 可以逐渐衰减
* 与角色当前状态有关

---

### 8.3 长期记忆

范围：

重要经历、承诺、冲突、喜好、关系变化。

用途：

形成持续关系和人物成长。

特点：

* 可检索
* 有重要性评分
* 有时间和来源记录
* 不应每次全部加入上下文

---

### 8.4 核心记忆

范围：

决定角色身份和关系的关键事实。

例如：

* 用户救过角色
* 两人是恋人
* 角色曾经历重大创伤
* 用户明确要求角色永远记住的事

特点：

* 权重最高
* 不轻易衰减
* 修改时需要用户确认
* 会持续影响角色行为

---

## 9. 世界系统

每个世界彼此独立。

世界对象计划包含：

```text
World
├── id
├── name
├── description
├── rules
├── timeMode
├── currentTime
├── currentState
├── publicEvents
├── locations
├── characters
├── relationships
├── createdAt
└── updatedAt
```

支持的时间模式：

* 现实时间同步
* 游戏内加速时间
* 用户手动推进
* 后续支持剧情时间

角色的记忆、关系和事件必须绑定 `worldId`，避免多个世界之间数据串联。

---

## 10. AI 调用流程

未来标准调用流程：

```text
用户发送消息
↓
识别当前世界
↓
识别当前角色或群聊
↓
读取角色档案
↓
读取角色关系
↓
读取当前情绪
↓
检索相关记忆
↓
读取近期世界事件
↓
读取对话上下文
↓
Prompt Builder 组装提示词
↓
调用 AI Provider
↓
解析模型返回
↓
生成角色回复
↓
保存消息
↓
提取新记忆
↓
更新情绪和关系
↓
更新世界状态
```

AI 调用必须通过统一 Provider 接口，不能把某一家模型直接写死在页面中。

建议接口：

```ts
interface AIProvider {
  chat(request: AIRequest): Promise<AIResponse>
}
```

未来可以实现：

```text
MockProvider
OpenAIProvider
AnthropicProvider
GeminiProvider
CustomProvider
LocalModelProvider
```

---

## 11. 数据层架构

当前阶段使用：

```text
IndexedDB + Dexie
```

页面不应直接到处操作数据库。

后续推荐分层：

```text
View
↓
Store
↓
Service
↓
Repository
↓
IndexedDB
```

示例：

```text
ChatRoom.vue
↓
chatStore
↓
chatService
↓
messageRepository
↓
IndexedDB
```

这样未来更换云端数据库时，不需要重写全部页面。

---

## 12. 状态管理

Pinia 负责全局共享状态。

计划建立：

```text
stores
├── phoneStore
├── userStore
├── characterStore
├── chatStore
├── memoryStore
├── worldStore
├── settingsStore
└── notificationStore
```

不需要共享的局部状态，应保留在组件内部，不要全部塞入 Pinia。

---

## 13. 路由原则

Vue Router 负责页面导航。

当前主要路由：

```text
/                       锁屏
/home                   桌面
/chat                   聊天列表
/chat/:id               聊天房间
/contacts               通讯录
/characters/new         创建角色
/profile                我的资料
/settings               设置
/app/:name              占位 App
```

后续路由应尽量使用稳定英文路径，中文仅作为界面显示文本。

例如：

```text
/moments
/diary
/music
/wallet
/games
/memory
/world
```

不建议长期使用：

```text
/app/朋友圈
```

---

## 14. 开发原则

### 14.1 一次只完成一个小功能

固定流程：

```text
明确目标
↓
解释原理
↓
修改一个文件或一个小点
↓
保存
↓
浏览器验证
↓
记录开发日志
```

---

### 14.2 先完成可运行版本

优先级：

```text
可运行
> 可理解
> 可维护
> 美观
> 高级架构
```

不为了“看起来专业”而过早引入复杂架构。

---

### 14.3 组件单一职责

一个组件尽量只负责一类事情。

例如：

* DockBar 负责 Dock
* StatusBar 负责状态栏
* AppIcon 负责一个 App 图标
* MessageBubble 负责一条消息

---

### 14.4 页面不直接绑定具体 AI 厂商

页面只调用统一 AI 服务。

错误示例：

```text
ChatRoom 直接请求某个模型接口
```

正确方向：

```text
ChatRoom
→ chatService
→ AIProvider
```

---

### 14.5 API Key 不进入 GitHub

以下内容必须加入 `.gitignore`：

```text
.env
.env.local
.env.production
```

API Key 不能直接写入：

* Vue 文件
* TypeScript 文件
* GitHub 仓库
* 截图
* 开发日志

---

## 15. 当前完成状态

### Phone OS

```text
LockScreen      已完成基础版本
HomeScreen      已完成基础版本
PhoneFrame      已完成基础版本
DockBar         已完成基础版本
StatusBar       待拆分
AppGrid         待拆分
Widget          待开发
Notification    待开发
Wallpaper       待开发
```

### App 页面

```text
ChatList          已有基础页面
ChatRoom          已有基础页面
ContactsView      已有基础页面
CharacterCreate   已有基础页面
SettingsView      已有基础页面
PlaceholderApp    已有基础页面
```

### 核心系统

```text
AI 角色系统       待开发
四层记忆系统      待开发
世界系统          待开发
群聊系统          待开发
主动消息系统      待开发
关系系统          待开发
朋友圈系统        待开发
小游戏系统        待开发
```

---

## 16. 下一阶段计划

当前优先继续完成 Phone OS 基础组件。

建议顺序：

```text
1. StatusBar 独立组件
2. AppIcon 独立组件
3. AppGrid 独立组件
4. Notification 基础组件
5. 桌面壁纸设置
6. App 打开和返回体验
7. 开始角色数据结构
```

Phone OS 基础稳定后，进入项目核心：

```text
AI 角色系统
↓
私聊系统
↓
记忆系统
↓
关系与情绪
↓
主动消息
↓
世界系统
```

---

## 17. 文档维护规则

每次开发结束，至少更新：

```text
开发日志.md
PROJECT_STATUS.md
```

发生架构调整时更新：

```text
ARCHITECTURE.md
```

未来新增：

```text
CHANGELOG.md
DATABASE.md
AI_PROMPT.md
API.md
UI_GUIDE.md
```

---

## 18. 当前版本

```text
V0.0.2
```

当前阶段：

```text
Phone OS 基础开发
```

````

---

## 19. V0.0.6 已实现架构补充

本节记录从 V0.0.3 到 V0.0.6 已经落地的实际架构，作为后续开发和毕业设计论文的当前基线。

### 19.1 当前页面与组件关系

```text
App.vue
└── RouterView
    ├── LockScreen.vue
    ├── HomeScreen.vue
    ├── ContactsView.vue
    ├── CharacterCreate.vue
    ├── ChatList.vue
    ├── ChatRoom.vue
    ├── UserProfileView.vue
    ├── SettingsView.vue
    └── PlaceholderApp.vue

各页面
└── PhoneFrame.vue
    ├── StatusBar.vue
    ├── App Header
    ├── Page Slot
    └── Home Indicator
```

### 19.2 当前头像组件

文件：

```text
src/components/CharacterAvatar.vue
```

职责：

- 接收头像字符串
- 判断 Emoji 与图片数据
- 支持 Base64 Data URL
- 支持 Blob URL
- 支持 HTTP/HTTPS URL
- 统一尺寸、圆角和裁剪
- 供通讯录、聊天列表、聊天房间和用户资料页复用

### 19.3 当前用户资料架构

```text
UserProfileView.vue
        ↓
userProfile.ts
        ↓
db.userProfiles
        ↓
IndexedDB
```

用户资料包括：

- 昵称
- 头像
- 身份
- 简介
- 创建时间
- 更新时间

聊天页读取同一份 UserProfile，避免多个页面分别保存用户头像。

### 19.4 当前角色创建流程

```text
手动填写 ─────────────┐
人物卡粘贴与规则识别 ─┼→ 表单校验
模板辅助选择 ─────────┘
                         ↓
                     图片裁剪压缩
                         ↓
                 Dexie Transaction
                  ├── Character
                  └── Conversation
                         ↓
                       通讯录
```

### 19.5 当前单聊匹配原则

通讯录不再根据姓名写死跳转。

匹配条件：

```text
conversation.type === 'single'
conversation.memberIds.length === 1
conversation.memberIds[0] === character.id
```

找不到对应会话时，系统自动创建新的单聊会话。

### 19.6 当前 AI 上下文

ChatRoom 组装：

```text
角色姓名
角色身份
核心人设
说话方式
背景故事
与用户关系
当前心情
当前活动
喜欢与不喜欢
用户昵称
用户身份
用户简介
最近对话
```

随后传给统一 Provider。

### 19.7 当前 Provider 调用关系

```text
ChatRoom.vue
    ↓
ModelProvider.chat()
    ↓
MockProvider
    ↓
ChatResponse
```

当前 MockProvider 使用本地规则验证角色差异。

后续真实模型接入时，ChatRoom 不应直接修改为某个厂商请求，而应增加 Provider Router 或 Chat Service。

### 19.8 当前数据库版本

```text
Version 1
├── worlds
├── characters
├── contactGroups
├── conversations
└── messages

Version 2
└── userProfiles
```

Dexie 负责版本升级，旧角色和消息不因新增表而删除。

### 19.9 浏览器存储边界

IndexedDB 数据与浏览器配置环境绑定。

开发阶段已经验证：

- 外部 Edge
- VS Code 内置浏览器

可以拥有不同角色数据。

因此后续必须建设：

- 数据导出
- 数据导入
- 数据备份
- 正式版本中的账号同步或云端同步

### 19.10 下一阶段架构重点

优先新增：

```text
src/services/chat/
├── chatService.ts
├── contextBuilder.ts
└── promptBuilder.ts

src/repositories/
├── characterRepository.ts
├── conversationRepository.ts
├── messageRepository.ts
└── userProfileRepository.ts
```

但应在功能复杂度确实增长后再迁移，避免过早抽象。



---

## 20. V0.0.8 角色生命周期架构

### 20.1 页面关系

```text
ContactsView.vue
    ↓
CharacterDetailView.vue
    ├── 进入聊天
    ├── 进入编辑
    └── 安全删除

CharacterEditView.vue
    ↓
characterService.ts
    ↓
Dexie Transaction
    ├── characters
    └── conversations
```

### 20.2 角色服务职责

`src/services/characterService.ts` 提供：

- `findSingleConversation()`
- `getOrCreateSingleConversation()`
- `updateCharacterAndConversation()`
- `deleteCharacterSafely()`

页面不再自行拼接复杂删除逻辑。

### 20.3 安全删除策略

```text
删除请求
↓
查找关联会话
├── 单聊 → 删除消息与会话
└── 群聊
    ├── 仍有成员 → 移除角色
    └── 无成员 → 删除消息与群聊
↓
删除角色
↓
提交事务
```

### 20.4 更新一致性

角色改名时，同一事务同步更新 Character 与对应单聊 Conversation，保证通讯录、详情页和聊天标题一致。

### 20.5 当前路由

```text
/characters/new
/characters/:id/edit
/characters/:id
```

固定路径位于动态路径之前，同一路径不得重复注册。

### 20.6 当前服务层

```text
src/services
├── ai/provider.ts
├── userProfile.ts
├── characterService.ts
└── dataBackup.ts
```

### 20.7 当前版本与阶段

```text
V0.0.8
```

当前阶段：

```text
本地角色完整生命周期、数据备份和角色化聊天闭环
```

下一架构重点：

```text
模型设置
↓
真实 AI Provider
↓
短期记忆
↓
错误降级与安全策略
```


---

## 21. V0.1.0 模型发现与选择架构

### 21.1 Provider 接口扩展

```text
ModelProvider
├── chat(request)
├── listModels()
└── testConnection()
```

`listModels()` 返回统一的 `ProviderModel[]`，页面不直接解析各服务商的原始响应。

### 21.2 模型拉取流程

```text
用户填写 API 地址与 Key
↓
点击“拉取模型”
↓
OpenAICompatibleProvider.listModels()
↓
GET {baseUrl}/models
↓
解析 data / models / 字符串数组
↓
去重模型 ID
↓
生成下拉框
↓
保存可用模型列表与当前选择
```

### 21.3 双模式选择

```text
模型列表可用 → 下拉选择
接口不支持 /models → 手动填写
```

该设计保证标准接口操作方便，也兼容不提供模型枚举的第三方服务。

### 21.4 地址规范化

保存前移除：

- 末尾多余 `/`
- `/models`
- `/chat/completions`

Provider 再统一拼接实际接口路径，避免地址重复。

### 21.5 旧模型迁移

读取 DeepSeek 设置时，如发现旧模型：

```text
deepseek-chat
deepseek-reasoner
```

自动迁移到当前默认模型，并保留拉取模型功能供用户刷新服务端实际列表。


---

## 22. V0.2.0 沉浸式聊天、记忆与音乐架构

### 22.1 聊天界面边界

聊天主界面只展示角色身份、消息与真实手机式交互。Provider、模型名、降级和技术错误不会直接显示在消息顶部，而是保存到消息元数据或 `conversationStates`，仅在右上角聊天设置的“高级”标签中查看。

### 22.2 数据表

- `chatSettings`：每个会话独立的回复长度、多气泡、输入动画、自然延迟、记忆和心理活动设置。
- `memories`：结构化的重要用户信息，按会话和角色隔离。
- `conversationStates`：旧对话摘要、角色可见心理状态、最近技术错误。
- `musicStates`：一起听歌的曲目、地址、进度、音量和播放状态。

### 22.3 三层记忆

1. 最近聊天：按 `recentMessageLimit` 取最后若干消息。
2. 对话摘要：消息积累到阈值后，把较旧消息压缩为本地摘要。
3. 重要记忆：从用户消息中提取姓名、喜好、事件、约定和关系信息，也支持手动管理。

最终系统提示由角色设定、用户资料、摘要、重要记忆和最近聊天共同组成。

### 22.4 心理活动

心理活动属于面向用户的角色化状态，不读取或展示模型内部推理。在线 Provider 可生成结构化 JSON；失败或使用 Mock 时由本地角色规则生成。

### 22.5 一起听歌

音乐由浏览器原生 `HTMLAudioElement` 播放。网络音频地址可持久化，本地文件使用临时 Object URL，只在当前浏览器会话有效。角色陪听反应作为 `type: music` 的普通角色消息写入消息表。

### 22.6 请求取消与降级

`ChatRequest` 支持 `AbortSignal`。用户点击停止后中断网络请求、Mock 等待或多气泡间隔。在线 Provider 失败时是否降级由全局模型设置和当前会话 `autoFallback` 共同决定。

---

## V0.3.1 交互层补充

### 消息扩展

`Message` 支持：

- `type: 'image'`
- `imageDataUrl`
- `imageName`
- `replyTo` 引用消息快照

引用使用快照而不是运行时关联查询，即使原消息被删除，已发送的引用气泡仍能显示当时的发送者与摘要。

### 图片保存策略

图片选择后在浏览器端缩放到最长边不超过 1440 像素，并在需要时压缩为 JPEG。压缩结果以 Data URL 写入 IndexedDB，适合当前本地原型；未来大量图片场景应迁移到 Blob 表或对象存储。

### 视口与键盘

`PhoneFrame` 监听 `window.visualViewport`，将可视高度写入 `--app-viewport-height`。手机软键盘出现时，手机外框和聊天区域使用新的可视高度重新布局，减少输入框被遮挡或页面整体跳动。

### 底部面板手势

面板顶部拖动条使用 Pointer Events 和 pointer capture。向下位移超过阈值时关闭，未超过阈值时回弹。面板内容区域仍保持独立滚动。


## V0.3.2 多模态与消息可靠性补充

### 多模态消息类型

Provider 的 `ChatTurn.content` 从单一字符串扩展为：

```ts
string | Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
>
```

聊天页只在回复当前图片消息时把该图片的 Data URL 放入请求。历史图片使用文字摘要，避免每轮对话重复上传全部图片。

### 图片能力状态

`ModelSettings` 新增：

- `visionMode`: `auto | enabled | disabled`
- `visionSupported`
- `visionTestedSignature`
- `visionTestedAt`

能力签名由供应商、标准化 API 地址和模型名称组成。切换其中任意一项后，旧检测结果自动失效。

自动模式流程：

1. 首次图片消息按多模态格式发送。
2. 成功后缓存“支持图片”。
3. 若接口返回图片内容类型不兼容错误，立即用文字消息重试。
4. 文字重试成功后缓存“不支持图片”。
5. 后续图片直接使用自然兜底，避免重复失败。

### 图片处理

`imageService.ts` 负责：

- 文件类型与 15 MB 上限检查
- 最长边缩放到 1280 像素
- 大图转 JPEG
- 逐步降低质量直到接近 900 KB 目标
- 计算 Data URL 近似字节数

处理结果保存图片宽高、压缩后体积和原始体积，聊天消息保存其中与展示、备份有关的字段。

### 消息状态

用户消息写入时状态为 `pending`。角色回复完成后改为 `read`；请求失败改为 `failed`；主动停止改为 `cancelled`。失败和停止消息可以复用原消息重新请求，不会重复插入用户气泡。

### 图片隐私

第一次打开图片选择器时使用本地一次性确认。确认状态只保存在 `localStorage`，不会进入备份。图片仍由当前配置的第三方模型服务处理，应用不承诺第三方服务的数据保留策略。

### 备份 V4

V4 继续使用 JSON，但导出函数接受 `includeImages`。关闭时保留图片消息、文件名与附言，移除 `imageDataUrl` 和图片体积。恢复后聊天页会显示“图片未包含在这份备份中”。


## V0.3.3 流式回复架构

### Provider 增量接口

`ModelProvider` 在普通 `chat()` 之外新增：

```ts
chatStream(
  request: ChatRequest,
  handlers?: {
    onDelta?: (chunk: {
      delta: string
      text: string
    }) => void | Promise<void>
  }
): Promise<ChatResponse>
```

`delta` 是当前新增片段，`text` 是截至当前的完整文本。聊天页不直接解析供应商协议，只消费统一增量事件。

### OpenAI 兼容 SSE

`OpenAICompatibleProvider` 发送 `stream: true`，并处理：

- `Content-Type: text/event-stream`
- `data: { ... }` 事件
- `data: [DONE]`
- `choices[0].delta.content`
- 兼容文本数组内容

若兼容接口忽略流式参数并返回 `application/json`，Provider 会提取完整消息并以一次增量事件交给界面，因此不会破坏原有接口兼容性。

### 临时消息生命周期

ChatRoom 仅在收到第一段有效文字后创建临时角色消息：

1. 第一段到达：写入 `pending` 角色消息。
2. 后续片段：更新 Vue 响应式消息。
3. 每约 140 毫秒：节流同步到 Dexie。
4. 生成完成：标记 `delivered`，必要时按多气泡规则拆分。
5. 用户停止：保留现有文字并标记 `cancelled`。
6. 中途失败：保留现有文字并标记 `failed`。

没有收到任何文字就失败时，仍沿用用户消息的失败与重试流程。

### 滚动策略

增量更新期间使用 `requestAnimationFrame` 合并滚动请求。只有用户仍处于最新消息附近时才自动跟随；用户主动上滑后，界面保留当前位置并显示“回到最新消息”按钮。

### 异常恢复

重新加载会话时会检查遗留的 `pending` 消息：

- 有内容的用户或角色消息恢复为 `cancelled`。
- 没有内容的临时角色消息直接清理。

这样浏览器刷新或意外关闭后不会永久显示“发送中”。

### 聊天组件边界

V0.3.3 新增：

- `ChatMessageItem.vue`：消息行、头像、图片、引用、状态与流式光标。
- `ChatComposer.vue`：输入框、图片选择、语音入口、图片预览、引用预览和发送控制。
- `ChatHeader.vue`：返回、角色状态入口、一起听歌和聊天设置入口。
- `ChatMessageList.vue`：消息遍历、输入状态、空状态与滚动容器。
- `ChatSettingsPanel.vue`：聊天、记忆、语音和高级设置。
- `ChatActionSheet.vue`：消息回复、复制、保存、重试、重新生成和删除。
- `ChatImagePreview.vue`：聊天图片全屏预览。

`ChatRoom.vue` 继续作为会话编排层，负责 Provider、记忆、关系、语音、音乐和请求生命周期。后续版本可继续拆分心理活动、音乐面板与 composables，而不改变消息组件接口。



---

## V0.3.6 多图消息与聊天逻辑解耦

### 新增组件和 composables

- `ChatThoughtPanel.vue`：角色心理活动、关系阶段和刷新入口。
- `ChatMusicPanel.vue`：歌曲资料、音频元素、进度和陪听反应。
- `useChatSpeech.ts`：语音识别、角色音色、语速、暂停和停止。
- `useChatScroll.ts`：消息滚动、位置恢复和回到最新消息。
- `useBottomPanel.ts`：底部面板下滑关闭。

### 多图消息兼容策略

`Message.images` 保存多张图片的 Data URL、名称、尺寸和体积。旧版的 `imageDataUrl`、`imageName` 等字段继续保留，读取时由 `messageImageService.ts` 统一转换为图片数组，因此已有单图聊天记录无需迁移。一次消息最多选择 6 张图片，Provider 请求会在同一条用户消息中依次加入多个 `image_url` part。

备份格式版本保持 V4。导出时关闭图片会同时清除旧单图字段和 `images[].dataUrl`；备份摘要按实际图片张数和总体积统计。Dexie 仍为 V5，因为新增字段不需要新索引。


## V0.3.8 图片处理管线

图片选择后不再并发创建多个 Canvas，而是进入串行队列：

```text
File
→ 类型与 15 MB 限制检查
→ ImageBitmap 解码
→ HTMLImageElement 解码兜底
→ 按设备内存计算 1080 / 1280 / 1440 最长边
→ 优先 JPEG，失败后尝试 WebP
→ 编码失败切换格式
→ 安全格式保留原图兜底
→ 释放 ImageBitmap、Object URL 与 Canvas
```

待发送阶段同时保留 `sourceFile`，因此用户可对单张图片重新处理或改用原图；消息写入 IndexedDB 时只保存处理结果和元数据，不保存临时 `File` 对象。


---

## V0.4.0 角色卡与沉浸 Prompt 架构

### 数据层

Dexie V6 新增：

```text
personas
lorebookEntries
```

`Character` 在不改变主键和索引的情况下扩展角色卡 V2 字段；`Message` 通过可选 `alternatives` 和 `activeAlternativeIndex` 保存候选回复。旧记录读取时由服务层补默认值。

### Prompt 编排

`promptComposer.ts` 是唯一的沉浸系统提示词入口：

```text
characterCardService
personaService
relationshipService
memoryService / conversation summary
lorebookService
visual input metadata
→ promptComposer
→ Provider
```

视觉消息保留为 OpenAI 兼容多模态内容，但文字指令只要求内部观察。最终输出受角色卡、关系和自然度规则约束。

### 聊天分支与候选

候选回复保存在原 `Message` 上，不创建重复消息；切换时同步更新 `content`。聊天分支会复制所选消息及之前的历史，并重新映射消息 ID 和引用关系，然后继承聊天设置。

### 兼容策略

- 旧角色缺失 V2 字段时使用自然默认值。
- 旧聊天设置缺失角色扮演字段时自动补齐。
- 旧备份不含 Persona 和世界书时按空数组恢复，并在首次使用时创建默认 Persona。


---

# V0.4.1 角色互动与调试架构

## 互动输出链路

```text
Provider 原始输出
  ↓
流式可见文本过滤 visibleStreamingText()
  ↓
parseCompanionOutput()
  ├─ text / emoji / voice 动作消息
  ├─ mood / activity / location / relationshipNote / innerThought
  └─ 解析警告与动作摘要
  ↓
消息节奏调度 saveAssistantActions()
  ↓
Dexie messages + conversationStates + characters
  ↓
ChatMessageItem / ChatThoughtPanel
```

模型不输出协议时，解析器把纯文本转换为普通 `text` 动作，确保旧模型和普通 OpenAI 兼容接口继续可用。

## Prompt 调试链路

```text
角色卡 + Persona + 关系 + 相关记忆 + 世界书 + 历史 + 视觉规则
  ↓
composeRoleplaySystemPrompt()
  ↓
savePromptDebugTrace()
  ↓
Provider
  ↓
原始输出 / 可见输出 / 动作摘要 / 自然度警告
  ↓
PromptDebugView
```

调试追踪保存在 `promptDebugTraces` 表，每个聊天最多 20 条，不写入备份。

## 角色资源兼容

`characterCardImportService.ts` 负责 SillyTavern V2 / V3 JSON 主要字段映射。内部仍统一转换成项目自己的 `Character`，避免聊天链路直接依赖外部卡格式。

## 数据版本

```text
Dexie：V7
Backup：V6
新增表：promptDebugTraces
```


---

## V0.4.2 长期记忆与主动陪伴架构

### 记忆写入与检索

```text
用户消息
→ extractMemoryCandidates
→ 相似度去重 / 合并
→ 单值主题冲突检测
→ memories（六层结构）

本轮消息 + 未完话题
→ selectMemoryHitsDetailed
→ 关键词、重要度、层级、锁定、日期与冲突评分
→ buildMemoryPrompt
→ Prompt Composer
```

角色状态中的关系感受和内心想法可作为“角色主观记忆”保存，和客观事实分开。

### 状态协议 V2

```text
companion_packet.status
→ parseCompanionOutput
→ mergeStatusIntoConversationState
→ conversationStates
→ recordConversationStateChanges
→ conversationStateHistory
```

状态字段只用于后续上下文和自然 UI，不直接显示 JSON。

### 主动消息

```text
打开聊天
→ 检查安静时段 / 最短间隔 / 频率 / 关系阶段
→ 承诺到期 > 未完话题 > 关心状态 > 剧情事件 > 分享日常
→ 去重
→ 写入带 proactiveSource 的普通角色消息
```

主动消息当前仍是“打开应用时检查”，尚未使用后台推送。

### 调试链路

```text
最终 Prompt
→ analyzePromptSections / buildTruncationNotes
→ 世界书触发原因 + 记忆命中原因
→ 原始模型输出 / 互动协议解析
→ 自然度规则评分
→ promptDebugTraces（最多 20 条，不进入备份）
```

### 数据版本

- Dexie V8：新增 `conversationStateHistory`，扩展 memories/messages 索引。
- Backup V7：加入状态变化历史，继续兼容 V1～V6。


---

## V0.4.2.1 场景距离双模式消息架构

### 表现模式

```text
ChatSettings.presenceMode = auto | together | remote
ConversationState.presence = together | remote
        ↓
resolvePresenceMode()
        ↓
shapeCompanionActions()
   ├─ together：scene_action → （动作）+ dialogue → 同一 text 消息
   └─ remote：scene_action → 独立 action 消息；dialogue → 多条 text 消息
```

`actionVisibility` 控制玩家是否看到场景动作：`always / together / off`。远程 Action 是玩家可见的角色侧写，不等价于角色通过手机发送的文字；`typing_pause / recall_message / react_to_message` 等仍属于手机行为。

### 消息落库

同一轮角色回复共享 `replyGroupId`，分开的消息记录使用 `replySequence` 保持顺序。`Message.type = action` 用于独立场景动作，普通对白仍为 `text`。旧消息没有这些字段时按旧格式正常渲染。

### 记忆纠偏

```text
明确记忆消息
→ stripMemoryCommand
→ 未来事件识别 / reminder 拆分
→ fact + 可选 promise
→ subject 稳定化
→ 重复合并或正反冲突
→ buildMemoryWriteNotice
→ Prompt Composer
```

“下周X”按下一自然周计算。冲突记录不直接同时作为事实注入 Prompt，而由记忆管理页确认。

### 数据版本

- Dexie：V8（不变）
- Backup：V7（不变）
- 新增字段均为可选字段或设置默认值，不需要 schema 迁移。


## V0.4.2.4 Persona 资源兼容架构

- `personaImportService.ts` 负责资源类型识别、Persona 字段映射、文本编码兼容、未知字段保真和导出。
- Persona 导入先识别 `persona / character-card / world-book / preset / regex`，避免不同社区资源串类型。
- Character Card 转 Persona 是显式转换：保留描述、性格、场景和原始扩展，但不把角色开场白/系统提示直接注入用户身份。
- Persona 结构化字段与 `description`/`extraFields` 分离：结构化字段服务于 Prompt 分层，原始内容服务于迁移保真。
- `buildPersonaPrompt()` 只把明确填写的用户事实作为事实；未提供字段保持未知。
- IndexedDB 仍为 V8，因为 Dexie 对新增可选对象字段无需新建表或索引。


## V0.4.2.5 创建期角色卡导入
CharacterCreate 直接调用 characterCardImportService；角色基础与高级字段在创建事务中一次落库，Character Card 内嵌 character_book 转换为带 characterId 的 LorebookEntry。无需建立临时空角色。


## V0.4.2.8 角色卡内嵌用户模板

`Character.embeddedUserTemplate` 保存从 Tavo / SillyTavern `description` 中检测到的独立 `{{user}}` 段。
当用户选择使用原卡用户模板时，会创建一条 `UserPersona`：

```text
personaScope = character
boundCharacterId = Character.id
boundCharacterName = Character.name
sourceUserTemplate = 原始 {{user}} 文本
isCardTemplate = true
```

新建角色时，同时把 `ChatSettings.personaId` 指向该 Persona。因此角色卡作者预设的用户身份只在当前角色私聊生效，不会成为全局默认，也不会污染其他角色。


## V0.4.3 社区资源兼容运行时

资源关系不再写死在角色或 ChatRoom 中：

```text
Character
  └─ ResourceBinding
       ├─ LorebookResource -> LorebookEntry[]
       ├─ PromptPreset -> PromptPresetPrompt[]
       └─ RegexScript
```

聊天运行顺序：

```text
角色 / Persona / 记忆 / 状态
        ↓
绑定世界书扫描
        ↓
World Info Regex
        ↓
Prompt Preset 编排
        ↓
Prompt-only Regex
        ↓
模型请求（User Input Regex 作用于用户历史）
        ↓
模型原始输出
        ↓
AI Response Regex
        ↓
结构化消息 / Safe Rich HTML
        ↓
IndexedDB（Rich 消息同时保留 rawContent）
```

`SafeRichHtml.vue` 使用 Shadow DOM 做样式隔离，并剔除可执行脚本与事件属性。资源兼容优先“保留原数据 + 安全降级”，不执行任意第三方 JavaScript。

## V0.4.3.1 社区资源无损归档与作用域

社区资源现在采用“双层保存”模型：

```text
原始资源 CommunityResourceArchive
        │
        ├─ rawText / rawJson
        ├─ 来源文件与识别格式
        └─ 持久兼容报告
                │
                ▼
标准化运行资源
  Lorebook / Preset / Regex
                │
                ▼
ResourceBinding
  global / character / conversation / persona
```

### 无损原则

解析器只负责生成当前版本能执行的 normalized resource；原文件另外保存在 `communityResourceArchives`。因此未知 `extensions`、社区自定义字段或尚未实现的 Theme 数据不会因为一次导入而永久丢失。

### 作用域优先级

运行时绑定优先级为：

```text
conversation > persona > character > global
```

V0.4.3.1 的世界中心 UI 先开放 `global / character`，后端接口已经能解析 conversation / persona 作用域，为后续聊天级和 Persona 级资源绑定保留升级路径。

### Preset 冲突

同一作用域一次只启用一套 Preset；运行时同时出现多个层级时，优先使用更具体的绑定，因此角色专属 Preset 会优先于全局 Preset。

### 安全边界

Theme、未知 JSON 与未知文本可以归档，但不会直接执行。第三方 Rich UI 仍只允许安全 HTML/CSS 子集，禁止任意 JavaScript 获得 App 数据权限。

---

## V0.4.4.1 · AI 内容权威层

```text
用户输入 / 角色卡资源 / 记忆 / 世界状态
                  ↓
            Prompt Composer
                  ↓
             真实 AI Provider
                  ↓
       完整性检查（Token / finish）
          ↓完整             ↓不足
 原卡协议解析 / Safe UI      硬停止 + 错误提示
          ↓                 不保存半截回复
       保存真实 AI 输出
```

边界：

- **AI / 原角色卡**负责角色台词、动作、心理、情绪、关系感受和剧情内容。
- **小手机 Runtime**只负责上下文编排、格式、宏、资源注入、协议解析、UI、安全过滤、状态持久化与错误处理；不提供角色化文案。
- Runtime 不得创建“看手机 / 想你 / 平静 / 查岗 / 本地角色回复”等角色化兜底。
- UI 修复如需改写内容，必须再次调用真实 AI；Token 不足时不得用程序拼接补齐。
- 旧本地关系积分不再作为角色事实源；V13 删除其 IndexedDB stores。

- `compatibilityMode=auto` 对社区卡和小手机原生角色统一解析为 `card-first`：默认保存/展示 AI 原始语义输出，不做小手机消息重塑；`phone-enhanced` 只允许用户显式选择。
- 角色回复完成后不再运行本地“事实纠偏/语义改写器”。除原卡明确 UI / Regex 结构校验外，应用不根据固定语义规则重写 AI 台词。
- HTTP 402、上下文窗口不足、额度不足、`finish_reason=length/max_tokens` 与无 finish reason 但输出打满上限都进入 Token 硬停止路径。
- 新会话主动消息默认关闭；刷新/崩溃/断线遗留的 pending assistant 不作为有效角色内容恢复，统一删除。
