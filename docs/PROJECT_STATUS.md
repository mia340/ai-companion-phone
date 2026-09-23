# AI Companion Phone · 当前项目状态

## 0.5.0-alpha.5.8.2 · Couple Board V2.2

- 心跳飞行棋改为固定 50/50 分屏：上半地图、下半互动，同一题期间页面结构不再展开/收起或遮住地图。
- 删除当前题“换一题”能力，也移除用 Memory 题覆盖当前题的入口；骰子落到哪题就围绕哪题互动。
- 新增双方跳过同意协议：用户题由角色决定是否同意跳过；角色题只有角色主动请求后才交给用户批准。
- 跳过请求进入 Interaction Ledger，可随续局恢复；现实身体互动仍可由任意一方随时拒绝或终止。
- Couple Board V2.2 release safety 新增固定分屏、禁止换题和 mutual skip-consent 守卫。


更新于：**2026-09-23**
当前版本：**V0.5.0-alpha.5.8.1**

```text
App：0.5.0-alpha.5.8.1
Launcher：Grid V13（HomeLayout revision 13）
IndexedDB：V18
Backup：V12
测试定义：70 files / 614 it-test declarations
```

> 本文件只描述“现在”。历史版本请看 `CHANGELOG.md`、`RELEASE_HISTORY.md` 和 `releases/`。

## 0. 本轮 alpha.5.8.1 重点 · 心跳飞行棋 V2.1 面对面互动修正

- **可拉伸互动面板**：题卡/对话 Bottom Sheet 支持上下拖动，三档停靠；默认只占中部高度，“看地图”可快速收起，顶部返回始终留在遮罩外。
- **面对面固定**：新开/续局/再来一局统一使用 `reality`；真实地点可以是房间、酒店或任何双方实际所在空间，Runtime 不擅自猜地点。
- **棋盘地点不是现实地点**：花店、公园、电影院、床边等只作为 Board Stop / 美术舞台传给模型与 Memory Bridge，禁止写成“现在在花店”等现实事实。
- **单题单归属**：谁掷骰子，题目就只属于谁；另一方在题目完成后按人设、Memory 与当前对话自然回应，不再出现双方各自回答/共同承担同一道题。
- **角色连续性成为主逻辑**：每次角色回应都重建 Character Context，合并角色卡稳定设定、当前 Conversation State、相关长期 Memory 与当前角色 Shared Timeline；游戏强度不能覆盖原人格，不再用“害羞/吃醋/反撩”固定反应池驱动角色。
- **单人题也变成双方互动**：题目只决定谁先开口。用户回答后角色必须按人设/记忆回应；角色先答时用户也必须回应。双方可以继续多轮自由对话，只有双方都真实说过话才允许结束并推进棋局。
- **角色可以自然收尾**：AI 返回 `endInteraction` 只表示角色认为当前段落自然收住；玩家仍可点“我还想继续”。游戏不再为了回合速度强行截断情侣互动。
- **Memory Bridge V1**：完成互动后，先把真实发生过的双方对话保存为 character-scope shared event，再在 AI 可用时提炼最多 4 条稳定偏好/关系信息；hypothetical/transient 内容硬丢弃，避免把题目假设写成现实。游戏新记忆之后可进入普通聊天检索和 Shared Timeline。
- **Memory evidence + OOC guard**：角色引用既往共同经历时必须返回当前允许的 Memory / `timeline:<id>`；伪造 evidence id 直接拒绝。候选回复随后再走一次 Role Continuity Audit；明显违背角色卡/边界/记忆时自动带理由重生成一次。
- **角色自己玩**：角色回合自动掷骰；骰子停止后按真实格数逐格移动，再触发地点内容，不需要用户替角色机械点击。
- **30 地点约会路线**：规则索引仍保持 0..29，但表现层重做成家门口、便利店、公园、夜市、电影院、河边、月光桥、天台、客厅、沙发边、阳台、床边等连续路线。
- **双视觉模式**：新增“像素约会 / 浪漫地图”。像素模式使用完整 CSS 小人（头/身体/手脚/阴影）在地图上逐格走，不再是头像圆点；视觉模式不改变棋局状态或 Memory。
- **恢复能力**：互动 ledger 按 gameId 持久化在 `appCustomizations`；刷新/继续上一局时可恢复尚未关闭的当前互动，而不是只恢复棋子位置。
- **数据层继续克制**：IndexedDB V18、Backup V12、Launcher Grid V13、HomeLayout revision 13、CoupleBoardPreferences V2、CoupleBoardArchive V1 均不升级；新增 CoupleBoard Interaction Ledger V1 复用 `appCustomizations`。
- **测试定义**：70 files / 614 declarations；5.8.1 在 5.8.0 已实跑 612/612 的基础上新增单题单归属回归；本版本完整结果仍以 Windows 双门禁为发布事实源。


## 0. 本轮 alpha.5.7.4 重点 · 心跳飞行棋 V1.4 题库 V3

- **新增 L5「私房」**：16 真心话 + 16 大冒险，专门覆盖性偏好、床上默契、前戏/节奏、主动与被动、性爱频率、成人情趣和事后陪伴。
- **L4 再升温**：成人档语言更直接，明确使用欲望、性爱、做爱、床上节奏等成年人日常会说的词，但不写成具体性行为步骤或教学。
- **大冒险更有身体互动**：L1-L5 的面对面大冒险都提高牵手、靠肩、拥抱、贴近、搂腰、亲吻等现实互动比例；聊天模式仍只抽可远程完成的题。
- **L4/L5 共用 18+ 门禁**：两档都必须显式确认双方成年；角色年龄明确小于 18 岁时两档都硬阻断。
- **题库 160 道 / 9 主题**：5 档 × 32 题；新增 `private/私房` 主题，内容中心和自定义题筛选支持 L5。
- **Schema 不变**：IndexedDB V18、Backup V12、Launcher Grid V13、HomeLayout revision 13 不升级；CoupleBoardPreferences 仍为 V2、Archive 仍为 V1。


## 0. 本轮 alpha.5.7.3 重点 · 心跳飞行棋 V1.3 题库 V2

- **128 道题整体重写**：保留 4 档 × 真心话/大冒险各 16 道的稳定结构，但语气改成更日常、更像情侣真的会问的内容，减少“关系问卷感”。
- **暧昧与成人档更直接**：L2/L3 增加吃醋、穿搭、接吻、拥抱、贴近等真实互动；L4 允许直接谈做爱、前戏、欲望、亲吻偏好和事后陪伴，不再每题重复正式的边界说明。
- **安全机制留在 Runtime**：18+ 门禁、未成年硬阻断、随时换题/跳过继续保留；物理互动题只在必要位置保留简短的“愿意/方便”提示。
- **8 个题目主题**：日常、回忆、小闹、暧昧、吃醋、心动、亲密、成人。内容中心直接显示主题。
- **防连续同味题**：抽题会避开最近 3 个同类型题 id，并优先避开最近 2 个主题；池子不足时自动降级，不会因为防重复把题库抽空。
- **Schema 不变**：主题字段仅为可选 prompt metadata；IndexedDB V18、Backup V12、Launcher Grid V13、HomeLayout revision 13 均不升级。

## 0. 本轮 alpha.5.7.2 重点 · 心跳飞行棋 V1.2.2 可玩性热修

- **角色可点击**：删除角色条自定义 pointer capture/drag/click suppression，改为原生横向滚动 + 箭头；点击选择永远先于滚动增强逻辑。
- **继续与骰子不再 DataCloneError**：游戏状态统一通过 `gameSchema.parse()` 深拷贝为普通快照，不再对 Vue Proxy 直接 `structuredClone`。
- **开局事务化**：先写 IndexedDB，再切到棋盘；保存失败则留在设置页并给出提示。
- **兼容旧 WebView**：角色定位不依赖 `CSS.escape`。
- **发布守卫**：source check 会阻止 Couple Board 恢复 pointer capture / suppress click / direct structuredClone。
- **Schema 不变**：IndexedDB V18、Backup V12、Launcher Grid V13、HomeLayout revision 13。

## 0. 本轮 alpha.5.7.1 重点 · 心跳飞行棋 V1.2.1 现场热修

- **占位页清理**：删除 `PlaceholderApp.vue` 与 `/app/:name` 泛路由；已完成 App 全部走真实页面，未知旧路由回桌面。
- **搭档横滑**：角色选择条支持触摸横滑、鼠标拖动和滚轮，4 位以上角色不再只能点到前三个。
- **内置题库扩容**：64 → 128 道；内容中心默认展示系统题，开局页直接显示可用题量。
- **骰子终止保证**：动画固定有限次；结算/保存与动画状态分开，异常也会 `finally` 解锁。
- **PWA 更新**：启动主动检查新 worker，并清理旧缓存，降低部署后刷新仍看到旧壳的概率。

- **情侣内容中心**：独立管理自定义题、系统题启停、自定义事件卡和系统事件启停；支持搜索/筛选、编辑删除和 JSON 导入导出。
- **事件牌组可编程**：自定义卡支持心动变化、交换位置与再掷一次；开局冻结牌组，局中编辑不改变正在进行的游戏。
- **情侣回忆册**：完成棋局自动归档最近 24 局，记录真实局内统计与 Heartbeat Highlights；只保存游戏记录，不自动提升为角色 Memory。
- **AI 出题 V2**：候选 evidence 扩展为 Memory + Shared Timeline；只接收当前角色的 memory/shared-event 事实投影，promise/goal/story 继续硬排除，模型返回 id 必须命中允许集合。
- **主动分享结算**：聊天模式可由用户主动把本局高光写入 ChatRoom 草稿；仍不自动发送，也不替用户/角色补写经历。
- **性能债**：编辑器、设置、备份、Memory 等次级路由进一步 lazy-load；首屏仅保留 Lock/Home/Chat shell eager。
- **Schema 不变**：IndexedDB V18、Backup V12、Launcher Grid V13 / HomeLayout revision 13；V2 偏好与回忆册继续复用 `appCustomizations`。
- **测试定义**：67 files / 597 declarations，Couple Board 直接相关 46 条。

## 0. 本轮 alpha.5.6.0 重点 · 心跳飞行棋 V1.1

- **自定义真心话 / 大冒险题库**：用户可按题型、强度和聊天/面对面模式保存本机题目；开局时把可用题库冻结进本局，避免中途编辑让存档语义漂移。
- **真实共同回忆出题**：挑战卡可主动调用已配置模型重新出题，但输入只允许来自当前真实单聊的 shared / relationship / event 证据；Runtime 强校验 evidence id、题型与模式，伪造 evidence 或改题型直接拒绝。
- **不把承诺冒充回忆**：`promise` 层不进入“共同回忆出题”证据池；subjective / story / conflict / invalid 同样排除。生成题只存在当前棋局，不写回 Memory，也不自动发送聊天。
- **情侣事件卡**：原“惊喜”格升级为独立 Event Card 状态；6 张事件卡只改变局内心动值，不制造关系事实，并可从旧存档安全恢复。
- **心动高光结算**：终局按真实局内记录生成 Heartbeat Highlights，包括总心动、完成挑战、真实回忆题、事件卡或被尊重的跳过边界，不让模型总结或评价关系好坏。
- **交互动效与任务卡 UI**：棋子落点、骰子翻转、事件卡浮动、任务卡来源标签、自定义题库编辑 Sheet 与 reduced-motion 兼容。
- **Schema 不变**：IndexedDB V18、Backup V12、Launcher Grid V13 / HomeLayout revision 13 均不变；偏好继续复用 `appCustomizations`。
- **测试定义**：新增 `coupleBoardMemoryPromptService.test.ts`，并扩充游戏 Runtime 回归，当前静态定义为 67 files / 580 declarations。当前环境依赖无法完整安装，因此正式通过仍以 Windows / CI 双 `npm run verify` 为最终门禁。


## 0. 本轮 alpha.5.5.2 重点

- **Launcher 测试夹具热修**：5.5.1 已把大多数当前布局 fixture 标记为 revision 13，但“删除中间/尾部幽灵空页”用例仍残留第二个 `homeLayoutRevision: 7`，对象字面量后键覆盖前键，触发了真实 revision 7 → 13 迁移并补入 `couple-board`。
- 删除该重复旧 revision 键，使此用例只验证幽灵页归一化，不再混入版本迁移；同时消除 Vite/esbuild 的 duplicate key warning。
- revision 12 → 13 的真实 `couple-board` 迁移仍由 `homeLayoutBackup.test.ts` 独立覆盖；生产 Runtime/UI、IndexedDB V18、Backup V12、HomeLayout revision 13 均不变。
- 测试定义仍为 66 files / 563 declarations；5.5.1 Windows 首轮实际达到 65/66 files、562/563 tests，仅此一条 fixture 失败。

## 0. 本轮 alpha.5.5.1 重点

- **Launcher 测试热修**：5.5.0 新增 `couple-board` 后，旧 `companionNavigation.test.ts` 仍按旧 catalog 和“未标 revision”的当前布局 fixture 断言，Windows 首轮 Vitest 因此出现 10 条失败。
- `HOME_APPS` / `CUSTOMIZABLE_APPS` 测试基线同步加入 `couple-board`；当前布局 fixture 显式声明 HomeLayout revision 13。
- revision 12 → 13 的真实迁移测试继续保留，确保旧用户仍会且只会补入一次新 App。
- Couple Board Runtime/UI、IndexedDB V18、Backup V12、Launcher revision 13 均不变；测试定义仍为 66 files / 563 declarations。

## 0. 本轮 alpha.5.5.0 重点

- **新增原生 App「心跳飞行棋」**：30 格双人棋盘，用户 + 单角色轮流掷骰子，支持真心话、大冒险、心动、盲盒、前进/后退、休息与终点结算。
- **四档题库强度**：纯爱 / 暧昧 / 亲密 / 成人。L4 需要显式确认双方均为成年人；若角色年龄字段明确小于 18，Runtime 直接拒绝成人模式。
- **Consent-first**：所有挑战都能换题或跳过；现实互动只提供题目，不替用户或角色确认动作，不把“完成”推导成关系事实。
- **聊天联动但不自动发送**：当前挑战可写入对应角色最近单聊草稿，用户进入 ChatRoom 后自行决定是否发送；不会自动写 Memory / Relationship State / Shared Event。
- **本地续局**：游戏状态复用 `appCustomizations` 非索引记录，进入现有 Backup V12；不新增 IndexedDB store。
- **Launcher revision 13**：新 `couple-board` App 自动补入已有桌面；迁移改为按 revision 精确执行，避免旧 Widget migration 被重复应用。
- **测试定义**：新增 14 条游戏 Runtime tests + 2 条 Launcher migration tests，合计 66 files / 563 declarations。当前环境未完成完整 npm verify，Windows / CI 双门禁仍是发布事实源。

## 0. 本轮 alpha.5.4.2 重点

- **Relationship Arc V1 TypeScript 发布热修**：修复 `SharedTimelineView.vue` 的可选 event 参数访问，解决 Windows `vue-tsc -b` 报错 TS18048。
- `contextSenderLabel()` 在 sender 不属于当前 characterMap 时安全回退到 `event?.characterName`，event 缺失则回退到“角色”。
- 不改变 Relationship Arc、Shared Event、数据库与 Backup 行为；测试矩阵仍为 65 files / 547 tests。

## 0. 本轮 alpha.5.4.1 重点

- **Relationship Arc V1 发布热修**：修复 Windows 首轮 verify 暴露的角色边界投影与事件摘要 evidenceKey 稳定性问题。
- 关系脉络在投影前先按 event owner 收窄，并再次按 evidence characterId 过滤；异常/陈旧事件包装不能把另一角色 evidence 投进当前 Arc。
- Shared Event 在“完整 evidence 集合未变化”时保留原稳定 `evidenceKey`；只有隐藏/筛除 evidence 导致 provenance 集合变化时才重算 key，使已确认摘要既能稳定命中，又会在证据变化时正确失效。
- Runtime 行为边界、IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 均不变；测试矩阵仍为 65 files / 547 tests。

## 0. 本轮 alpha.5.4.0 重点

- **Relationship Arc V1 / 关系脉络**：Shared Event 继续向上编译为按角色、按真实发生时间排序的关系节点与阶段。
- Promise / relationship / goal / story / shared-event 分类来自来源结构本身；Runtime 不读取普通文案去猜“吵架 / 和好 / 更爱了”等关系结论。
- 只有真实 `ConversationStateHistory(field=relationship)` 的 before/after 会形成明确关系阶段与最近关系记录。
- AI 关系摘要严格校验 `characterId + arcFingerprint + 完整 nodeIds + 完整 evidenceIds`，turning point 只能引用已有 node；候选默认不保存。
- 用户确认摘要按 arc fingerprint 保存；节点或 evidence 变化后自动失效，不自动写 Memory / Conversation State / 角色 Prompt。
- 关系脉络可由用户主动带回聊天草稿，携带 arc/node/evidence provenance，不自动发送。
- UI 拆出独立 `RelationshipArcPanel.vue`；IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。
- 静态测试矩阵：65 files / 547 tests；正式发布仍以 Windows / CI 双 `npm run verify` 为最终门禁。


## 0. 本轮 alpha.5.3.4 重点

- **时光 V1.3 · Event Intelligence**：共同事件新增 AI 摘要、用户备注、真实聊天上下文窗口与 evidence 手动排序。
- AI 事件摘要必须原样返回当前 event id 与完整 evidence ids；漏证据、伪造 evidence 或 JSON 不合法都会被 Runtime 拒绝。
- 用户确认摘要与备注按稳定 evidence fingerprint 保存；evidence 集合变化后旧摘要自动失效，隐藏证据不会通过摘要重新泄露。
- 带 sourceMessageId 的 evidence 可读取原消息前后各 1 条真实聊天上下文；不同会话隔离，撤回消息过滤，不写回 Memory。
- 人工事件保留 evidence 用户顺序；自动事件首次排序时转成人工事件，只持久化 evidence id 顺序。
- 主动旧事继续使用 event id + evidence ids guard，并可优先采用仍有效的用户确认事件摘要。
- IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变；测试矩阵提升到 59 files / 500 tests。

## 0. 本轮 alpha.5.3.2 重点

- **时光 V1.2 · Shared Event Runtime**：把同一经历的记忆、状态、聊天图片/音乐和朋友圈 evidence 归并成一个共同事件，同时保留每条真实来源。
- 自动归并遵守同 sourceMessageId、同角色/同会话短时间窗口、文本重叠与 8 小时最大跨度；不同角色永不自动合并。
- 时光默认进入“事件”视图，事件详情提供图片画廊、完整 evidence chain 和逐条回源；仍可切换“证据”视图查看最细粒度记录。
- 新增人工合并：用户可选择至少两条同角色 evidence 合并、命名、收藏、隐藏、改名与拆分；持久化只保存 evidence id 列表和事件元数据。
- 主动旧事从单条 evidence 升级为事件级 guard：Prompt 同时拿到 event id 与 evidence ids，继续禁止扩写证据外共同经历。
- `appCustomizations.sharedTimelineState` 新增非索引 `eventGroups`；IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变，无迁移。
- 新增 10 条 Shared Event Runtime 直接测试 + 1 条偏好归一化回归；测试矩阵提升到 57 文件 / 481 tests。


## 0. 本轮 alpha.5.3.1 重点

- **时光 V1.1**：新增全文搜索、最近 30 天 / 往年今天 / 最初记录筛选和按月份分组。
- 图片消息、音乐消息与带图朋友圈进入媒体证据卡；图片可预览，音乐只使用真实消息文本，不猜测历史歌名。
- AI 整理改为只处理当前可见筛选结果。
- 主动消息增加“旧事 evidence guard”：只在普通 daily-share 路径懒加载一条至少 7 天前、当前角色、未隐藏的时光证据；收藏优先，且 Prompt 禁止扩写证据外经历。
- 时光读取失败只降级主动消息，不影响聊天加载；Provider 失败策略不变。
- IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。
- 新增 16 条直接测试，测试矩阵提升到 56 文件 / 469 tests。


## 0. 本轮 alpha.5.3.0 重点

- **时光 / 共同回忆 V1**：新增原生 `SharedTimelineView`，把已有记忆、朋友圈动态、关系/事件/目标状态历史整理成可追溯时间线；每张卡保留 source id，并可跳回原消息或原动态。
- 用户可收藏、隐藏、改标题；这些偏好只写入 `appCustomizations` 的非索引字段，不复制事实正文，因此 IndexedDB 仍为 V18、Backup 仍为 V12，无数据迁移。
- 新增 AI 证据整理：模型只能从 Runtime 给出的 evidence id 中挑选最多 5 条候选，未知 id 一律丢弃；AI 建议不会自动写入记忆，只有用户点“采用标题并收藏”后才保存标题/收藏偏好。
- Launcher 新增 `timeline` App key 与“时光”图标；新安装会出现在默认桌面，已有布局不强制迁移，可在桌面编辑器手动添加，同时记忆中心提供固定“时光”入口。
- Chat 支持 `?message=<id>` 深链，时光卡可以滚动回原消息；朋友圈继续复用既有 `?moment=<id>` 深链。
- 新增 13 条直接测试，测试矩阵提升到 54 文件 / 453 tests；Generation Runtime 与 Provider 失败策略不变。

## 0. 本轮 alpha.5.2.4 重点

- **alpha.5.2.3 TypeScript 发布热修**：修复 Windows 首轮 verify 暴露的 TS2352 / TS6143 / TS2739。
- Community UI compiled candidate 与 canonical `RegexPipelineView` 对齐，保留 `rawText` / `traces`；测试 Persona fixture 补齐真实必需字段。
- ChatRoom 删除已无调用方的 `renderRoleplayText` import。
- Runtime 行为、IndexedDB V18、Backup V12、Launcher Grid V13 / HomeLayout revision 12 均不变；测试矩阵仍为 52 文件 / 440 tests。

## 0. 本轮 alpha.5.2.3 重点

- **Prompt Debug Runtime**：Trace 创建、冻结请求快照、Regex/API/自然度完成诊断和 Provider HTTP error patch 不再由 ChatRoom 手写；Debug 失败继续只降级诊断能力。
- **Assistant Reply Persistence Runtime**：alternative / rich / canonical-display / streaming / actions 五条最终持久化路径收口，View 不再维护 persistence switch。
- **Generation Lifecycle Runtime**：统一成功/取消/token/general error 的用户消息状态、vision metadata、provider notice、technical state、proactive timestamp 和本地摘要刷新。
- 用户手动停止仍只保留已经出现的真实 Provider 内容；任何 Provider/Runtime 失败都不会生成本地角色化替代回复。
- `ChatRoom.vue` 约 3552 行；预期测试矩阵：52 文件 / 440 tests；IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。

## 0. 本轮 alpha.5.2.2 重点

- **Community UI Repair Runtime**：合同校验、历史状态延续、本地 repair、紧凑状态补全、一次 AI 内容纠偏与失败回退从 `ChatRoom.vue` 下沉到 `communityUiRepairRuntime.ts`。
- Repair Runtime 结束后重新 parse 最终 canonical assistant 文本，保证 rawContent、status、actions 使用同一版本。
- **Assistant State Effects Runtime**：Conversation State、资源会话、Lorebook timed state、state history、主观观察记忆、Character mood/activity side effects 统一下沉。
- 候选回复不再可能顺带修改状态/记忆；Provider 与 Community UI 失败仍不触发本地角色内容 fallback。
- `ChatRoom.vue` 约 3930 行；测试矩阵：49 文件 / 416 tests；IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。

## 0. 本轮 alpha.5.2.1 重点

- **Generation Runtime 拆分第二阶段（扩大范围）**：最终 assistant parse / Regex projection / 宏替换 / presence override / native action shaping / visible output / persistence mode 全部收口到 `assistantReplyFinalizationRuntime.ts`。
- **Action Persistence Runtime**：typing pause、recall、reaction、voice、emoji、image placeholder、普通 text 的节奏、目标解析、元数据分配和落库编排下沉到 `assistantActionPersistenceRuntime.ts`。
- `ChatRoom.vue` 从 5.2.0 的约 4279 行进一步降到约 4128 行；本轮不改 Provider 调用、Community UI repair、Memory/State 写入协议。
- Streaming 最终复用消息补齐 Regex applied metadata；Provider 失败继续真实上抛，不增加本地角色 fallback。
- 新增 21 条 Runtime 回归测试；测试矩阵：46 文件 / 394 tests；最终以 Windows 两次 `npm run verify` 为准。

## 0. 本轮 alpha.5.2.0 重点

- **ChatRoom Generation Runtime 拆分第一阶段**：把流式回复 placeholder 的创建、增量 patch、140ms 持久化节流、flush、discard、用户停止后的真实输出保留，从 `ChatRoom.vue` 下沉到 `runtime/generation/streamingReplyRuntime.ts`。
- Vue View 只保留消息列表投影、滚动和最终 reply shaping；流式消息生命周期不再由页面自己维护 persistence timer。
- 新增 `streamingReplyRuntime.test.ts` 7 条直接测试：首 chunk 建立单一 placeholder、抑制预览、debounce、flush、discard、cancel 保留真实输出、空 placeholder 清理。
- Provider 失败仍真实上抛；没有本地角色 fallback；IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。
- 测试矩阵：44 文件 / 373 tests；最终以 Windows 两次 `npm run verify` 为准。

## 0. 本轮 alpha.5.1.27 重点

- **WorldBook Engine 直接测试补强**：新增 `lorebookService.test.ts`，从 `buildLorebookPrompt()` 公共入口覆盖实际 Runtime，而不是只测导入解析。
- 覆盖关键词/Regex/whole-word/case-sensitive、四种 selective logic、scanDepth/recalled、Persona/Character 上下文匹配、递归与 recursion guard。
- 覆盖 sticky/cooldown/delay、group scoring、probability、书级 token budget、At-Depth / Outlet。
- 运行时实现不变；IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。
- 测试矩阵：43 文件 / 366 tests；最终以 Windows 两次 `npm run verify` 为准。

## 0.1 alpha.5.1.26 发布安全收口

- 新增 `scripts/release-safety.mjs`，统一 package/lock、Git ignore、main/origin、ignored-but-tracked、staged forbidden paths 检查。
- `npm run verify` 与 GitHub Actions 共用同一 canonical 门禁；部署脚本不再用 Windows PowerShell 5.1 `ConvertFrom-Json` 直接解析 npm v3 lockfile。


## 0. 本轮 alpha.5.1.25 重点

- 真机诊断确认 `widget:greeting`「今天」曾以 4×2 布局占 8 格，但因 CSS 类名碰撞实际退化为约 1×1 像素，形成第二页视觉幽灵。
- 内部问候文字类改名为 `.widget-greeting-text`，外层 Widget 恢复 Grid 正常尺寸。
- painted guard 增加 8px 最小有效视觉尺寸：近零尺寸 DOM 不再被视为有效绘制，会进入现有连续两次确认、自愈/reflow、recovery snapshot、回收路径。
- IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。
- 测试定义：42 文件 / 351 声明；最终以 Windows 两次 `npm run verify` 为准。



## 0. 本轮 alpha.5.1.24 重点

- Windows Safe ZIP 文件名编码热修：历史中文文档名恢复为 UTF-8，并以 UTF-8 ZIP filename flag 重打包，修复 PowerShell `Expand-Archive` 的“路径中具有非法字符”。
- 运行时代码保持 alpha.5.1.23：`pageDiagnosticLine()` 死代码已删除；Launcher canonical layout 修复继续保留。
- IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 均不变。
- 测试定义仍为 42 文件 / 349 声明；最终以 Windows 两次 `npm run verify` 为准。

## 0. 本轮 alpha.5.1.23 重点

- 发布门禁热修：删除 `HomeScreen.vue` 中已无调用的 `pageDiagnosticLine()` 死代码，修复 `vue-tsc` 的 TS6143。
- 保留 alpha.5.1.22 的 Launcher canonical layout 修复：已有 `homeLayoutPages` 时不再从 legacy `homeAppKeys/homeWidgetKeys` 复活幽灵项目。
- IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 均不变。
- 测试定义仍为 42 文件 / 349 声明；最终以 Windows 两次 `npm run verify` 为准。

## 0. 本轮 alpha.5.1.22 重点

- **HomeLayout Inspector V4**：从“每页一行摘要”升级到逐 Item 诊断，显示 `type/key/x/y/w/h`、DOM 是否存在、当前页是否真实 painted、元素尺寸/坐标与结构问题；可复制完整诊断 JSON。
- **幽灵第二页结构修复**：HomeLayout revision 12；加载时清理 Dock 与桌面的历史重复 App、重复 App/Widget 与空页。真实手机语义下，同一 App 进入 Dock 后不再保留桌面副本。
- **安全修复入口**：诊断器提供“修复结构异常”和“备份并回收当前视觉空白页”；强制回收前仍保存 recovery snapshot，不删除角色、聊天、记忆等业务数据。
- **WorldBook Activation Inspector V4**：逐条记录主关键词、辅助关键词、selective logic、scan depth、regex/case/whole-word 语义，并继续保留 kind/match/recursion/token/priority/order/position/probability。
- **Context Inspector V3**：Prompt section 开始记录估算 token；增加 Prompt Preset 来源与整轮估算输入 token，可与 Provider 返回的实际 prompt token 对照。
- IndexedDB V18 / Backup V12 不变；静态测试定义为 42 文件 / 349 声明，最终仍以 Windows `npm run verify` 为准。

## 0. 本轮 alpha.5.1.21 重点

- **幽灵第二页最终兜底**：完整审计默认页、legacy page、normalize、transient page、page dots、compositor 后确认没有任何“固定两页”规则；对视觉空白但数据非空的页面采用“两次确认 → 安全折叠 → 本地恢复槽 → 强制回收”的状态机。
- **不再用透明 shell 证明“页面可见”**：App 改采样真实 `.app-icon`，Folder 采样 `.hm-folder-tile`，Widget 采样自身背景，避免透明布局盒误判成已绘制项目。
- **幽灵页恢复保险**：强制回收前把完整 page JSON 保存到本机 `companion-home-ghost-page:<worldId>` 恢复槽；只移除 Launcher 归属，不删除角色、聊天、音乐或其他业务数据。
- **HomeLayout revision 11**：启动会再次归一化历史布局；默认页和 normalize 新增回归测试，明确没有硬编码第二页。
- **WorldBook Activation Inspector V3**：逐条判定新增 activation kind、match score、递归层、估算 token、priority/order/position/probability。
- **Context Inspector V2**：基于本轮 promptSections 显示各 Context 来源的字符数与近似 token，而不是只显示条目数。
- 测试定义：41 文件 / 345 声明（最终以 Windows `npm run verify` 输出为准）。

## 0. 本轮 alpha.5.1.20 重点

- Launcher Pointer Tap：普通短按不再依赖浏览器 click，App / Widget 点击由 Runtime 直接激活。
- “一起听”Widget：主体进入音乐 App；独立播放/暂停按钮可控制已有 MusicState 音频。
- 幽灵页修复增加真实绘制命中检测，并在前页空位碎片化时执行安全 reflow 后回收页面。
- 新增碎片化空位下幽灵页折叠回归测试。
- 测试定义：41 文件 / 343 声明（最终以 Windows `npm run verify` 输出为准）。

## 0. 本轮 alpha.5.1.15 重点

- 修复“第二页幽灵空页”顽固残留：拖拽预览只在 `draggingId` 有效时参与渲染，避免过期 `dragPreviewAppearance` 覆盖真实桌面。
- `finishHomePointer()` 改为 `try/finally`，即使 IndexedDB 写入或布局校验异常，也会无条件清理拖拽 ghost / preview / transient page。
- `HomeLayout Revision` 提升到 8；读取旧布局时自动压缩中间/尾部空页并回写自愈结果。
- 增加 DOM 级兜底修复：稳定桌面页如果最终没有任何可见 Launcher Item，会被认定为 ghost page 并从持久布局中移除。
- 新增 `removeHomeLayoutPages()`，删除幽灵页时同步重算 `homeAppKeys/homeWidgetKeys`，避免被 normalize 再次补回。
- 测试定义：41 文件 / 336 声明（最终以 Windows `npm run verify` 输出为准）。

## 0.1 alpha.5.1.13 重点

- **Launcher Grid V7**：App / Widget 拖拽从 swap 改成 insert + reflow；拖到某个位置时，后续项目会实时后移、跨行补位。
- **实时布局预览**：拖动过程中不直接写 IndexedDB，而是基于当前持久布局生成临时 preview；指针跨过格子时立即重排，松手后才提交。
- **果冻式重排动画**：布局变化使用浏览器 FLIP/WAAPI 位移动画，周围 App / Widget 会连续滑动让位，而不是松手后一瞬间交换。
- **Widget 参与流式占位**：组件的实际 w×h 进入同一 pack 算法；大组件插入时会一次推开多个后续 App。
- **页面边界保持玩家意图**：来源页只在本页向前补位；不会主动从下一页抽项目，因此“一个 App 单独一页”仍然成立。目标页装不下时才把尾部内容向后页推进。
- IndexedDB V18 / Backup V12 不变。

## 0. 本轮 alpha.5.1.12 重点

- **Launcher Grid V6**：App 与 Widget 统一为可移动 Grid Item；App↔App 可交换，Widget 可拖动、跨页和改尺寸。
- **Widget 尺寸回归真机比例**：最近的人/世界状态默认 2×1，音乐默认 4×1；旧大尺寸布局通过 layout revision 自动收窄。
- **编辑态收敛**：移除右上角大块“完成”控件；轻点桌面背景即可结束编辑，左上“编辑”仅用于主动打开编辑菜单。
- **音乐组件去冗余**：删除右侧独立播放箭头，整个组件作为入口，并继续读取真实 MusicState。
- **Widget 能力扩展**：新增照片、日历组件与组件尺寸编辑；新增桌面主题预设和 HomeLayout 独立导入/导出。
- **Runtime 深化**：Character Card 导入报告、Context/WorldBook Inspector、Capability-Gated AgentAction、Backup V12 Zod 预检与跨表引用完整性检查、HomeLayout Zod Schema 已进入实现；WorldBook Inspector 新增逐条激活判定轨迹。

## 0. 本轮 alpha.5.1.11 重点

- **Launcher Grid V5**：主屏不再把 App 视为一维数组，而是 4×6 网格；App=1×1，Widget=2×2/4×2，页面可留白。
- **页面归属真正持久**：`homeLayoutPages` 保存每个 Item 的 `x/y/w/h`；一个 App 可以单独待在一页，只要页面非空就不会被自动挤回前页。
- **真机式边缘翻页**：拖动 App 到手机内部左右边缘即可换页；最后一页向右可临时打开新页，落下内容后才持久化；空页自动回收。
- **Pointer 生命周期闭环**：window 级 `pointerup/pointercancel/blur` 统一结束 drag / swipe，修复松开鼠标后页面继续跟随。
- **白线根因修复**：确认来源是默认壁纸底部 blur 光斑的 Chromium 合成裁切缝，而不是 scrollbar；独立 blur 光斑 DOM 已移除。
- alpha.5.1.8 起的 Character Card Security Boundary、WorldBook compatibility、Memory Retrieval V2、SullyOS 深度研究继续保留。

## 1. 当前产品结构

### 空间桌面

主屏重新按真实手机组织：

- 四列 4×6 Launcher Grid；App、Widget、Folder 共用同一布局；默认显示音乐、海龟汤、我的资料、记忆、数据备份；
- 四格 Dock；默认显示知间、新建角色、世界、设置；
- 可选小组件：今天、最近的人、世界状态、一起听、照片、日历；
- 长按空白处进入编辑态，可添加小组件、自定义、编辑墙纸和编辑桌面；
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

- 新增 `lorebookService.test.ts` 已用 TypeScript 5.8.3 `transpileModule` 做语法检查：通过；
- 额外建立独立 Node/TypeScript harness，使用同一份 `lorebookService.ts` 实现与 mock DB/binding 跑通本轮 15 个核心场景；
- 当前容器仍无法稳定完成完整 `npm ci`，因此本轮**不宣称 Vitest / vue-tsc / Vite Build 已在容器通过**。

正式发布门禁仍是：

```powershell
npm ci
npm run verify
```

只有 Windows / CI 完整通过后才部署。

## V0.5.0-alpha.5.1.26 发布安全基线

- 发布前必须通过 `npm run release:git-preflight`。
- 源码同步后、暂存前必须通过 `npm run release:git-working`。
- `git add -A` 后必须通过 `npm run release:staged-check`。
- `node_modules/`、`dist/`、`*.tsbuildinfo`、`.env*` 不得进入 Git 跟踪或暂存区。
- 本地与 GitHub Actions 共用 `npm run verify` 作为质量门禁。

## V0.5.0-alpha.5.3.3 hotfix

- Shared Timeline V1.2 behavior unchanged.
- Proactive recall safety regression test corrected; expected matrix remains 57 test files / 481 tests.
