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
│   ├── Mock Provider
│   └── Error Handling
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
