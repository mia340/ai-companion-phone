## V0.5.0-alpha.4.4.1 · 社区 Persona 兼容回归 Hotfix

- 修复对象型社区 Persona 字段的结构化值归一化：`age: "29岁"`、`age: "31 years old"` 统一保存为纯年龄数字，`height: "172 cm"` 统一为 `172cm`。
- 年龄解析不再围绕某一张角色卡；新增中英文字段/单位的通用归一化，并继续保留 `23岁(生日...)` 等自由文本兼容。
- 修复 alpha.4.4 打包时误把本地语料审计探针 `__communityCorpusProbe.test.ts` 带入正式测试集，导致 Windows/GitHub 上硬编码 `/mnt/data/community_cards` 路径而失败。该探针现已从发布源码移除。
- 用用户提供的 49 份社区 JSON 做独立语料运行：32 份被识别为角色卡，17 份被正确拒绝为世界书/预设；32 份角色卡中 17 份检测到独立用户 Persona。
- 发布测试目标恢复为 **30 个测试文件 / 277 个用例**；IndexedDB **V16** / Backup **V11** 不变。

## V0.5.0-alpha.4.3.1 · creator_notes 年龄解析 CI Hotfix

- 修复角色卡 `creator_notes` Persona 在 `23岁(生日12月3日)` / `23岁（生日…）` 这类“年龄后紧跟括号补充信息”格式下，年龄字段解析为 `undefined` 的问题。
- 根因是年龄兜底正则要求“岁”后必须立刻出现逗号、句号、空白或文本结束，未把中英文左括号视为合法字段边界。
- 保留 alpha.4.3 的朋友圈评论串、多角色热度与 creator_notes Persona 识别逻辑；IndexedDB **V16** / Backup **V11** 均不变。
- 新增 `npm run verify`，按 `npm test && npm run build` 串行验证，避免 Windows PowerShell 在测试失败后仍继续执行 Build 造成“Build 绿但整体验收其实失败”的误判。
- 目标回归矩阵仍为 **30 个测试文件 / 275 个用例**；本热修应使失败的 `creator_notes` Persona 测试恢复通过。

## V0.5.0-alpha.4.3 · 朋友圈评论串 + creator_notes 用户 Persona 修复

- 朋友圈从“平铺评论 + 仅动态作者回评”升级为可继续对话的评论串：点按角色评论即可回复，保存 `replyToCommentId`，展示“甲 回复 乙：……”；角色收到直接回复后会结合自己上一条评论继续接话，而不是重新评论整条动态。
- 用户动态的默认 `lively` 回复热度从“通常 1 位、偶尔 2 位”调整为**通常 2～3 位不同角色**；`party` 为 3～5 位，候选角色不足时自动以实际人数为上限。
- Character Card 导入兼容新增 `creator_notes` 明确用户设定块识别，支持 `[用户设定(...)]` / `[用户人设]` / `[主控人设]` 等标签；仅提取该明确块作为角色专属 Persona 元数据，**creator_notes 全文仍不会直接进入模型 Prompt**。
- 现有已导入角色也可在原卡编辑器中从保存的 `creatorNotes` 恢复该 Persona 预览并“创建并绑定角色专属 Persona”，无需删除旧聊天。
- 针对“褚焚川 / 姜阮”这类 `creator_notes` 实样新增回归测试，并增加朋友圈 comment-thread Prompt 测试与多人热度边界测试；静态测试定义为 **30 个测试文件 / 275 个用例**。
- IndexedDB **V16** / Backup **V11** 不变；`MomentComment.replyToCommentId` 为非索引可选字段，无需数据库迁移。
- 当前容器完成改动 TypeScript / Vue script 语法检查；由于离线依赖缓存不完整，完整 `npm test` / `npm run build` 仍需 Windows 验收。

## V0.5.0-alpha.4.2.1 · Windows Build Hotfix

- 修复 `src/views/HomeScreen.vue` 长按计时器类型冲突：将 `ReturnType<typeof window.setTimeout> | undefined` 收敛为浏览器语义明确的 `number | undefined`。
- 解决 `vue-tsc -b` 的 `TS2322: Type 'number' is not assignable to type 'Timeout'`。
- 用户 Windows 已验证 alpha.4.2 的 **30/30 测试文件、272/272 用例通过**；本热修只修改类型声明，不改变定时器行为。
- IndexedDB **V16** / Backup **V11** 不变。

## V0.5.0-alpha.4.2 · Community Chat Compatibility

- 聊天展示改为 **community-first**：富文本 Regex → WorldBook HTML 合同 → 作者直接 HTML → 作者结构化/纯文本 → 原生手机气泡；默认不再把作者内容强制改造成小手机私有 UI。
- `first_mes` / `alternate_greetings` 现在与后续回复共用同一套 Community UI Contract 检测：若作者 WorldBook 声明固定 HTML 状态栏，而开场只是“结构化文本 + `<br>`”，本地 Compiler 会把已有开场数据填回作者模板，不生成新剧情。
- 已存在的旧会话开场也会在加载时做一次安全升级；成功适配后持久化为 `rich`，后续不重复编译。
- 修复社区状态栏 `<br>` 被 escape 成可见 `&lt;br&gt;` 的问题；HTML Compiler 先恢复逻辑换行，再进行字段转义与模板填充。
- `SafeRichHtml` 为作者根节点增加 `max-width:100%` 约束，固定宽度 UI 在手机窄屏内自适应；含 `<style>` 的作者 UI 被视为自带 Surface，避免再套一层白色聊天气泡。
- Rich 来源区分更准确：真正由富文本 Regex 产生记为 `regex`，WorldBook HTML 合同记为 `worldbook-ui`，作者直接 HTML 记为 `card-ui`。
- 新增 2 个 Community UI 回归测试，当前静态定义为 **30 个测试文件 / 272 个用例**。
- IndexedDB **V16** / Backup **V11** 不变。

## V0.5.0-alpha.4.1 · 主屏幕真实手机化 + 美化中心 + 记忆 App

- 首页移除常驻右上角“编辑”胶囊，不再把桌面设置暴露成普通按钮；主屏幕回归纯导航 Surface。
- 新增 `设置 → 桌面与外观`：玩家可统一设置主屏幕壁纸、任意 App 自定义图标、图标大小与名称显示；主屏空白处长按可快速进入。
- 自定义壁纸在本地压缩为 WebP 后保存到现有 `appCustomizations`，不新增 IndexedDB 版本；图标与外观继续进入 Backup V11。
- 主屏幕“记忆”从占位页升级为真实 Memory Center，按角色汇总角色共享记忆、聊天内记忆、冲突数与多会话入口。
- 聊天设置中的逐条添加/删除/清空记忆入口移除，只保留“是否记忆 / 记忆强度 / 最近聊天范围”；完整编辑、冲突处理与 Scope 切换统一进入主屏“记忆”。
- UI 决策对齐社区与真实手机的共同习惯：桌面用于打开 App，美化集中管理，长按作为桌面编辑快捷手势；Memory 作为一级功能入口，而不是藏在聊天设置深层。
- IndexedDB **V16** / Backup **V11** 不变；测试定义仍为 **30 个测试文件 / 270 个用例**。

## V0.5.0-alpha.4.0 · Generation Runtime + 聊天左滑删除

- 新建 `src/runtime/generation/`，把 AI 生成主链第一阶段从 `ChatRoom.vue` 抽离为 Generation Context / Context Builder / Provider Orchestrator / Response Persistence。
- 每轮请求新增 `generationId` 与 `contextCreatedAt`，冻结角色、Persona、会话、状态、记忆、消息、模型配置等上下文，减少异步生成期间的状态漂移。
- Prompt Debug 增加 generation provenance；Streaming、普通回复、Rich/Community UI、候选回复持久化均写入 `generationId`。
- 保留现有真实 Provider/Streaming 与 Vision 自动降级语义，不引入本地假回复。
- 聊天列表新增左滑删除：支持 Pointer Events、方向锁定、拖动/甩动打开、回弹、误触保护，并保留纵向滚动。
- 删除聊天改走统一 Runtime 清理：删除当前聊天消息、局部记忆、状态历史、Prompt Debug、聊天级资源绑定；朋友圈仅解除来源引用；角色共享记忆保留并在可能时迁移到同角色的其他聊天。
- 删除 branch 根/中间节点时同步修复 surviving branch 的 parent/root 引用。
- 新增 9 个 Generation / Conversation Delete 回归用例；源码定义 **30 个测试文件 / 270 个用例**。IndexedDB **V16** / Backup **V11** 不变。

## V0.5.0-alpha.3.5 · App Icon 系统与多聊天记忆归属

- 首页 12 个 App 从 Emoji 占位升级为统一 SVG 图标系统：轻量、清晰、淡蓝系双色渐变与一致高光，Dock 同步复用。
- 首页新增“编辑”模式；玩家可以上传图片替换 App 图标，也可以一键恢复默认。上传图片会在本机裁成 512×512 WebP，单图控制在约 420 KB 以内。
- 新增 IndexedDB V16 `appCustomizations`，按世界保存 App 图标；Backup 升级到 V11，并兼容旧 V1～V10 备份。
- 记忆新增 `MemoryScope`：`character`（跨聊天共享）与 `conversation`（当前剧情线）。`fact / promise / relationship` 默认共享；`shared / subjective / story` 默认局部。
- Chat Prompt 改为“当前聊天记忆 + 角色共享记忆”，避免多个聊天之间出现随机选源或剧情串线。
- 记忆管理增加 Scope 视图和“跨聊天共享 / 移出共享”操作；重新开局、rewind、branch、删除聊天时不会误删角色共享记忆。
- 朋友圈发帖与角色回评读取角色共享记忆，使其他 Native App 开始遵守统一的 Character Memory Ownership。
- 新增 3 个 Memory Scope / branch / rewind 回归用例；当前目标 **27 个测试文件 / 261 个用例**。

# CHANGELOG

## V0.5.0-alpha.3.4.1 · 聊天输入框布局热修

- 修复全局旧 `.composer` 三列 Grid 样式误作用到 `ChatComposer.vue`，导致聊天输入区被压缩成左侧极窄竖条的问题。
- 聊天输入组件根类改为独立 `chat-composer`，显式使用单列 `minmax(0, 1fr)` 布局并占满可用宽度，避免后续再次被全局同名样式污染。
- 保留 alpha.3.3 引入的自动长高、手动拖高、下方工具栏、图片/语音/发送能力；不改消息发送语义、数据库 V15 或 Backup V10。

## V0.5.0-alpha.3.4 · 全手机视觉统一第二轮

- 聊天列表改成更接近微信 / iOS 的白底列表：紧凑搜索栏、标准行高、右侧时间、未读角标、轻分隔线，取消卡片堆叠感。
- 通讯录新增搜索；“新建角色”改成列表入口，联系人回归白底行式布局，减少装饰性阴影和大圆角。
- 设置页改为 iOS 式 grouped list，按“体验 / 角色与世界 / AI 与数据 / 关于”分组，统一图标尺寸、行高、箭头与版本展示。
- 角色详情全面去粉化：资料卡、状态卡、动作区、聊天记录、原卡阅读器统一淡蓝 / 白色设计；主操作只保留一个明确蓝色强调。
- 世界中心将残留粉紫强调收敛为蓝灰体系，资源卡、分段控制、编辑 Sheet 与输入控件统一同一套 Surface Token。
- 全局增加 `accent / surface / text / muted / line / danger` 视觉 Token，并微调导航栏、返回按钮、按压反馈与文本选中态。
- 本版只动展示层与通讯录搜索，不修改 Conversation Runtime、Community Runtime、数据库 V15 或 Backup V10。

## V0.5.0-alpha.3.3.1 · 朋友圈 guaranteed reply 边界热修

- 修复 `planReplyCount()` 在 `lively / party` 的 `chance=1` 档位下，测试注入 `rand() => 1` 时仍被 `>= 1` 判为冷场的问题。
- 现在 `chance === 1` 明确表示“只要有候选好友，至少一位回应”；`quiet / mild` 仍保留概率冷场。
- 不改朋友圈延迟、点赞、评论生成、聊天 UI、Community UI、数据库或 Backup 结构。
- Windows alpha.3.3 实测基线：**26/27 test files、257/258 tests**；本热修目标恢复到 **27/27、258/258**。

## V0.5.0-alpha.3.3 · 真实手机感与交互打磨

- 聊天输入区改为“全宽输入框 + 下方工具栏”：正文输入明显变宽，支持自动长高与纵向拖动，发送按钮不再挤占输入空间。
- 消息编辑彻底移除浏览器 `window.prompt()`；新增原生底部编辑器，提供大文本区、字符数、可调高度与清晰的取消/保存按钮，避免网页弹窗破坏手机沉浸感。
- 首页与锁屏统一成淡蓝/乳白壁纸，状态栏切为深色图标，去掉深紫渐变与强暗角；Dock 和图标标签改为适配浅色壁纸的半透明玻璃层。
- 朋友圈把“好友自主发动态”和“好友回应我的动态”解耦：即使关闭自主发帖，用户手动发朋友圈仍会按“回复热度”触发好友互动；默认 lively 档保证至少一位好友回应。
- 好友评论用户动态时同步记录一个外部点赞；纯图片动态也能给模型明确的图片动态语境。
- 修复朋友圈评论输入框在窄屏中被头像/发送按钮压成细条的问题，改为全宽可拉高输入区。
- 海龟汤修复模板字符串被当作普通 placeholder 显示的 `{{ gameHost.name }}`；底部操作区改成更接近原生 App 的贴底工具栏。
- Community UI 继续阻止第三方 JavaScript，但不再在每条消息底部常驻“脚本已安全阻止”诊断卡；静态作者 UI 与本地安全交互照常显示，诊断信息留给 Prompt Debug。
- 新增朋友圈外部点赞回归测试；当前定义 **27 个测试文件 / 258 个用例**。IndexedDB **V15** / Backup **V10** 不变。

## V0.5.0-alpha.3.2.1 · 海龟汤 Presentation Policy 引用热修

- 修复 `turtleSoupService.ts` 使用 `NATIVE_APP_TEXT_ONLY_RULE` / `sanitizeNativeAppText` 却遗漏从 `appPresentationPolicy.ts` 导入，导致 Windows 全量测试中海龟汤 11 个用例统一报 `ReferenceError`。
- 不改 Presentation Policy 语义：聊天继续允许 Community UI；朋友圈 / 音乐 / 海龟汤仍只让 AI 生成内容，由本地 Vue Surface 负责 UI。
- IndexedDB 仍为 **V15**，Backup 仍为 **V10**；这是单点导入热修，不改业务数据。
- alpha.3.2 Windows 实测基线：**26/27 test files、245/256 tests**；本热修目标恢复到 **27/27、256/256**。

## V0.5.0-alpha.3.2 · 清新原生视觉与 Presentation Policy

- 聊天恢复为淡蓝背景 + **白色 AI 气泡 / 浅蓝用户气泡**，统一圆角、边界、阴影、顶栏和输入区，整体向 iOS / 微信式克制层级靠拢，不再使用暖粉/夜紫等割裂主题。
- 修复“普通剧情正文 + 作者 Community UI”混排时正文裸贴聊天背景：`SafeRichHtml` 仅把 UI 外的顶层自然语言包成白色叙事气泡，作者 HTML / Regex / Community UI 仍保持独立 Surface，不二次套卡。
- 建立 `appPresentationPolicy.ts`：**Chat 允许角色卡作者接管 Presentation；朋友圈 / 音乐 / 海龟汤等独立 App 只让 AI 生成内容，本地 Vue Surface 负责 UI**。模型误输出 HTML/XML/CSS/代码围栏时会降级为自然语言。
- 朋友圈改为更接近微信的信息流：白底、蓝色作者名、轻分隔、灰底评论区；“自主动态 / 回复热度”默认折叠到 `•••` 设置，顶部只保留发布与好友动态入口。
- 朋友圈手动动态支持最多 4 张本地图片；图片先走现有压缩/校验，再以静态 data URL 入库。文字与图片可二选一，不升级 IndexedDB。
- 音乐、海龟汤两种玩法的 AI 对话改为**非气泡文字记录**；游戏允许极短动作/神态/心理描写，但禁止 AI 再生成第二层 UI。海龟汤题面 JSON 同样清理误生成的 HTML/CSS。
- 新增 Presentation Policy / 朋友圈图片 / 原生 App 输出边界回归测试；当前源码定义 **27 个测试文件 / 256 个用例**。
- IndexedDB 保持 **V15**，Backup 保持 **V10**。

## V0.5.0-alpha.3.1.1 · 自主朋友圈补发边界热修

- Windows 全量测试确认 alpha.3.1 为 **25/26 test files、243/244 tests**，唯一红灯来自 `autoPostCountDue()` 的 3 小时补发边界。
- 统一产品语义：30 分钟最小间隔只控制“是否允许发第一条”；后续补发按**总离线时长跨过的完整 3 小时窗口**计算，因此 30m~<3h 为 1 条，>=3h 为 2 条，并继续受 `AUTO_MAX_BACKFILL=2` 限制。
- 增加“长时间离线仍最多补 2 条”回归用例，避免未来调整窗口时突破费用上限。
- 不改朋友圈 DB V15 / Backup V10，不改角色自主活动的显式 opt-in、前台/在线和单请求链安全边界。


## V0.5.0-alpha.3.1 · 新 App 稳定化与视觉收口

- 接收并审查用户新增的 **朋友圈 / 音乐 / 海龟汤（猜题+反向主持）** 三类 App Surface；保留原功能设计，不回退已有 Conversation Runtime。
- 修复示例角色“删光后重启会复活”：demo 角色/示例朋友圈只在真正首次空库初始化，不再以 `characters.count() === 0` 作为播种条件。
- 修复删除角色时，`momentComments.authorId` 未建索引却使用 Dexie `.where('authorId')` 可能触发 `SchemaError`；改为 collection filter，**不升级 IndexedDB**。
- 修复海龟汤提问把“当前问题”同时放进 history 和 current question，导致主持模型每轮看到同一句两次。
- 朋友圈自主活动改为**显式开启**：默认关闭；最小自动发布间隔由 3 分钟调到 30 分钟，补发窗口改为 3 小时；只在前台/在线运行，同一时间最多一个自动 AI 请求链，减少隐性 API 消耗与定时器重入。
- OpenAI-compatible Provider 不再注入非标准 `thinking` 字段；只有内置 DeepSeek provider 在关闭思考时发送 `thinking:{type:"disabled"}`，降低第三方兼容网关 400 风险；新增 2 个 Provider 回归用例。
- 朋友圈 / 音乐 / 海龟汤三个重交互入口改为路由懒加载；PWA `start_url / scope / icon` 修正为 GitHub Pages 子路径，并统一深蓝紫主题色。
- 首页在“已有角色但尚无会话”时回退展示最近角色，不再错误提示“还没有联系人”。
- 美化四个新增页面：朋友圈使用暖粉玻璃卡片；音乐使用夜紫唱片房；海龟汤玩家页使用薄荷+琥珀；主持页使用暖珊瑚+琥珀，并补齐 focus-visible / active 反馈；模型设置的 reasoning checkbox 改为移动端开关。
- 当前源码定义 **26 个测试文件 / 244 个 `it/test` 用例**；本环境 `vue-tsc -b` 已通过。完整 Vitest / Vite Build 仍以 Windows 工作区验收为准。
- IndexedDB 保持 **V15**，Backup 保持 **V10**。

## V0.5.0-alpha.3 · Conversation Runtime 第二刀

- 新增 `conversationStateReplayService.ts`，把节点状态重建从 `ChatRoom.vue` 抽成可测试 Runtime；
- 新增 `conversationBranchService.ts`，统一分支 Message / Settings / Memory / StateHistory / State / Music 的复制与 ID remap；
- `conversationMutationService.ts` 新增 rewind truncate，用统一 plan 清理锚点旧派生数据、后续消息与 Prompt Debug；
- 新增 `conversationOpeningService.ts`，统一 greeting / free opening 的跨表 reset/write；自由开局补齐 Prompt Debug 清理；
- 修复 branch 可能继承分支节点之后 source-less StateHistory / automatic Memory 的时间穿越风险；
- 新分支 reply reference / reply group 使用本分支新 ID，不再保留可避免的父会话内部引用；
- `ChatRoom.vue` 降到 4,576 行，直接 `db.` 调用约 52 处；Generation Pipeline 尚未拆；
- 新增 6 个 Runtime 测试，目标测试矩阵为 21 个文件 / 155 个用例；
- IndexedDB V14 / Backup V9 不变。

> alpha.3 的完整 Vitest/Build 仍以 Windows 验收为准；本地红灯时不要 commit。

## V0.5.0-alpha.2.1 · scene-merged 多气泡边界回归修复

- Windows alpha.2 全量测试从 7 个失败降到 1 个失败：18/19 测试文件、148/149 用例通过；
- 修复 `scene-merged` 在 `multiBubble=true` + 隐藏协议时把 `scene_action + text + scene_action + text` 错拆成两个气泡的问题；
- 新规则：**存在可见 `scene_action` 时优先执行 scene-merged 语义，把动作与对白合成剧情气泡；没有可见动作时才保留协议明确的多 `text` 消息边界**；
- 不改 Character Card / WorldBook / Regex / Community UI / IndexedDB / Backup 语义；
- alpha.3 的 Runtime 第二刀仍然推迟到 149/149 全绿之后。

> 这是 alpha.2 的单点可靠性热修，不扩大重构范围。

## V0.5.0-alpha.2 · 兼容层测试清零与 docs 真清理

- 修复独立 WorldBook JSON 因顶层 `name` 被误识别为 community character 的问题；
- 修复 Community UI HTML 模板提取标记过度贪婪，确保 Compiler V2 保留作者完整外层模板；
- scene-merged 模式下，`multiBubble=true` 且隐藏协议明确多个 `text` 时保留模型消息边界；
- Regex 增加旧社区“一层过度转义”兼容 fallback，仅在原表达式不匹配时尝试，不改原资源；
- `normalizeRichHtml()` 兼容围栏边缘的字面 `\n`；
- Tavo pipe-style 状态兼容字面 `\n` 行分隔；
- 修正 World Info Regex 测试 fixture 同名造成的歧义断言，继续验证 display-only 不进入 Prompt；
- 新增 `npm run cleanup`；`prebuild` 自动清理已归档的旧逐版本 Markdown / 旧社区审计 / 旧部署说明；
- IndexedDB V14 / Backup V9 不变。

> alpha.1 的 Windows 结果为 Build 通过、149 个测试中 7 个失败；alpha.2 的目标是先把这 7 个红灯按真实语义清零，再进入下一轮 Conversation Runtime 拆分。

## V0.5.0-alpha.1 · Conversation Runtime 可靠性基线

- 新增 `src/runtime/conversation/conversationMutationService.ts`，建立消息删除/会话重启的统一事务入口；
- 删除消息同步处理自动记忆、状态历史和 reply 引用，并在 UI 侧重建当前 ConversationState；
- “清空聊天记录”改为“重新开始当前聊天”：清消息、自动剧情记忆、StateHistory、Prompt Debug，保留手工/导入记忆与角色资源；
- `loadConversation()` 增加 epoch guard，避免快速切换会话时旧异步结果覆盖当前聊天；
- 新增 Conversation Mutation 纯规则测试；
- GitHub Pages workflow 在 Build 前新增 `npm test`，测试失败不再继续部署；
- docs 重新分层：当前文档、工程审查、参考项目、开发历史、Community Runtime 历史分开；
- IndexedDB V14 / Backup V9 不变。

> 本 alpha 基于用户上传的 V0.4.7.1 源码开始重构。若本地已有未上传的 V0.4.7.2+，不要直接覆盖。

> 精简版本变化。完整逐版本说明见 `RELEASE_HISTORY.md`。

## V0.4.7.1 · Community UI / 编辑后重生成稳定补丁

- 修复无 Regex、由 WorldBook HTML 模板驱动的状态 UI 未识别 `【状态栏】` 前导，后续回复可直接本地回填作者模板；
- Rich UI 不再统一透明：作者自带视觉表面继续透明承载，裸旧社区 markup 使用中性背景；HTML 开场中的 Markdown 图片转成安全静态 `<img>`；
- 纯手机多气泡新增“共同回应最新用户消息”的连续性约束，不再鼓励泛泛拆句；
- 动作/台词分开模式在自然反应存在时加强 `scene_action` 输出合同，远程动作只描述角色自己一端；
- 用户消息操作菜单新增“从这条消息重新回复”，编辑用户消息后可确认截断旧后续并重新生成；
- 回滚时重建该节点前 ConversationState，只清理失效分支的自动记忆/状态历史/Prompt Debug，不删除手工或导入记忆；
- IndexedDB V14 / Backup V9 不变。

## V0.4.7.0 · Regex Pipeline V2 / Renderer 分层

- Regex 按 placement + phase 执行，不再把 `promptOnly` 脚本错误作用到整个 System Prompt；
- 对齐常见 SillyTavern ephemerality：两项都不勾=永久存储；markdownOnly=显示；promptOnly=出站 Prompt；两项都勾=显示+出站且不改存储；
- `minDepth / maxDepth` 真正按历史深度执行，Depth 0 为最近消息；内部 director/music 指令不再错误推高历史 depth；
- 修复出站 Prompt 在预筛选阶段把所有 Regex 误当 depth=0 的问题；带 `minDepth>0` 的脚本会保留到每条真实历史消息再判断；
- `runOnEdit` 真正控制手动编辑消息时是否重跑 Regex；
- 新增消息 `modelOutput / displayContent / regexPipelineVersion / regexApplied` 可选字段，不升级 IndexedDB；
- 开场、用户输入、AI 回复、World Info 统一走分阶段 Regex Pipeline；
- markdownOnly 社区 HTML/UI 只进入安全显示层，原始结构继续留在聊天上下文，不再把渲染 HTML 污染存储；
- Prompt Debug 新增 Regex Pipeline V2，显示存储/显示/出站/World Info/Depth 跳过信息；
- Regex 资源编辑器增加中文 placement、ephemerality、Depth 说明；placement 3/6 完整保留但主聊天暂未接 Slash/Reasoning runtime；
- IndexedDB V14 / Backup V9 不变。

## V0.4.6.0 · Character Card Compatibility Alignment

- 新增轻量 Character Compatibility Layer / Runtime Manifest，不升级数据库；
- V2/V3 `creator_notes` 退出 Prompt，保留阅读展示；
- V2/V3 `system_prompt` / `post_history_instructions` 支持 override + `{{original}}`；
- V3 `nickname` 接入 `{{char}}`，新增 random/pick/roll/comment 宏；
- 社区 `first_mes` 仅作为真实开场历史，不再推导永久格式连续性；
- V3 再导出保持 V3 并保留 nickname/source/assets/multilingual notes/未知扩展；
- WorldBook `constant + use_regex` 改为标准优先、旧无 key 数据兼容兜底；
- Regex/XML UI 缺状态时先继承上一轮真实 AI 状态；仍缺字段时使用紧凑状态补全调用，只返回作者标签，第一版正文不重写；
- Prompt Debug 与原卡阅读器新增兼容层诊断；
- IndexedDB V14 / Backup V9 不变。

## V0.4.5.1 · WorldBook constant/use_regex 与资源库移动端修复

- 修复 `constant=true + use_regex=true` 条目被 WorldBook Engine V2 错误跳过的问题。
- 无关键词且作者明确声明“每轮/每次回复必须”的输出合同增加兼容兜底。
- 修复资源库长标题、文件名、兼容报告导致 PhoneFrame 横向撑宽。
- 用户验收测试简化；高级 WorldBook 协议测试改由开发回归承担。
- IndexedDB V14 / Backup V9 不变。

## V0.4.5.0 · WorldBook Engine V2 第一阶段

- 修正 selectiveLogic 数值语义；
- 实现 recursive scanning 与 exclude/prevent/delayUntilRecursion；
- 实现会话级 sticky / cooldown / delay timed effects；
- 实现多 inclusion group、groupWeight、groupOverride、useGroupScoring；
- 世界书显式 tokenBudget 开始在生成前执行，未设置预算时不擅自裁剪；
- 支持 Before/After Char、@D role/depth、Example Top/Bottom 与 Preset Outlet；
- Prompt Debug 新增 WorldBook Engine V2 命中链与预算诊断；
- 世界书编辑页可修改资源级 scanDepth / tokenBudget / recursiveScanning；
- PWA manifest 主题同步为白 + 极淡蓝；
- 将新一批公开小手机项目的架构学习结论写入长期文档；
- IndexedDB V14 / Backup V9 不变。

## V0.4.4.7.2 · docs 整理

- 49 份逐版本发布说明合并为 `RELEASE_HISTORY.md`；
- Community JSON / UI Priority / User Resolver 合并为 `COMMUNITY_RUNTIME.md`；
- 原“开发日志”与“聊天有用内容”合并为 `DEVELOPMENT_LOG.md`；
- 原“部署GitHub方法”重构为 `部署与更新.md`；
- 重写 `README / PROJECT_STATUS / ARCHITECTURE`，移除重复历史流水账；
- docs 根目录从 60+ Markdown 收敛到 10 份长期文档；
- 运行逻辑、IndexedDB V14、Backup V9 不变。

## V0.4.4.7.1

- 修复场景状态机 TS6133；
- 修复 Branch V2 Dexie 多表事务 TS2554；
- 功能与数据结构不变。

## V0.4.4.7

- Character / Conversation 分离；
- 自由开局；
- Branch V2；
- Presence 场景状态机；
- Action / Dialogue Parser V2；
- Author Text Status Header；
- Community UI Compiler V2 第一阶段；
- 白 + 极淡蓝主题。

## V0.4.4.6

- 严格纯手机投影；
- Natural Message Segmentation；
- User Message Ownership；
- 第二人称 user；
- Presence V2.1。

## V0.4.4.5

- Presence 与呈现方式解耦；
- 三种呈现；
- Active Resource Session；
- 大型资源续聊瘦身；
- Regex 容错。

## V0.4.4.4

- Raw Card → Local Index → Prompt Compiler；
- 原卡阅读器；
- Resource Intent Router；
- 按需模块休眠；
- Prompt Debug usage / 调度。

## V0.4.4.3

- Regex 回归后处理器；
- UI 格式失败保留正文；
- Safe Community UI Compiler；
- WorldBook / Regex 编辑能力。

## V0.4.4.1

- AI 内容权威；
- Token/context/quota 硬停止；
- 不使用本地角色化 fallback。

## V0.4.4.0

- 通用角色卡兼容内核；
- community card-first；
- 从角色特判转向协议兼容。

## V0.4.3.x

- Tavo / SillyTavern 资源；
- Raw archive + ResourceBinding；
- Community Persona；
- Safe Rich UI；
- Regex / 多开场 / 场景语义。

## V0.4.2.x

- 六层长期记忆；
- 主动陪伴；
- 场景距离；
- Persona；
- 角色卡创建期导入；
- Action / 双模式消息。

## V0.4.0 – V0.4.1

- 角色卡、WorldBook、沉浸 Prompt；
- 候选回复、分支、OOC；
- 互动协议与 Prompt Debug。

## V0.2 – V0.3.x

- 数据备份；
- 图片与多模态；
- 流式回复；
- 语音；
- 聊天组件化。

更早和更细的说明见 `RELEASE_HISTORY.md`。

## V0.5.0-alpha.4.4

- 将内嵌用户 Persona 导入升级为社区格式兼容识别，不再针对单张角色卡或单个姓名。
- 扩展 creator_notes / 世界书 / 社区 JSON 字段中的用户 Persona 语义标签。
- 支持同行 `[我的设定]...`、玩家/主控/自机标签及 `player_profile` 等对象字段。
- 保留 `user_personal_room` 等非 Persona 资源排除，并避免把“user 人设自拟”提示伪造成 Persona。
- 增加社区泛化与误判保护回归测试。
