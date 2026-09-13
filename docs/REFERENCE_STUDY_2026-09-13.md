# 参考“小手机”项目学习记录 · 2026-09-13

> 目标：学习公开项目解决问题的方式，不直接复制第三方代码、素材、Prompt 或 UI。任何真正吸收到本项目的实现，都必须重新按本项目的 Runtime / 数据一致性 / 安全边界设计，并单独核对许可证。

## 一、对当前毕业设计最有价值的学习方向

### 1. StoryPhone / 叙事诗小手机

来源：https://github.com/Island-glitch/Poemnarapk

值得学习：

- 长周期记忆 + RAG 召回，而不是把所有历史直接塞进 Prompt。
- 主动消息作为独立调度能力，并在生成时重新编译角色、世界书与记忆上下文。
- Web PWA 与 Android 原生壳分层，原生桥只提供浏览器无法可靠完成的设备能力。
- Dexie / IndexedDB 本地优先路线与本项目高度兼容。

本项目吸收方式：

- V0.5 继续先把 Memory Retrieval 与 Generation Runtime 做稳定；不急着复制其大量 App。
- 原生桥、通知、定位、闹钟等归入 V0.6+ Capability Runtime，不侵入 Character / Conversation 核心。

### 2. AI Virtual Phone / FLOAT

来源：https://github.com/xiaolongbao0709/ai-virtual-phone

值得学习：

- 私聊、群聊、朋友圈、创作资源、游戏/自定义 App 形成统一虚拟手机生态。
- 自定义 App SDK / 应用市场思路说明“App Surface”可以扩展，但 Runtime 能力必须先稳定。
- 可选 Supabase 云能力与本地单机模式分离，云不是核心功能的前置条件。
- DOMPurify 等富文本安全处理证明第三方内容不能直接无边界执行。

本项目吸收方式：

- 保持本地优先；未来云同步作为可选层。
- 自定义 App 不在毕业前做完整市场，最多先定义 Capability / App Contract。
- Community UI 继续执行“静态 HTML/CSS 可兼容，未知 JS 不直接执行”。

### 3. InternalBeyond Mobile

来源：https://github.com/Sui-IB/InternalBeyond-Mobile

值得学习：

- AI 能力授权：日历、日志、播放器、文件等读写能力不是默认全部开放。
- Memory 与 Auto Memory 分离；核心记忆写入可要求用户确认。
- 多 API / 多角色各自配置与跨 App 连续关系。
- 手机专属展示配置与跨端共享业务数据分层。

本项目吸收方式：

- 未来新增 Calendar / Diary / Tool 时采用显式 Capability 权限：read / write / execute 分离。
- 高重要度自动记忆可考虑“候选 → 用户确认 → 持久化”，降低错误记忆污染。
- Phone UI 偏好继续留在本地 App 层，不写进角色世界事实。

### 4. Melt

来源：https://github.com/EvenNetR/Melt

值得学习：

- 主 API 负责角色对话，副 API 可负责记忆提取、情绪分析等后台任务。
- 同一 Vue/PWA 工程用不同 build mode 输出 lite / local / personal 版本。
- IndexedDB + PWA + 导入导出形成轻量本地优先闭环。

本项目吸收方式：

- Provider Runtime 后续可增加“主生成模型 / 辅助模型”角色，而不是所有任务都占用同一昂贵模型。
- Memory extraction、summary、classification 未来优先成为 auxiliary task，不改变聊天主链语义。

### 5. Miya 小手机

来源：https://github.com/lixooo00-lab/mingruis-miya

值得学习：

- Home 明确作为 Launcher；桌面美化集中管理；长按拖动、组件、壁纸符合真实手机心智。
- 非聊天模块按需加载，降低首屏开销。
- 本地数据导入导出和 PWA 使用说明较完整。

本项目吸收方式：

- alpha.4.1 已经采用“Home = Launcher / Appearance = 美化中心”的方向，继续保持。
- 新的大型 App 继续路由懒加载，不把所有功能塞进首屏 bundle。

### 6. HiPhone

来源：https://github.com/ssochi/hiphone

值得学习：

- Vite + TypeScript 项目把 test / lint / typecheck / production verification 明确做成脚本门禁。
- `docs/` 与架构/研究记录分开，工程过程本身可成为论文证据。

本项目吸收方式：

- 后续增加独立 `typecheck` / `verify` 脚本，避免只有 `npm run build` 才暴露类型错误。
- 每个版本保留测试数、Build 状态、数据库/备份版本与专项回归记录。

### 7. 汪汪机

来源：https://github.com/Liunian06/FlutterCppWangWangPhone

值得学习：

- UI 与核心业务层分离，把存储、AI Provider 等稳定能力放到核心层。
- 多 Provider 支持在架构层定义，而不是页面里分支判断。

本项目吸收方式：

- 不需要改成 Flutter/C++；借鉴的是“Runtime 与 UI 解耦”的原则。
- 继续削减 `ChatRoom.vue` 对数据库、Provider、Prompt、状态编排的直接职责。

## 二、轻量样本的价值

Love Boat、弯弯机、PiggyPhone、蓝椰/凛冬、Plume 等更适合作为产品交互和社区需求样本：它们证明用户非常重视低门槛部署、角色/面具、世界书、记忆、朋友圈、美化、群聊、长文模式和数据导入导出。

这些项目中的“大量功能集中在单个 HTML”适合快速原型，但不适合作为本毕设最终工程架构。我们的优势应该是：功能不一定最多，但 Runtime 边界、数据一致性、测试、迁移、论文可解释性更强。

## 三、对当前项目的优先级结论

毕业前建议顺序：

1. **先恢复全绿 Build**：测试与 `vue-tsc + vite build` 都必须绿。
2. **继续拆 ChatRoom**：Generation / Conversation / Presentation 进一步去页面编排化。
3. **Memory Retrieval 可解释化**：明确“存储、筛选、注入、冲突、失效”的生命周期，并可做实验。
4. **主动消息统一 Runtime**：Scheduler 只决定何时请求生成，角色内容仍走真实 Generation Context。
5. **Capability 权限模型**：为未来 Calendar / Diary / Music / Tool 留出统一接口，可作为论文扩展点。
6. **主/副模型任务分工**：对记忆提取、摘要、分类做低成本辅助模型支持，但不阻塞毕业版。
7. **App 扩张最后做**：只有能验证核心研究问题的 App 才进入毕业版本。

## 四、明确不照搬的内容

- 不复制第三方角色卡、Prompt、CSS、图标、品牌视觉或大段源码。
- 不执行第三方未知 `<script>` / inline JS。
- 不为了“功能看起来多”引入无法测试的后台循环与隐式状态。
- 不让朋友圈、音乐、日记等 App 各自重新实现一套角色记忆和 Provider 调用。
- 不把真实世界 Presence、通信渠道、UI 气泡样式混成一个状态。

## 五、毕设可形成的差异化表述

本项目最终不以“又一个 AI 小手机”作为创新点，而以以下系统问题为主：

- **多角色、多会话下的长期记忆归属与一致性**；
- **会话删除 / 回滚 / 分支时，AI 派生状态的事务一致性**；
- **Character Card / WorldBook / Regex 等社区资源的兼容 Runtime**；
- **Generation Context 冻结、Provider 解耦与可追踪生成链路**；
- **虚拟手机多 App 场景下，角色身份和世界状态的跨 Surface 连续性**；
- **本地优先数据模型、备份迁移与 PWA 部署**。

这些方向都已经在当前代码中有实际基础，可以继续做实验、测试指标和论文图表，而不是停留在概念层。
