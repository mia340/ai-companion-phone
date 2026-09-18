# AI Companion Phone · 当前项目状态

更新于：**2026-09-18**  
当前版本：**V0.5.0-alpha.5.1.9**

```text
App：0.5.0-alpha.5.1.9
IndexedDB：V18
Backup：V12
测试定义：38 files / 316 it-test declarations
```

> 本文件只描述“现在”。历史版本请看 `CHANGELOG.md`、`RELEASE_HISTORY.md` 和 `releases/`。

## 0. 本轮 alpha.5.1.9 重点

- **Launcher Runtime V3**：主屏外层和单页纵向 scroll layer 都被锁定，针对真机截图中的左侧竖白线做第二轮根因修正；底部横向 Home Indicator 保留。
- **编辑态坐标稳定**：编辑菜单作为 overlay，不再用 226px padding 把 Widget / App / Dock 整体向下推。
- **持久分页**：新增 `homePageKeys[][]`，旧 `homeAppKeys[]` 自动迁移；至少两页，跨页拖拽后目标页归属可持久化，页面编辑器可新增 / 删除页面。
- **音乐视觉统一**：桌面音乐 App 改成用户指定的单音符图标，「一起听」Widget 直接复用同一 AppIcon。
- alpha.5.1.8 的 Character Card Security Boundary、WorldBook compatibility 与 Memory Retrieval V2 继续保留。

## 1. 当前产品结构

### 空间桌面

主屏重新按真实手机组织：

- 四列 App 网格；默认显示音乐、海龟汤、我的资料、记忆、数据备份；
- 四格 Dock；默认显示知间、新建角色、世界、设置；
- 可选小组件：今天、最近的人、世界状态、一起听；
- 长按空白处进入编辑态，可添加小组件、自定义、编辑墙纸和编辑页面；
- 玩家可在「桌面与小组件」里选择桌面 App、Dock、Widget、壁纸、自定义图标、图标大小与 App 名称。

这些布局偏好全部复用 `appCustomizations` 的非索引字段，不升级 Dexie schema；Backup V12 已包含该表，因此会随备份保存。

### 知间

知间仍是统一社交 App，四个主标签：

```text
知间 | 通讯录 | 发现 | 我
```

- 知间：聊天列表；
- 通讯录：新建角色 + 联系人；
- 发现：当前只保留朋友圈；
- 我：个人资料、空间设置、钱包、设置。

### 独立 Native App

- 音乐：恢复为空间桌面一级入口，仍使用既有 `MusicAppView` / Music Companion Runtime。
- 海龟汤：恢复为空间桌面一级入口，仍使用既有 `TurtleSoupView` / Host Runtime。
- 这两个入口从桌面消失只是 alpha.5.1.6 的信息架构收敛问题，不代表功能删除。

## 2. 本轮 alpha.5.1.7

### 真实手机桌面

- 恢复底部 4 格 Dock；
- 恢复音乐 / 海龟汤；
- 主屏改回四列 App 网格；
- 删除桌面说明提示词；
- 增加页面圆点与更接近移动系统的半透明 Dock。

### 长按编辑态

长按空白处不再直接跳设置，而是先进入桌面编辑态：

```text
添加小组件
自定义
编辑墙纸
编辑页面
完成
```

编辑态可以：

- 从主屏移除 App 入口；
- 从 Dock 移除入口；
- 添加/移除小组件；
- 打开页面布局表，把任意可用 App 放到桌面或 Dock；
- Dock 最多 4 个。

### 小组件与玩家设计

当前 4 类 Widget：

1. 今天：日期、时间、问候、世界状态；
2. 最近的人：最近互动角色快捷入口；
3. 世界状态：当前世界名与事件状态；
4. 一起听：音乐陪伴快捷入口。

Widget 支持通透 / 毛玻璃 / 实色三种材质；后续可继续扩展照片、倒计时、纪念日、角色状态、日程等，而无需再改 Launcher 数据结构。

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

- 本轮修改的 TypeScript 与 Vue `<script setup lang="ts">` 已用 TypeScript 5.8.3 `transpileModule` 做语法检查：通过；
- 当前容器无法从离线 npm cache 取得 `zod@3.25.76`，因此无法组成完整 `node_modules`；
- 因此本轮**没有宣称 Vitest / vue-tsc / Vite Build 已通过**。

正式发布门禁仍是：

```powershell
npm ci
npm run verify
```

只有 Windows / CI 完整通过后才部署。
