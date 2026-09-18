# 同类“小手机”实现研究 · 2026-09-17

> 目的：把公开同类项目当成“实现样本库”，学习它们如何处理本地优先、角色运行时、Prompt、记忆、世界书、社交后台行为、AI 工具调用和真机能力。不是按功能数量照抄，也不把无法确认的在线行为当作源码事实。

## 样本来源

### GitHub / 代码仓库

- 汪汪机：`https://github.com/Liunian06/FlutterCppWangWangPhone`
- Love Boat / 小船机：`https://github.com/qingzhouu/love-boat`
- 弯弯机：`https://github.com/wanonewan/wanwan`
- 叙事诗小手机：`https://github.com/Island-glitch/Poemnarapk`
- FLOAT：`https://github.com/xiaolongbao0709/ai-virtual-phone`
- PiggyPhone：`https://github.com/lw0129-jj/PiggyPhone.JJ-STAR`
- HiPhone：`https://github.com/ssochi/hiphone`
- miya：`https://github.com/lixooo00-lab/mingruis-miya`
- InternalBeyond Mobile：`https://github.com/Sui-IB/InternalBeyond-Mobile`
- Melt：`https://github.com/EvenNetR/Melt`

### 在线部署 / 工具

- 小心机：`https://xiaoxinchat.jia.ruiyaxin.xyz/`
- 小心机备用：`https://ruiruiyaxin.pages.dev/`
- 凛冬机：`https://todleffleiermyronwym-web.github.io/zimaos/`
- 蓝椰机：`https://todleffleiermyronwym-web.github.io/zmlanye/`
- 文件预览：`https://todleffleiermyronwym-web.github.io/lanye/`
- Love Boat：`https://loveboat.pages.dev/`
- lav / mf机：`https://lavender-phone.pages.dev/`
- Plume：`https://rainmow52000.github.io/plume/`
- 手写卡辅助：`https://lucent-naiad-692171.netlify.app/`
- 代码辅助：`https://sparkly-halva-11dc2f.netlify.app/`
- 蓝椰备用：`https://heroic-wisp-712733.netlify.app/`
- Melt：`https://melt-eta.vercel.app`
- mf机：`https://ubiqpiroshki-0b62ca.netlify.app/index.html`

无法唯一还原：`three-days-no-sleep` 只有搜索关键词，不强行绑定到某个仓库。

## 观察到的主要架构路线

### 1. 原生客户端 / 核心层分离

汪汪机一类项目把 UI、AI Provider、SQLite/数据层拆开，说明“小手机”不一定只能做成一个超大网页。可吸收点是：**UI Surface 与 AI / 数据核心分层**，未来做 Android/桌面壳时不必重写角色运行时语义。

### 2. Web Runtime + 真机 Bridge

叙事诗小手机采用 WebView / JS Bridge / 本地能力连接的路线，能把定位、震动、闹钟、本地音乐等能力暴露给受控运行时。可吸收点不是直接执行任意 JS，而是：**Capability 白名单 + 明确的 Bridge**。

### 3. Local-first + 可选云

FLOAT 等样本说明，本地手机本身可以完整工作，云只承担社区、多人、离线推送、同步等可选能力。对本项目的启发：如果未来做云同步，应同步**事件 / operation / delta**，不要粗暴双向覆盖整个 Dexie。

### 4. AI 作为“有权限的系统成员”

InternalBeyond、HiPhone 等项目把 AI 行为转成结构化动作或工具，而不是让模型声称“已经执行”。这与本项目的 Native App 边界高度一致：**AI 决定语义动作，App 决定合法性并维护真实状态**。

### 5. 大型浏览器小手机

Miya、Plume、凛冬/蓝椰等项目展示了大量子 App、世界书、朋友圈、群聊、论坛、角色动态等组合形态。最值得学的不是继续堆入口，而是提前解决**Context Compiler、后台任务、权限、可见性、状态归属**。

## 对本项目的长期吸收方向

### A. Context Compiler / Inspector

现有 `GenerationContextBuilder` 路线继续保持：

```text
Source
  ↓
Selection
  ↓
Snapshot
  ↓
Compile
  ↓
Provider
  ↓
Projection / Persistence / Debug
```

避免重新回到 View 中现场拼 Prompt。

### B. Memory Retrieval V2

现有六层记忆先不继续加层，优先补生命周期字段与检索信号：

- importance / salience
- lastAccessedAt / accessCount
- confidence
- source provenance
- decay
- retrieval score
- 可选 embedding

### C. Unified Agent Activity Runtime

朋友圈已经有 `socialActivities`。后续主动消息、群聊发言、日记、日程等应逐步抽象成统一活动模型，而不是每个页面各写 timer。

建议长期目标：

```text
AgentActivity
├─ actor
├─ target
├─ kind
├─ trigger
├─ scheduledAt
├─ contextSnapshot
├─ permission
├─ status / attempts
├─ result
└─ causedBy
```

### D. Capability / Tool Runtime

未来“角色操作手机”应走：

```text
AI Action Proposal
  ↓
Schema Validation
  ↓
Capability / Permission Check
  ↓
Native Runtime
  ↓
Deterministic State Change
  ↓
Action Result 回到 AI Context
```

不要用正则扫描自然语言后直接写数据库。

### E. Interactive Capsule Sandbox

普通聊天 Rich UI 继续保持“不执行未知第三方 JS”。如果后续兼容 HTML 小游戏，另建独立 `sandbox iframe` / WebView Surface，只通过受限 `postMessage` / capability API 与主应用通信。

### F. Social Visibility / Knowledge Propagation

朋友圈不只是一个页面。长期需要明确：

- Actor
- Audience / Visibility
- Permission
- Knowledge propagation

角色看不到的动态，不应被错误写进其后续聊天知识。

## 本轮已经落实到代码的吸收

V0.5.0-alpha.5.1.6 先做低风险、可验证的两项：

1. **空间设置**：把自主动态、动态可见范围、单角色可见权限与黑名单集中到「我 → 空间设置」。
2. **Social Runtime 权限闭环**：黑名单角色不再被社交候选器选中；“仅自己”会阻止用户新动态排队角色自动互动；已经排队的活动执行前再次校验权限。

这两项属于“权限 / 可见性由 App Runtime 维护”，不会让模型自行决定系统状态。
