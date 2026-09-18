# AI Companion Phone · 当前项目状态

更新于：**2026-09-17**  
当前版本：**V0.5.0-alpha.5.1.6**

```text
App：0.5.0-alpha.5.1.6
IndexedDB：V18
Backup：V12
测试定义：37 files / 308 it-test declarations
```

> 本文件只描述“现在”。历史版本请看 `CHANGELOG.md`、`RELEASE_HISTORY.md` 和 `releases/`。

## 1. 当前产品结构

### 空间桌面

桌面收敛为 6 个核心入口：

1. 知间
2. 我的资料
3. 记忆
4. 世界
5. 数据备份
6. 设置

日记、音乐、海龟汤等已有实现/历史路由继续保留，但当前不作为空间桌面主入口展示。桌面不再渲染重复 Dock。

### 知间

知间是统一社交 App，四个主标签：

```text
知间 | 通讯录 | 发现 | 我
```

- 知间：聊天列表；
- 通讯录：新建角色 + 联系人；
- 发现：当前只保留朋友圈；
- 我：个人资料、空间设置、钱包、设置。

四个主标签页左上角都能返回空间桌面。二级页按历史返回，无历史记录时兜底到空间桌面。

## 2. 本轮 alpha.5.1.6

### UI 收敛

- 移除发现页中暂不做的音乐、海龟汤、日记、扫一扫、看一看、搜一搜入口；
- 通讯录不展示标签、公众号、服务号；
- 「我」不再重复放朋友圈入口，改为「空间设置」；
- 聊天页右上角加入新建角色“＋”；
- 搜索文案改成“搜索聊天记录 / 搜索联系人”；
- 重做知间图标，避免双聊天气泡的微信相似感；
- 主屏按参考稿改成三列 × 两行的六核心入口布局。

### 空间设置

新增：

- 好友自主动态开关；
- 动态可见范围：公开 / 好友 / 仅自己；
- 谁可以看我的动态；
- 不让他看；
- 黑名单。

其中：

- 单角色可见性复用 `CharacterSocialProfile.canViewMoments`；
- 黑名单与整体可见范围保存到 `appCustomizations` 的专用记录；
- 不升级数据库结构，因为这些字段不参与 Dexie 索引；
- Backup V12 已包含 `appCustomizations`，因此设置随现有备份保存。

### Social Runtime 权限闭环

- “仅自己”时，用户新动态不会排队角色自动评论/点赞；
- 黑名单角色不会进入 Social Candidate 选择；
- 黑名单角色不会被 Auto Activity 选为自主动态作者；
- 已经排队的 Social Activity 在执行前重新读取空间权限，失效则取消；
- 用户直接回复角色评论时也会检查“仅自己 / 黑名单”。

## 3. 当前核心 Runtime

### Generation Runtime

```text
Chat UI
  ↓
GenerationContextBuilder（冻结本轮 Context）
  ↓
Memory / WorldBook / Preset / Regex / Persona / Presence
  ↓
Prompt Compiler
  ↓
Provider Orchestrator
  ↓
Response Projection
  ↓
Persistence / State / Memory / Prompt Debug
```

原则：真实 Provider 失败时不由客户端伪造角色回复。

### Conversation Runtime

已覆盖：

- 删除消息的一致性清理；
- restart；
- rewind；
- branch；
- greeting / free opening；
- StateHistory 重放；
- reply reference 映射；
- Prompt Debug 与 automatic memory 派生数据失效。

### Community Runtime

Chat 是主要 Community Presentation Surface：

1. Regex Rich UI
2. WorldBook HTML contract
3. 作者 HTML
4. 结构化/纯文本
5. 本地气泡 fallback

未知第三方 JavaScript 不在普通聊天消息中执行。

### Memory

当前六层：

- fact
- subjective
- shared
- promise
- relationship
- story

同时区分 conversation scope 与 character scope。

### Social Runtime V2

朋友圈已有：

- 持久 `socialActivities` 队列；
- 按最近聊天、共享记忆、内容相关性、冷却、活跃度加权选参与者；
- 每角色查看/点赞/评论/接话/发动态权限；
- 评论/回复未读通知；
- App 恢复后补执行中断队列；
- 本轮新增整体可见范围与黑名单闭环。

## 4. 当前最大工程热点

### ChatRoom.vue

Generation Runtime 已拆出关键服务，但 `ChatRoom.vue` 仍然偏大，依旧是下一阶段最需要继续减负的 View。后续新增 Agent Tool、群聊、更多 Community 协议时，不能继续把编排逻辑堆回页面。

### Backup 校验

项目已依赖 `zod`，但 Backup V12 仍缺少完整结构 Schema + 引用完整性验证。后续应完成：

```text
parse
→ schema validation
→ version migration
→ reference validation
→ transaction import
```

### 文档漂移

本轮已把根目录逐版本文档统一归档到 `docs/releases/`，并重写当前状态入口。后续继续以“源码 + PROJECT_STATUS + 当前 Release Manifest”为当前事实源。

## 5. 同类项目研究后的长期方向

详见 `research/REFERENCE_STUDY_SMALL_PHONES_2026-09-17.md`。优先方向：

1. Memory Retrieval V2：importance / decay / access / provenance / score；
2. Unified Agent Activity Runtime：把主动消息、朋友圈、群聊等逐步统一调度；
3. Capability / Tool Runtime：AI 只能提交结构化动作建议，由 App 校验权限并执行；
4. Interactive Capsule Sandbox：如需兼容可执行 HTML，必须与普通 RichMessage 隔离；
5. Context Compiler Inspector：可视化每轮到底注入了哪些记忆、世界书、Preset、Persona 和状态。

## 6. 验证状态

- 全局 TypeScript CLI `tsc --noEmit`：本轮执行无报错；
- 当前交付容器没有完整 `node_modules`，`npm test` 报 `vitest: not found`；
- `npm ci` 在当前容器尝试安装依赖时超时；
- 因此本轮**没有宣称 Vitest / vue-tsc / Vite Build 已通过**。

正式发布门禁仍是：

```powershell
npm ci
npm run verify
```

只有 Windows / CI 完整通过后才部署。
