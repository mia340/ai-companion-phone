# SullyOS·糯米机深度研究记录（2026-09-18）

> 研究目的：把 SullyOS 作为“浏览器虚拟手机 + 角色运行时”的完整工程样本，而不只参考 UI。本文记录其公开仓库中可验证的做法、与 AI Companion Phone 的差异，以及我们在 **V0.5.0-alpha.5.1.8** 中独立实现的吸收项。
>
> 重要边界：SullyOS 使用 **PolyForm Noncommercial License 1.0.0**。本项目只学习公开架构思想、交互模式与兼容语义，重新在 Vue / Dexie 架构中实现；不复制 SullyOS 的源码、角色、美术、文案或专有后端配置。

## 1. 一手来源

- 官方仓库：`https://github.com/qegj567-cloud/SullyOS`
- Launcher：`apps/Launcher.tsx`
- Character Card 分享边界：`utils/characterCard.ts`
- WorldBook 类型：`types.ts` 中 `WorldbookEntryConfig`
- 官方 README：ContextBuilder、local-first、主动消息 2.0、数据流说明
- License：仓库根目录 `LICENSE`

辅助对照：

- Character Card V2 规范：`https://github.com/malfoyslastname/character-card-spec-v2`
- AetherOS（SullyOS 衍生项目）公开 README 中的 V2/V3/PNG + 内嵌世界书导入说明只作为“生态实践”参考，不能反推成 SullyOS 上游事实。

## 2. Launcher：从“功能面板”升级成真正的桌面运行时

SullyOS 的桌面不是固定九宫格。其 Launcher 公开实现包含：

- App / Dock / Widget 分别维护顺序；
- 约 520ms 长按进入整理态；
- 拖拽时创建独立 drag ghost，不让原节点跟着布局抖动；
- 拖到屏幕左右边缘后延时翻页，支持跨页整理；
- Dock 与普通桌面 App 独立排序；
- 排序结果持久化到主题 / 外观状态；
- 自定义主题可以改变整个 Launcher 的布局，而不是只改颜色。

### 我们 V0.5.0-alpha.5.1.8 的独立实现

本轮把 alpha.5.1.7 的“可选 App + Dock”继续升级：

```text
HomeAppearancePreferences
  ├─ homeAppKeys[]
  ├─ dockAppKeys[]
  ├─ homeWidgetKeys[]
  ├─ wallpaper / icon / widgetStyle
  └─ Launcher Runtime
       ├─ 多页分页
       ├─ 长按 App 进入整理态
       ├─ 拖拽排序
       ├─ 桌面 <-> Dock 移动
       ├─ Dock 满 4 格时交换
       └─ 边缘停留跨页
```

桌面滚动责任也收敛：Launcher 自己横向分页，桌面层隐藏滚动条，不再泄漏浏览器竖向 scrollbar。手机底部真正的 Home Indicator 仍由 Phone Shell 保留。

### 后续

当前仍是顺序驱动的四列网格。后续应升级为正式 `HomeLayoutSchema`，让每页保存 App / Widget / Spacer / Decoration 的位置与 span，才能支持 2×2、4×2 Widget、照片块、自由留白和主题模板，而不是不断给 `homeAppKeys[]` 打补丁。

## 3. Character Card：分享资源与“发送者本地状态”必须分离

SullyOS 的 `utils/characterCard.ts` 明确把角色卡定位为“分享角色本身”，导入和导出都剥离：

- API / embedding / emotion / proactive 等可能携带凭据的配置；
- 发送者的主题、气泡、聊天 CSS、背景、提示音、思考链样式；
- 语音语言与播放偏好、分组 ID；
- buff、Memory Palace injection、phoneState、VR / dream / room 等运行时残留。

这个思想比“格式兼容”更重要：**角色资产、用户秘密、Presentation 偏好、运行时存档不是同一类数据。**

### 我们原有优势

AI Companion Phone 已经具备：

- Character Card V2 / V3 JSON 与 PNG 导入；
- `creator_notes` 只用于展示，不错误注入 Prompt；
- V2/V3 `system_prompt` override、`{{original}}`、post-history、alternate greetings；
- unknown extension 尽量保留；
- 原始社区资源有独立 Resource Archive，可追溯原文件；
- Character 与 Conversation 生命周期分离。

### V0.5.0-alpha.5.1.8 新增：Character Card Security Boundary

新增 `characterCardSecurity.ts`：

```text
原始社区文件
   ├─ Raw Resource Archive        # 原样留存，用于兼容/取证
   └─ Working Card Model
          ↓ recursive sanitize
      角色语义 / 世界书 / 安全扩展
          ↓
      Character Runtime

再次分享
Working / raw-derived export payload
          ↓ recursive sanitize
      Shareable Character Card
```

与 SullyOS 的公开浅层剥离不同，我们这里做递归白名单边界：嵌套 extension / lorebook / raw metadata 中出现的凭据、发送者 UI、本地 runtime 字段也会被剥离；同时不会删除标准 `token_budget` 等合法 Character Book 字段。

安全边界双向执行：

- **import**：进入工作模型前净化；
- **export**：生成可分享文件前再次净化。

原始文件仍可在 Resource Archive 中保留，因此“安全运行”和“无损取证/未来兼容”不互相冲突。

## 4. WorldBook / 世界书：学习其字段兼容，但保留我们更强的 Runtime

SullyOS 当前公开 `WorldbookEntryConfig` 支持：

```text
key / keysecondary
constant / selective / selectiveLogic
order / position / disable
probability / useProbability
depth / role / scanDepth
caseSensitive / matchWholeWords
sourceUid
```

这些字段与 SillyTavern / Character Book 生态高度相关。

### 我们 V0.5.0-alpha.5.1.8 的兼容补齐

`resourceImportService` 新增 SullyOS-shaped 世界书回归样本：

- `title` 可作为条目标题；
- `sourceUid` 可作为来源 ID fallback，并保存在 raw extension 中用于 round-trip；
- `disable: true` 保持禁用，绝不因导入被偷偷打开；
- secondary key、selective logic、probability、depth role、scan depth、大小写、整词匹配完整映射；
- 不认识的 extension 继续保留。

### 我们已有 WorldBook Engine V2 不应退化

当前项目已经支持的能力包括：

- character / global WorldBook 绑定；
- 关键词、常驻、secondary / selective logic；
- recursion；
- sticky / cooldown / delay；
- group / group scoring；
- probability；
- token budget；
- before / after character、author note、example、`@depth` 等 injection position；
- timed activation state；
- unknown extension round-trip。

所以这里的原则不是“换成 SullyOS 世界书”，而是：**继续扩大输入兼容面，同时保持单一内部语义模型和更强的确定性执行器。**

## 5. ContextBuilder：对我们 GenerationContext 路线的再次验证

SullyOS README 明确把角色基础设定、用户档案、精炼长期记忆、角色对用户的印象、挂载世界书统一交给 `ContextBuilder.buildCoreContext()`；最近聊天则继续作为普通 message history。

这个方向与 AI Companion Phone 当前的 Generation Runtime 一致：

```text
Chat / Native Surface
   ↓
GenerationContextBuilder
   ├─ Character / Persona
   ├─ Memory retrieval
   ├─ WorldBook
   ├─ Preset / Regex
   ├─ Presence / scene
   └─ frozen generation snapshot
   ↓
Prompt Composer
   ↓
Provider
```

我们的额外约束是：每轮使用冻结 `GenerationContext` 和 `generationId`，避免生成途中 Vue reactive state 漂移；因此下一步不是新建第二套 ContextBuilder，而是继续把更多上下文源变成可解释、可预算、可 Debug 的 compiler stage。

### 后续建议：Context Inspector

Prompt Debug 应进一步展示：

- 哪些 Memory 被选中 / 为什么；
- 哪些 WorldBook 被激活 / 被预算裁掉；
- 各 section token / char budget；
- 哪些宏、Regex、Preset 生效；
- 最终 canonical messages 与 presentation projection 的差别。

## 6. Memory：从“有记忆”升级为可解释检索生命周期

SullyOS 把长期信息统一纳入 ContextBuilder，并单独建设“记忆宫殿”。这提醒我们：记忆的关键不是再增加一种分类，而是**检索、衰减、可信度和反馈**。

AI Companion Phone 已有六层 Memory：

```text
fact / subjective / shared / promise / relationship / story
```

以及 conversation / character scope、importance、confidence、lastHitAt、hitCount、source provenance、conflict 等字段。

### V0.5.0-alpha.5.1.8 新增：Memory Retrieval V2 第一批

检索评分开始真正使用现有生命周期元数据：

- `confidence` 进入排序，高置信事实适度加权，低置信适度降权；
- `hitCount` 以 `log2` 型 capped boost 反馈“过去确实有用”的记忆，避免热门记忆无限垄断；
- conflict penalty 保持高于 recall boost，确保已冲突 / 已失效信息不会因为曾多次召回而反超；
- Debug reason 会显示“高/低置信”“历史召回 N 次”。

后续仍需要：lastHitAt feedback、显式 decay policy、embedding / hybrid retrieval、source reliability、召回后是否被模型真正使用的反馈。

## 7. 主动消息与 Agent Action：副作用不能由模型直接改数据库

SullyOS 主动消息 2.0 的公开说明把能力分成两类：

1. 回忆、搜索、读数据等读取型工具，可以在生成侧执行；
2. 转账、日程、音乐、点赞等真实副作用只生成结构化 directive，最终由客户端统一后处理执行。

这与我们前期从 HiPhone / IB 得出的结论一致，也应成为后续统一 Agent Runtime 的底线：

```text
LLM proposes typed action
  ↓
Schema validation
  ↓
Capability / permission / visibility check
  ↓
App Runtime executes deterministic mutation
  ↓
ActionResult
  ↓
Memory / chat / debug propagation
```

不能回到“模型输出 `[发朋友圈]`，页面正则匹配后直接写 DB”的方式。

当前 `socialActivities` 已经是这个统一 Runtime 的雏形。下一阶段可抽象 `AgentActivity` / `AgentAction`，让朋友圈、群聊、日记、日历、音乐等复用调度、重试、幂等、权限与审计。

## 8. Backup / local-first

SullyOS 同样以 IndexedDB 为主，本地 ZIP、WebDAV / GitHub 等作为可选迁移渠道。对我们最重要的启发不是“再加一种云盘”，而是继续坚持：

- local-first；
- 备份格式有 schema version；
- 角色共享文件与整机备份严格分开；
- 不把 API credential 意外塞进角色卡；
- 以后云同步优先同步 operation / event，而非粗暴镜像整个 Dexie。

我们的 Backup V12 下一步仍应优先补 Zod schema、引用完整性检查与原子导入，再讨论云同步。

## 9. 本轮直接吸收 vs 暂不吸收

### 已在 V0.5.0-alpha.5.1.8 独立实现

1. Launcher 多页 / 拖拽 / Dock 交换 / 边缘翻页；
2. 删除桌面竖向 scrollbar 泄漏；
3. Character Card import/export 双向安全净化；
4. SullyOS-shaped WorldBook 字段回归；
5. Memory confidence + recall feedback 进入检索评分；
6. 以上均补静态单元测试定义。

### 下一阶段

1. 正式 `HomeLayoutSchema`（App / Widget / Decoration / span / position）；
2. Context Inspector；
3. `AgentAction` schema + Capability Registry；
4. 统一 `AgentActivity` scheduler；
5. Backup Zod / atomic validation；
6. Character Card / WorldBook import preview 增加“将导入什么、将忽略什么、将剥离什么”的可见报告；
7. WorldBook activation inspector 与 token budget 可视化；
8. Memory Retrieval V2 的 decay / embedding / feedback loop。

## 10. 明确不照搬的东西

- 不复制 SullyOS 源码片段、图标、美术、角色、文案、主题或后端地址；
- 不把发送者 API / UI / runtime 状态当角色卡内容；
- 不让第三方 HTML/JS 在聊天主 DOM 任意执行；
- 不因为别的项目功能多就把所有 App 塞进首页；
- 不新建第二套与现有 GenerationContext / WorldBook Engine / Memory 系统竞争的 Runtime。

学习目标始终是：**扩大兼容能力、强化边界、提升可解释性，并让现有架构变得更像一个真正的 Companion OS。**
