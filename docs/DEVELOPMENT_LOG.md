## 2026-09-18 · alpha.5.1.11 Launcher Grid V5

- 根据真机截图重新定位白线：截图中 2px 竖缝的纵向长度与底部 `.g2` blur 光斑可见裁切高度一致，确认是 compositor seam；移除三层独立 blur glow DOM。
- 引入 4×6 `homeLayoutPages`，App/Widget 统一为带 x/y/w/h 的 Launcher Item。
- 边缘翻页使用手机内容视口内侧热区；最后一页允许 transient blank page，落下内容后才持久化。
- window 级 Pointer 收口，修复松手后继续跟随。
- 纯函数手工执行验证了旧 5.1.10 数据迁移、Profile 回第一页、Profile 独占新页三条路径。

## 2026-09-18 · V0.5.0-alpha.5.1.10｜Launcher 真机反馈第三轮

根据真机/浏览器截图继续修正：左侧竖白线在 5.1.9 仍存在，因此不再继续“隐藏 scrollbar”，而是删除产生原生滚动 UI 的技术路径。主屏改为 transform 页轨道，由 Pointer Events 同时支持触屏与鼠标拖动翻页。页数取消固定两页和手工创建空页，改为内容驱动；空页 normalize 时自动清理。桌面编辑页只负责 App/Dock 位置，不再承担页面实体管理。

## 2026-09-18 · V0.5.0-alpha.5.1.9｜Launcher 真机反馈第二轮

- 用户真机截图确认 alpha.5.1.8 仍有四个明确问题：左侧竖白线仍出现、编辑态整体下沉、只有逻辑分页但实际无法形成可用分页、音乐 App 图标与指定的小组件单音符不一致。
- 白线不再只靠 `::-webkit-scrollbar` 隐藏：主屏给 `PhoneFrame` 新增 `lockScroll`，外层 `.phone-content` 完全禁止滚动；每个 Home Page 也改为固定画布，不再创建纵向 scroll layer。
- 编辑菜单改为真正 overlay，删除 `.is-editing .hm-page-content{padding-top:226px}`，保证进入整理态不改变原布局坐标。
- 新增 `homePageKeys` 持久页模型；旧的一维 `homeAppKeys` 自动迁移成两页，不升级 Dexie。拖到第二页、边缘翻页后的归属会保存。
- 页面编辑器增加新增 / 删除 / 跳转页面；删除页面只合并入口，不删除任何角色、聊天、记忆或 App 数据。
- 音乐图标改成单音符，并让音乐 Widget 直接复用同一 AppIcon。
- 新增跨页拖拽回归测试；静态测试定义提升到 38 files / 316 declarations。

## 2026-09-18 · V0.5.0-alpha.5.1.8｜SullyOS 深度学习 + Runtime 吸收第一批

- 用户要求不要只学糯米机 UI，而要系统学习角色卡、世界书、记忆、Prompt、后台行为、备份等全部可借鉴处理。
- 阅读 SullyOS 官方 README、Launcher、Character Card 分享边界、WorldBook 类型与主动消息 2.0 说明；研究结果单独归档。
- Launcher：把 alpha.5.1.7 的“设置里选 App”继续升级为多页拖拽运行时，并修复嵌套滚动造成的竖向白线。
- Character Card：引入独立的共享安全边界，角色资产与发卡人的凭据 / Presentation 偏好 / Runtime 状态彻底分离；Import / Export 双向净化。
- WorldBook：不替换现有 Engine V2，而是扩大输入 Adapter，对 SullyOS 常见字段建立显式回归样本。
- Memory：开始使用已经存在却未充分参与检索的 confidence / hitCount 元数据，形成 Retrieval V2 第一批。
- 后续路线确定为 Context Inspector、统一 AgentAction / AgentActivity、Backup Zod + atomic validation、正式 HomeLayoutSchema。
- 当前容器无法完整 `npm ci`（npm cache 缺 `zod@3.25.76`），已做 TS / Vue script 静态语法检查；Windows `npm run verify` 仍是部署硬门禁。

## 2026-09-18 · V0.5.0-alpha.5.1.7｜主屏回归真实手机 / Widget 自定义

- 用户指出 alpha.5.1.6 过度收敛：音乐、海龟汤和底部 Dock 从桌面消失，主屏更像功能面板而不是手机。
- 对照用户真实 iPhone 主屏/编辑态截图，并补充研究 Apple Home Screen customization、Widgetsmith、Color Widgets、ScreenKit。共同点是：App 网格与 Dock 属于基础骨架；个性化通过壁纸、主题、Widget、图标与编辑态完成，而不是用常驻提示文案解释操作。
- 恢复音乐、海龟汤与 4 格 Dock；移除“长按桌面空白处可调整壁纸与图标”提示。
- 长按改为进入编辑态，提供“添加小组件 / 自定义 / 编辑墙纸 / 编辑页面 / 完成”，并增加图标轻微 jiggle / 移除入口。
- 新增 `homeAppKeys / dockAppKeys / homeWidgetKeys / widgetStyle`，复用 `appCustomizations`，IndexedDB V18 / Backup V12 不变。
- 「桌面与外观」升级为「桌面与小组件」，玩家可自行选择 App、Dock、Widget、壁纸和图标。
- 当前容器缺少 npm 离线缓存中的 `zod@3.25.76`，无法完整安装依赖；已做 TypeScript script 语法检查，完整 `npm run verify` 留给 Windows / CI。

## 2026-09-16 · V0.5.0-alpha.5.1.3｜追踪 API 拒绝来源

- 用户对照同一触发消息的两个渠道：OpenAI 兼容接口返回自述拒绝，DeepSeek 返回正常角色剧情。仅凭文本不能确认底层模型或网关责任。
- 新增仅观察的 API 响应诊断：HTTP 状态、finish_reason、结构化拒绝标记、文本启发式。客户端不更改提供商规则，也不增加成年角色恋爱禁令。
- JSON / SSE 兼容路径均携带诊断元数据；Trace 与导出报告展示结果，HTTP 错误仅保留状态码。
- 因容器 npm 离线缺少 zod 包，完整 `npm run verify` 待用户 Windows 运行。

## 2026-09-16 · V0.5.0-alpha.5.1.2｜发布菜单 ref 构建修复

- Windows alpha.5.1.1 Vitest 34/34、298/298 通过，但 vue-tsc 报 `showCreateMenu` 未声明的 5 处错误，导致构建中止。
- 恢复 `<script setup>` 中 `const showCreateMenu = ref(false)`；后续发布门禁必须包括 `npm run build` 而非仅 Vitest。
- 当前环境完整 npm 依赖不可用；等待 Windows `npm run verify` 验证。

## 2026-09-16 · V0.5.0-alpha.5.0｜Social Runtime V1

### 目标

把朋友圈从页面内即时模拟升级为可持久、可恢复的多角色社交调度，并为后续群聊准备统一社交事件模型。

### 架构改动

- IndexedDB V17 新增 `socialActivities`。
- `main.ts` 全局启动 Social Runtime，每 2.5 秒小批量消费到期活动。
- `MomentsView.vue` 删除发布后 `reactionTimers`；页面只提交用户动作并排队后续社交。
- 用户回复某角色评论后，写入 `moment-reply` 活动；被回复角色后续生成不再阻塞评论发送。
- 角色评论产生后，按热度与线程深度有概率安排其他角色继续回复。
- 自主角色动态也接入同一社交调度。

### 可靠性

- `dedupeKey` 防重复排队；
- `attempts + retry` 处理瞬时 API 失败；
- stale running 自动恢复；
- 删除动态/评论/角色同步清队列；
- 恢复备份清空社交队列，避免引用已替换的数据。

### Web 后台语义

浏览器/PWA 被系统真正挂起或关闭时，JS 无法可靠持续调用模型。因此“后台朋友圈”的产品语义为：离开朋友圈页面继续运行；App 被挂起期间任务持久保存，恢复/重开后补执行，而不是伪装成 OS 级永久后台。

### 验证

- TypeScript 5.8.3 `transpileModule` 检查修改 TS 与 MomentsView script：通过。
- 静态测试定义：32 files / 289 tests。
- 完整 Vitest / vue-tsc / Vite Build 等待 Windows `npm run verify`。

## 2026-09-13 · V0.5.0-alpha.4.5｜叙事人称连续性 / 默认 Persona 宏污染 / Lorebook User Profile

### 真实问题

- Prompt Debug 中角色卡明确要求对 `{{user}}` 使用自然第二人称，但生成旁白仍出现“她 / 女生”，而对白又使用“你”，造成同一轮叙事视角不稳定。
- 用户当前 Persona 显示为“我”。旧 Prompt Compiler 会把所有 `{{user}}` 宏直接替换为“我”，导致社区卡原文出现“与我年龄差”“我固定对应北柠”等系统视角混淆。
- 新样本的内嵌用户档案命名为 `{{user}}北柠设定`，正文包在 `<user_profile>` 中，并用 `{{user}}固定对应北柠:` 建立名字映射。旧评分器只强识别 `user人设/user设定/{{user}}人设`，因此该结构仍可能漏掉。

### Runtime 修复

- 新增“叙事人称连续性”规则：除非原资源明确要求第三人称，否则旁白/动作中当前用户固定为第二人称“你”；user profile 里的“她/他/TA”明确归类为资料描述。
- 默认 Persona 的“我/用户/User/匿名”等 UI 名不再替换 `{{user}}`；普通真实 Persona 姓名仍正常替换。Persona Prompt 同步声明“我”只是界面显示名，不是世界内专名或第一人称规则。
- Prompt Debug 增加人称锁分区和规则影响提示。

### 社区兼容修复

- Lorebook Persona 评分支持 `{{user}} + 任意姓名 + 设定/人设/档案/profile/persona`。
- `<user_profile>/<user_persona>/<player_profile>` 包装成为强 Persona 信号。
- 支持 `{{user}}固定对应/对应/即/就是/是 + 姓名` 的通用姓名映射。
- Character Card Editor 对旧角色扫描已绑定 Lorebook，恢复可安全识别的角色专属 Persona 预览。

### 验证

- 修改文件与新增测试通过 TypeScript 5.8.3 `transpileModule` 语法检查。
- 用本轮真实卡结构做独立正则探针：`{{user}}北柠设定` 得分 355（阈值 80），姓名映射得到“北柠”；普通“当前时间线”仅 25 分，不会误判为 Persona。
- 容器 npm 离线缓存缺少 `zod@3.25.76`，完整 `npm run verify` 留给 Windows/CI。

## 2026-09-13 · V0.5.0-alpha.4.4.1｜社区 Persona 归一化 + 发布探针清理

### Windows 实测暴露的问题

- `characterCardImportService.test.ts` 的通用社区对象样本中，`player_profile.年龄 = "29岁"` 已被正确识别为 Persona，但结构化 `age` 保留了单位，测试契约要求统一为 `"29"`。
- alpha.4.4 还误打包了开发期 `__communityCorpusProbe.test.ts`。该文件只用于容器里扫描 `/mnt/data/community_cards`，不属于产品测试，因此在 Windows 上必然报 `ENOENT`。

### 通用修复

- 新增社区 Persona 年龄/身高归一化：同时处理中文 `29岁`、`23岁（生日…）` 与英文 `31 years old`，以及 `172 cm`。
- `looksLikePersonaTemplateContent()` 增加英文结构化字段识别（name/age/gender/height/occupation/...），使 `user_profile/player_profile` 的英文对象也走同一语义兼容层。
- 本地 corpus probe 从正式测试目录删除；真实社区语料审计在发布前单独运行，不再依赖用户机器存在容器路径。
- 独立运行 49 份用户社区 JSON：32 份为角色卡并成功解析，17 份世界书/预设按资源类型拒绝；其中 17 份角色卡识别到独立用户 Persona。

### 数据兼容

- IndexedDB V16 / Backup V11 不变；无迁移。

## 2026-09-13 · V0.5.0-alpha.4.3.1｜CI Persona 年龄解析热修

### 真实问题

- Windows 本地 `npm test` 与 GitHub Actions 同时复现唯一失败：`characterCardImportService.test.ts` 期望 creator_notes Persona 的 `age === '23'`，实际为 `undefined`。
- 同一轮 `npm run build` 能成功并不能代表版本可发布：Windows PowerShell 会继续执行后续命令；GitHub Actions 的独立 `Run tests` step 则会在测试退出码 1 时直接阻断部署。

### 根因与修复

- Persona 文本为 `姜阮,女,23岁(生日12月3日),168cm,...`。
- `parseEmbeddedUserPersonaTemplate()` 的年龄兜底正则此前只允许“岁”后接标点/空白/文本结束，没有接受 `(` / `（` / `【` / `[` 作为字段边界，因此姓名、性别、身高可识别，年龄漏掉。
- 正则改为零宽 lookahead，接受常规分隔符和中英文左括号，同时不吞掉括号中的生日补充信息。
- 增加 `npm run verify = npm test && npm run build` 作为本地发布门禁。

### 数据兼容

- IndexedDB V16 / Backup V11 不变；无迁移、无清库要求。

## 2026-09-13 · V0.5.0-alpha.4.3｜朋友圈评论串 + 主控 Persona 导入修复

### 真实问题

- 截图确认朋友圈只能在动态层面发表评论，用户无法点某条角色评论继续“回复评论”；此前 AI 回评也固定由动态作者承担，社交结构偏单线程。
- 默认 `lively` 热度实际上常常只选中 1 位角色，所以即使通讯录有多人，用户动态也容易表现成“永远只有一个人理我”。
- 用户提供的褚焚川角色卡中，主控 Persona `姜阮` 明确写在 `creator_notes` 的 `[用户设定(...)]` 区块。旧导入器只扫描 extension / character_book / description / scenario，并且通用内联提取依赖 `{{user}}` 形式，因此创建页报告“有 {{user}} 剧情占位，但没有可安全提取的独立 Persona”。

### 实现

- `MomentComment` 增加非索引可选 `replyToCommentId`；Feed 层解析 `replyToAuthor`，UI 展示“甲 回复 乙：……”。
- 点按角色评论进入定向回复；用户回复保存引用，随后由被回复角色继续接话。Generation Prompt 会带上该角色上一条评论，明确这是“继续评论串”，避免重新评价整条动态。
- `planReplyCount()` 引入每档 `min`：lively 为 2～3，party 为 3～5；仍以候选角色数为硬上限。
- Character Card 导入新增 `extractLabeledUserPersonaBlock()`：只解析 creator_notes 中明确标注的用户/主控 Persona 区块，不把普通作者说明误识别为用户事实。
- Character Card Editor 同样从持久化 creatorNotes 构建 Persona 预览，因此旧角色可以原地修复并绑定，不需要删除历史会话。
- 用户提供的“小吟朋友圈小程序”世界书样本含 `$评论循环` 与“回复者 回复 被回复人”的嵌套评论表达；公开 InternalBeyond Circle 也已把发布 / 评论 / 回复 / 转发和逐 AI Circle 权限作为社交能力。我们吸收的是“评论关系与能力边界”，不复制其脚本/Prompt/UI。

### 验证

- 新增 3 个测试定义，静态矩阵 **30 files / 275 tests**。
- 对改动 TS 文件及两个 Vue `<script setup lang="ts">` 做 TypeScript transpile 语法检查通过。
- `npm ci --offline` 因当前容器缺少 zod 等依赖 tarball 无法安装，完整 `npm test` / `npm run build` 由 Windows 验收。
- DB V16 / Backup V11 不变。评论引用字段不建索引，Dexie schema 无需升级。

## 2026-09-13 · V0.5.0-alpha.4.2.1｜Windows Build Hotfix + 参考项目学习基线

### 输入

- Windows `npm test`：30/30 test files、272/272 tests 通过。
- Windows `npm run build`：唯一报错为 `HomeScreen.vue:142 TS2322`，浏览器 `window.setTimeout()` 的 `number` 无法赋给被 Node typings 解析出的 `Timeout`。
- 用户补充 10 个公开 GitHub 小手机项目与多组在线部署样本，要求后续开发用于毕业设计对比学习。

### 改动

- `HomeScreen.vue` 将 `longPressTimer` 显式声明为 `number | undefined`，保持浏览器定时器语义。
- 应用版本提升为 `0.5.0-alpha.4.2.1`；IndexedDB V16 / Backup V11 不变。
- 新增 `research/REFERENCE_STUDY_2026-09-13.md`，记录 StoryPhone、AI Virtual Phone、InternalBeyond、Melt、Miya、HiPhone、汪汪机等项目的可吸收工程思路与毕业前优先级。
- 明确参考原则：学习问题建模与工程边界，不复制第三方实现；后续优先 Runtime、Memory、Capability、测试与论文证据，不以 App 数量为目标。

### 验证

- 本环境已确认源码只发生预期的一行运行时代码类型修复，其余改动均为版本/文档。
- 容器依赖安装因网络长时间未完成，未宣称容器内完整 Vitest / Vite Build 通过。
- Windows 仍需重新执行 `npm test` + `npm run build`，再部署。

## 2026-09-13 · V0.5.0-alpha.4.2｜Community Chat Compatibility

本轮把“聊天消息内容由谁拥有”明确下来：**手机壳归 App，角色消息内部的作者 UI 归社区资源。** 不再为作者卡额外发明一套默认私有状态卡。

- `first_mes`、后续 AI 回复、WorldBook HTML、Regex UI 进入同一套 Presentation Contract 识别路径。
- 新增 Opening UI Runtime：读取角色卡、启用的 assistant-output / world-info Regex、Prompt Preset 与 WorldBook，判断开场应按哪一种作者 UI 呈现。
- WorldBook 已声明固定 HTML UI 时，纯文本/`<br>` 开场可由本地 Compiler 填入作者模板；只做呈现变换，不改 `rawContent`，也不生成剧情。
- 旧聊天中的 `isGreetingSeed` 会在加载时自动升级，避免必须重新建对话才能看到修复。
- 修复 `<br>` 变成 `&lt;br&gt;`；作者 HTML 根节点限制在手机宽度内；带 `<style>` 的作者 UI 不再被额外白气泡包裹。
- 聊天设置文案改成社区语义：默认“原卡 / 社区 UI”，纯聊天气泡和动作/台词拆分成为玩家显式覆盖选项。
- 增加 2 个 Community UI 测试；当前静态测试矩阵为 **30 files / 272 tests**。
- 当前容器完成 TypeScript/Vue script 语法检查，并用用户提供的苏玉尘 JSON 做本地 Compiler 实样回归；容器依赖目录不完整（`vitest` 不存在），完整 Vitest + vue-tsc + Vite Build 需在 Windows 验收。

## 2026-09-13 · V0.5.0-alpha.4.1｜主屏幕 / 美化 / 记忆入口标准化

本轮不继续发明新的桌面交互，而是对齐真实手机与现有“小手机”社区已经形成的使用习惯。

- 删除 Home 常驻“编辑”按钮；首页只承担 App Launcher 职责。
- 新增 `AppearanceSettingsView`，把壁纸、App 图标、图标大小、名称显示集中到 `设置 → 桌面与外观`。
- 主屏空白处长按作为快速入口，不再要求玩家先理解项目自己的“编辑模式”。
- `appCustomizations` 继续承担外观持久化；新增 appearance reserved row，但不新增索引，因此 DB 仍为 V16。
- 新增 `MemoryCenterView`，主屏“记忆”现在是真实一级 App；按角色汇总共享 / 当前聊天记忆与冲突。
- Chat Settings 只保留记忆行为设置，不再承担逐条 CRUD；完整记忆管理统一从 Memory App 进入。
- 参考 Miya、AI Virtual Phone、InternalBeyond / Lulu Phone 与 iPhone Home Screen 交互后，确立“Launcher / Appearance / Memory 三层职责”作为后续手机壳 UI 基线。
- 当前环境完成改动文件 TypeScript/Vue script 语法检查；完整 Vitest + vue-tsc + Vite Build 仍要求 Windows 验收。

## 2026-09-11 · V0.5.0-alpha.4.0｜Generation Runtime 第一阶段 + 左滑删除

- 冻结单轮 Generation Context，给异步生成建立稳定输入快照。
- Provider/Streaming 编排与 Response Persistence 开始脱离 `ChatRoom.vue`。
- Prompt Debug / Message 增加 generation provenance。
- ChatList 增加左滑删除，Conversation Runtime 增加完整删除计划与 branch/shared-memory 一致性处理。
- 新增 9 个测试，源码测试矩阵 30 files / 270 cases。
- DB V16 / Backup V11 不变。

## 2026-09-10 · V0.5.0-alpha.3.5｜App Icon + 多聊天记忆归属

- 首页 App 图标从 Emoji 占位升级为统一 SVG 图标系统，Dock 同步复用。
- 新增首页编辑模式与本地图标上传；图片裁切为 512×512 WebP，按世界保存。
- IndexedDB V16 增加 `appCustomizations`，Backup V11 纳入自定义图标。
- CharacterMemory 增加 `scope`：`character` / `conversation`。稳定事实、共同经历、承诺、关系默认跨聊天共享；主观与剧情默认局部。
- Chat Prompt 改为当前聊天 + 角色共享记忆；朋友圈发帖/回评读取角色共享记忆。
- rewind / branch / opening reset / 删除聊天保护 character-scoped memory。
- 记忆管理增加共享范围切换与三种视图。

## 2026-09-09 · V0.5.0-alpha.3.4.1｜聊天输入框布局热修

- 实机截图确认 ChatComposer 输入框被压缩到左侧约 40px。
- 根因不是 textarea 自身尺寸，而是 `src/assets/main.css` 的历史全局 `.composer { grid-template-columns: 40px 1fr 58px; }` 同时命中聊天组件根节点。
- 将聊天组件根类改为 `chat-composer`，显式单列、全宽布局，继续保留可自动/手动调整高度的输入体验。

## 2026-09-09 · V0.5.0-alpha.3.4｜真实手机化第二轮

### 目标

不再扩张 App 数量，优先把已有 Surface 从“网页卡片”收敛到接近原生手机的信息层级：列表用列表、设置用 grouped list、详情页用单一主操作，减少大圆角、强阴影和每页独立配色。

### 本轮修改

1. ChatList：搜索、时间、未读、预览与置顶统一成白底消息列表。
2. Contacts：新增本地搜索，“新建角色”作为原生列表入口，联系人采用标准行分隔。
3. Settings：按体验 / 角色与世界 / AI 与数据 / 关于分组，修复长期遗留的 V0.4.1 关于文案。
4. CharacterDetail：去粉化并统一资料卡、状态、操作按钮、会话记录、资源与原卡阅读器。
5. WorldCenter：资源库和 Regex Sheet 收敛到蓝灰色 Token，减少粉紫视觉噪音。
6. main.css：建立基础 Surface Token，统一导航栏和按压反馈。

> 设计原则：层级清楚、控件克制、文本可扫读；列表不做卡片墙，主操作只强调一个。


## V0.5.0-alpha.3.3.1

Windows 回归显示 alpha.3.3 仅剩朋友圈 guaranteed reply 的一个边界测试失败：`chance=1` 遇到测试随机源返回 1 时被误判为冷场。实现改为仅当 `chance < 1` 时执行概率淘汰，使 lively / party 在存在候选好友时语义上真正保证至少一位回应。

# 开发记录

## 2026-09-07 · V0.5.0-alpha.3.3｜真实手机感、输入与朋友圈互动

### 截图反馈

用户实机截图暴露五个高频体验问题：聊天输入框被工具按钮挤窄；首页/锁屏深紫壁纸偏离淡蓝基调；用户朋友圈发布后无人互动；消息编辑落到浏览器原生 `prompt()`，文本区又小又脱离手机壳；Community UI 虽能静态显示，但每条消息底部仍挂着安全阻止诊断。海龟汤截图还暴露了 Vue mustache 写在原生 `placeholder` 字符串里没有绑定的问题。

### 本轮修改

1. ChatComposer 改为全宽可扩展 textarea，下方放相册/相机/语音/发送工具栏；输入空间优先级高于按钮。
2. 新增 `ChatMessageEditor.vue`，长按消息 → 编辑后进入 App 内 bottom sheet，大文本区直接编辑 raw/rich 原文；保存后继续复用既有 Regex/runOnEdit 与重新生成语义。
3. Home/Lock 统一淡蓝乳白壁纸与深色状态栏；Dock、通知卡、标签同步改成适合浅色背景的玻璃层。
4. Moments 用户发布后的好友互动不再依赖“好友自主发动态”开关；默认 lively 至少一人回复，角色回评同时增加一个总点赞。
5. Moments 评论 composer 移除占宽头像，改成 `1fr + 66px` 发送布局，textarea 可纵向扩展。
6. SafeRichHtml 保持不执行第三方脚本，但取消可见的阻止诊断卡；脚本存在仅写入内部 data marker。
7. TurtleSoup 修正动态 placeholder 绑定，并把底部 composer 从悬浮大卡改成贴底原生工具栏。

### 参考产品原则

只学习交互原则，不复制第三方实现：微信式聊天优先保证输入与长按操作效率；虚拟手机桌面/锁屏要有统一壁纸与状态栏语义；编辑应发生在应用壳内而不是浏览器弹窗。

## 2026-09-07 · V0.5.0-alpha.3.2.1｜海龟汤引用热修

Windows 全量测试确认 alpha.3.2 的其余 26 个测试文件全部通过，唯一失败文件为 `turtleSoupService.test.ts`。11 个失败共享同一根因：`turtleSoupService.ts` 已开始调用 `appPresentationPolicy.ts` 的 `NATIVE_APP_TEXT_ONLY_RULE` / `sanitizeNativeAppText`，但漏写静态 import。

本版只补齐导入并同步版本文档，不扩大功能范围。目标测试矩阵保持 27 个文件 / 256 个用例。

## 2026-09-07 · V0.5.0-alpha.3.2｜聊天视觉回归与原生 App 呈现边界

### 用户反馈

用户明确要求两条视觉规则：第一，**聊天必须有 UI**，包括白色普通气泡与角色卡作者的 Community UI；第二，朋友圈、音乐、海龟汤等独立 App 已经有自己的页面，因此 AI 只产内容，不再在页面里生成一层 HTML/状态卡。整体风格回到淡蓝、白色、清新、简约，接近熟悉的 iOS / 微信层级。

### 实际修改

1. `ChatMessageItem.vue`：普通 AI 统一白色气泡，用户统一浅蓝气泡；降低边框/阴影强度，保留图片、语音、音乐、reply quote 等特殊消息语义。
2. `SafeRichHtml.vue`：新增 loose narrative 包装。富文本若同时包含作者 UI 与普通剧情正文，只给正文生成本地白色叙事气泡，作者 Surface 保持透明宿主，解决长剧情文字裸贴背景。
3. `ChatComposer.vue` / `ChatHeader.vue` / `main.css`：输入区、顶栏、Phone Shell 统一冷淡蓝 + 乳白体系，使用系统字体栈与半透明材质，减少装饰色。
4. 新增 `appPresentationPolicy.ts`：Native App 的模型输出禁止 HTML/XML/CSS/Markdown UI/按钮/状态栏/代码围栏，并提供确定性清洗 fallback。
5. 朋友圈：改成白底扁平信息流；行为设置折叠到 `•••`；手动动态支持最多 4 张本地图；AI 动态/评论仍只存自然语言。
6. 音乐 / 海龟汤：AI 内容改为名字 + 正文的 transcript，不使用聊天气泡；游戏允许一处短动作/心理，但 UI 永远由 Vue 页面负责。
7. 海龟汤 scenario JSON 的 title/situation/solution/hint 也经过原生 App 文本清洗，避免模型偶发 HTML 被展示成第二层界面。

### 验证

- TypeScript transpile/syntax：126 个 TS/Vue script 文件无语法错误；
- 当前静态规模：100 个生产 TS/Vue 文件，约 34,793 行；27 个测试文件，约 3,341 行；
- 当前测试定义：**256 个**；
- 由于容器 npm 依赖安装超时，本轮不伪称完整 Vitest / Vite Build 已通过，最终以 Windows `npm test` + `npm run build` 为准。

## 2026-09-05 · V0.5.0-alpha.3.1.1｜自主朋友圈补发边界热修

Windows 首次完整验收 alpha.3.1 得到 26 个测试文件中 25 个通过、244 个用例中 243 个通过。唯一失败位于 `autoPostCountDue()`：默认 `AUTO_MIN_INTERVAL_MS=30m`、`AUTO_BACKFILL_WINDOW_MS=3h` 时，精确离线 3 小时实现返回 1，但测试和产品文案都把“一个完整补发窗口”理解为应补 2 条。

修复策略不改 AI 调用频率安全边界：30 分钟仍只决定是否允许本轮产生第一条；额外补发按**总 gap / 3h** 的完整窗口数计算，最后继续被 `AUTO_MAX_BACKFILL=2` 截断。新增 12 小时离线仍最多补 2 条的回归用例，确保不会因为时间很长而产生无限补发/API 费用。


## 2026-09-04 · V0.5.0-alpha.3.1｜用户新增 App 审查、稳定化与视觉收口

### 输入

用户上传 alpha.3 RAR，新增朋友圈、一起听歌、海龟汤双模式、首页/锁屏视觉、模型 reasoning/maxTokens 等功能。本轮以这份用户源码为准做合并审查，不回退新增功能。

### 代码级问题与处理

1. `seedDatabase()` 把“角色数为 0”当成“新安装”，删光角色后会复活 4 个 demo；改为只对启动前连 World 都不存在的全新库播种。
2. `deleteMomentsByAuthor()` 在 `momentComments` 没有 `authorId` 索引时调用 `.where('authorId')`；改为 collection filter，DB 继续 V15。
3. `TurtleSoupView.sendQuestion()` push 当前 question 后再构造 history，导致 service 看到当前问题两次；改为先 snapshot history。
4. 自动朋友圈原本默认启用、最短 3 分钟、45 秒巡逻且无 in-flight guard；改成显式 opt-in、30 分钟最小间隔、3 小时 backfill、前台/在线、单请求链。
5. OpenAI-compatible 不再发送 DeepSeek 风格 `thinking` 扩展；DeepSeek provider 仍可显式关闭 reasoning。新增 2 个 Provider 测试。
6. 新增四个重页面改 route lazy import；PWA manifest 修正 GitHub Pages 子路径；首页无会话时回退展示已有角色。

### 美化

不重写模板，只在 scoped CSS 内建立主题层：朋友圈暖粉玻璃、音乐夜紫唱片、海龟汤玩家薄荷琥珀、主持页暖珊瑚；按钮补 active/focus-visible，reasoning checkbox 改移动端 switch。这样视觉有区分，但不会把样式耦合到全局 PhoneFrame。

### 验证

- `vue-tsc -b --pretty false`：通过。
- 当前源码：26 个测试文件 / 244 个用例定义。
- 容器里的依赖来自 Windows RAR，Rollup 缺 Linux native optional package，因此这里不伪称完整 Vitest/Vite Build 已跑过；Windows 必须再跑 `npm test`、`npm run build`。


## 2026-09-03 · V0.5.0-alpha.3｜Conversation Runtime 第二刀

### 本轮目标

可靠性基线之后，不立即拆 `requestAssistantReply()`，先把仍散落在 `ChatRoom.vue` 的 destructive lifecycle 收口：rewind/truncate、branch、greeting/free-opening reset 与节点状态重放。原因是 Generation Runtime 一旦拆分，会更依赖这些生命周期边界稳定。

### 实际修改

1. `conversationMutationService` 新增 `buildConversationTruncatePlan()` / `truncateConversationAfterMessage()`：锚点消息保留，旧 descendants 删除；锚点旧派生 automatic memory、StateHistory、节点后的 Prompt Debug 失效。
2. 新增 `conversationStateReplayService`：统一重放 greeting seed + StateHistory；区分 rewind 与 branch 对 thought/resource/lorebook timed effects 的继承规则。
3. 新增 `conversationBranchService`：分支复制与 ID remap 进入单一事务；不再由 View 自己拼 Message/Memory/StateHistory/Music。
4. 新增 `conversationOpeningService`：开场 seed 的 reset/write 事务与 free-opening reset 从 View 外移；free opening 现在也会清 Prompt Debug。
5. `ChatRoom.vue` 删除原 branch 大段复制逻辑、状态重建逻辑和 rewind 手工跨表清理，降到 4,576 行；`db.` 直接调用降到约 52 处。
6. 增加 6 个 Runtime 测试，用例总数从 149 增到 155，测试文件从 19 增到 21。

### 新发现并修正的数据边界

- 原 branch 会无条件复制 `sourceMessageId` 为空的 History，存在节点后的无来源状态穿越到旧分支的可能；alpha.3 只允许 cutoff 前的 source-less History。
- 原 branch 会无条件复制 source-less Memory；alpha.3 对 automatic memory 增加时间 cutoff，但 manual/imported memory 继续作为用户显式资料继承。
- 新分支中的 reply group 与 reply reference 重新映射本分支 ID；无法映射到分支前缀的 quote 不保留跨会话悬挂引用。

### 验收状态

本环境 npm 依赖安装超时，因此只完成新增 TypeScript 文件的语法/transpile 检查和 `git diff --check`。完整 `npm test` / `npm run build` 必须在 Windows 工作区执行；目标为 21/21 test files、155/155 tests。

## 2026-09-03 · V0.5.0-alpha.2.1｜修最后一个 Interaction Protocol 回归

### Windows alpha.2 真实结果

alpha.2 的兼容层修复基本成立：19 个测试文件中 18 个通过，149 个用例中 148 个通过。Character Card、Community UI、Regex、Tavo pipe、Conversation Mutation 等此前红灯已经全部转绿。唯一剩余失败：`scene-merged` 场景下，动作与对白应合并成一个剧情气泡，却被 alpha.2 新增的“保留显式多 text 边界”逻辑拆成两个。

### 根因与修复

alpha.2 把 `_hadProtocol && multiBubble` 直接作为 `preserveExplicitTextBoundaries`，条件过宽。两种产品合同其实需要同时成立：

1. 纯多 `text`（尤其带 typing pause）时，尊重模型明确的多气泡边界；
2. `scene-merged` 存在可见 `scene_action` 时，动作 + 对白仍然必须合成剧情气泡。

alpha.2.1 只收窄这个条件：**有可见 scene_action 时不启用 text-boundary preservation；无可见 scene_action 时继续保留显式多 text。**

本热修不动数据库、不动 Backup、不开始 alpha.3 的 branch/rewind Runtime 迁移，避免在测试未全绿时扩大改动面。

## 2026-09-02 · V0.5.0-alpha.2｜先清测试债，再继续拆 Runtime

### Windows alpha.1 真实结果

用户在干净 Git 工作区完成覆盖后，`package.json` 正确变为 alpha.1；新 Conversation Mutation 6 个测试全部通过；生产 Build 成功。与此同时，测试总计 149 个，暴露 7 个既有兼容层失败。

因此本轮不继续扩大重构面，先把这 7 个红灯逐项归因：

1. WorldBook JSON：资源识别过宽，把顶层 `name` 当成角色信号；
2. Community UI：HTML 模板 marker 的 `.{0,12}` 贪婪跨进 HTML，截成内层占位 div；
3. 多气泡：scene-merged 把明确多个 `text` 一起吞进 buffer；
4. Regex：旧社区测试样本有一层过度转义，原表达式无法命中；
5. Rich HTML：围栏边缘的字面 `\n` 没按格式空白处理；
6. World Info Regex：三个测试脚本都叫 `pipeline`，`applied: string[]` 无法区分 display-only 与其它命中项，属于测试 fixture 歧义；
7. Tavo 状态：pipe parser 只认真实换行，不认部分社区 wrapper 保存的字面 `\n`。

### 本轮原则

- 1/2/3/4/5/7 修实现，因为测试表达的产品语义仍正确；
- 6 修测试 fixture 名称，不改变 Runtime API；
- 不删除失败测试、不放宽成“只要不报错”；
- 不改 IndexedDB / Backup；
- alpha.2 验收全绿后，alpha.3 再继续 rewind / branch / greeting reset Runtime 化。

### 文档清理

alpha.1 只是让新源码包只保留 14 份长期 Markdown，但用户使用 `robocopy /E` 时旧文件仍会留在目标仓库。alpha.2 增加显式 cleanup：逐版本旧说明已经归档到 `RELEASE_HISTORY.md`，旧 Community 审计已经归档到当前/历史文档，因此构建前可以安全删除这些退休文件。

## 2026-09-01 · V0.5.0-alpha.1｜Conversation Runtime 第一刀

### 为什么先改 mutation，不先拆 generation

代码审查确认 `ChatRoom.vue` 最大风险不是单纯行数，而是删除、清空、rewind、branch、状态历史和记忆都各自维护跨表语义。直接拆 `requestAssistantReply()` 会在缺少事务安全网时放大回归风险，因此 V0.5 的第一刀先统一 Conversation mutation。

### 本轮实际修改

1. 新增 `src/runtime/conversation/conversationMutationService.ts`。
2. `deleteSelectedMessage()` 不再只 `bulkDelete(messages)`：自动清理对应 automatic memory / StateHistory，并清除其它消息的失效 reply quote。
3. 删除后按仍存在的消息与 StateHistory 重建 ConversationState，避免 UI 删除了消息但状态仍停在旧剧情。
4. 设置中的“清空聊天记录”改为“重新开始当前聊天”，删除自动剧情状态但保留手工/导入记忆。
5. `loadConversation()` 增加递增 epoch，解决 A/B 快速切换时 stale async load 覆盖当前 refs 的竞态。
6. 新增 6 个 Conversation Mutation 规则测试。
7. GitHub Pages workflow 在 Build 前执行 `npm test`，避免测试失败仍发布。
8. docs 做结构清理：`DEVELOPMENT_HISTORY.md`、`COMMUNITY_RUNTIME_HISTORY.md`、`ENGINEERING_AUDIT.md`、`research/REFERENCE_PROJECTS.md` 分离职责。

### 本轮刻意没有做

- 没有开始拆 `requestAssistantReply()`；
- 没有改 IndexedDB schema / Backup version；
- 没有改 Character Card / WorldBook / Regex / Community UI 协议；
- 没有假装完成 PromptDebugTrace 的精确消息级回滚：当前 schema 仍缺 `sourceMessageId`。

### 验收重点

- 删除一条产生过自动记忆/状态变化的用户消息后，相关自动记忆和状态历史必须同步失效；
- 手工/导入记忆必须保留；
- 重新开始聊天后旧自动剧情状态、Prompt Debug 不应残留；
- 快速连续切换两个聊天，最终 UI 必须与地址栏当前 conversation id 一致。

## 2026-08-30 · V0.4.7.1｜真实验收修 Community UI、呈现与 rewind

V0.4.7.0 上线真实测试后，四个问题被拆成独立责任层处理，而不是继续给单卡加 Prompt 特判：

1. 无 Regex 的作者状态栏卡已经给出 HTML 模板，但模型使用 `【状态栏】` 标题时本地 Compiler 未识别；扩展通用状态前导识别即可恢复作者模板。
2. 所有 rich 气泡统一透明会让没有自带背景的旧 `<details>/<br>` 开场直接浮在聊天底图；改成基于作者 HTML 是否自带视觉 surface 决定宿主背景，并兼容 Rich markup 内 Markdown 图片。
3. 纯手机多气泡“是否拆分”与“内容是否合理”必须分开：如果模型 raw packet 自己给出多条 text，应用不应假装是本地按句号拆分；但 Prompt 应要求这些 text 共同回应最新用户消息。动作/台词分开同理，本地不制造动作，只加强模型的 scene_action 合同。
4. 用户消息编辑以前故意不重算后续，但产品上缺少正常的 rewind 入口。现在用户消息支持从该节点重新回复；确认后删除后续旧消息、回滚失效状态/自动记忆/调试数据，再重放编辑后的用户事实。

生产实现仍无角色名、作者名、卡 ID、文件名特判。

## 2026-08-25 · V0.4.7.0｜深读其他小手机后重构 Regex / Renderer 边界

继续横向对照公开小手机与 SillyTavern 生态后，确认“角色卡/世界书/预设/Regex 是兼容底座，手机玩法是产品层”的方向。SillyTavern 当前 Regex 文档明确把 Affects、Depth 和 Ephemerality 分开；其他兼容前端也容易在只保留一个 `promptOnly` 开关时产生“屏幕改了、模型仍看到旧文本”的兼容缺口，因此本项目不再简化这层。

本轮抽样用户提供的社区资源，识别到的 Regex 以 `markdownOnly` 显示脚本为主，同时存在 `markdownOnly+promptOnly` 的隐藏脚本和少量永久用户输入变换。由此决定：

本轮对用户提供的社区资源包再次做元数据统计：可直接识别的 11 条 Regex 中，9 条是 `markdownOnly` 显示专用、1 条是 `markdownOnly+promptOnly`、1 条是永久改写；placement 以 AI 回复（2）为主，也有用户输入（1），并存在真实 `minDepth/maxDepth` 与 `runOnEdit`。这说明分离 Storage / Display / Outgoing Prompt 不是为单卡特判，而是与真实社区用法吻合。


1. canonical storage、display projection、outgoing prompt projection 必须独立；
2. promptOnly 按 placement 处理对应聊天消息/World Info，绝不能扫整个 system prompt；
3. HTML Regex 属于 Renderer，不应该因此改变 AI 历史；
4. 旧 native 空 placement 保留 AI-output 兼容，导入的社区空 placement 不擅自猜；
5. 主聊天没有 Slash/Reasoning runtime 时明确标记“字段保留、暂未执行”，不做伪兼容；
6. 用户无需手造 Regex 协议测试，开发回归负责四种 ephemerality、Depth、runOnEdit 与真实社区组合。
7. 出站 Prompt 不能在候选阶段用缺省 depth=0 过滤 `minDepth>0`；候选先按 source/phase 保留，真正 depth 必须在每条历史消息上执行。

保留本项目特色：Presence 与呈现模式独立、多聊天/Branch、Resource Session、六层记忆、Prompt Debug、Safe Community UI。

## 2026-08-23 · V0.4.6.0｜从“自创角色卡协议”转向生态兼容校准

### 决策

用户提供了大量公开“小手机 / 角色卡前端”参考项目。横向对照后决定：**角色卡 / WorldBook / Preset / Regex 这类生态底层优先学习成熟实现和 Character Card V2/V3 规范；本项目的差异化集中在手机交互、Presence、三种呈现、多聊天、Resource Session、Prompt Debug、记忆和 Safe Community UI。**

不采用“看到一张卡异常就给统一 Prompt 再加一句”的模式，也不为了追求功能数量推翻现有数据库。

### 本轮对照来源

底层语义优先核对：

- Character Card V2 Spec：`https://github.com/malfoyslastname/character-card-spec-v2`
- Character Card V3 Spec：`https://github.com/kwaroran/character-card-spec-v3`
- SillyTavern Characters / Prompts / Macros 文档：`https://docs.sillytavern.app/`
- roleplay-studio/character-card：V1/V2/V3 parser / builder 的字段分层实践

小手机 / 产品架构继续对照用户提供的 FLOAT、Miya、StoryPhone、InternalBeyond Mobile、Melt、Love Boat、弯弯机等公开项目。底层只有在“规范 + 多个成熟实现”方向一致时优先跟随；单个项目的特色玩法不会直接升级成项目协议。

### 本轮高价值校准

1. `creator_notes` 在 V2/V3 是作者阅读资料，不应混入角色 Prompt。
2. V2/V3 非空 `system_prompt` 是 override；`{{original}}` 用来嵌入前端默认 system。
3. V3 `nickname` 应成为 `{{char}}` 的角色名来源。
4. `first_mes / alternate_greetings` 是真实开场历史，不是 system 规则。自由开局时不应该从 first_mes 偷偷提炼永久格式。
5. Character Card V3 是 V2 的扩展，导入后再导出应尽量保持 V3 字段和未知扩展，而不是统一降级成 V2。
6. WorldBook 标准语义与真实旧社区脏数据要分开处理：标准优先，冲突数据只做窄兜底。
7. 作者 UI 应优先走作者世界书 + Regex + Renderer；正文已经成功时，确定性的 UI 连续性优先本地处理，不重复生成角色剧情。

### Community UI 新边界

对于 XML/Regex 状态 UI，本轮漏字段时先复用最近历史里 AI 自己已经生成的同名状态；不能从应用默认值推断好感、计划、心理。历史仍不足时，第二次调用改成只补作者状态标签的小请求，不再重发完整角色 Prompt/历史，也不重写第一版正文。这个能力是“状态继承 + AI 状态补全”，不是“本地角色生成器”。

## 2026-08-23 · V0.4.5.1｜真实 V3 卡回归暴露 constant/use_regex 语义错误

真实 `chara_card_v3` 样本出现 `WorldBook Engine V2：评估 11 条、初始激活 0 条`。核对原卡后确认 11 个启用条目均为 `constant=true`，同时均设置 `use_regex=true`。V0.4.5.0 错误使用 `constant && !useRegex` 判断常驻条目。

结论：`use_regex` 是 key matcher 的行为开关，不能改变 constant 的常驻语义。修复后这类卡的角色信息、背景、状态栏、手机格式等常驻规则重新参与 Prompt，固定状态 Regex/UI 也能恢复执行链。

同时记录产品测试原则：协议级组合测试由开发者自动/代码回归负责，普通用户只验证真实角色卡结果，不要求理解 Bessie/Rufus、Selective Logic 数值或 @D 位置参数。

## 2026-08-23 · V0.4.5.0｜参考项目学习与 WorldBook Engine V2

### 为什么这一轮先做 WorldBook

最近新增了一批公开“小手机 / AI 伴侣 OS”参考样本。它们的功能差异很大，但共同暴露了一个底层规律：当角色需要跨聊天、跨 App、跨时间保持连续性时，真正决定质量的不是“再加一个论坛/商城按钮”，而是上下文资源能不能按当前场景准确、节制、可解释地进入 Prompt。

因此本轮先把 WorldBook 从“导入字段”推进到“执行字段”。

### 参考样本（设计参考，不代表已实现同等功能）

GitHub / 源码：

- 汪汪机：`https://github.com/Liunian06/FlutterCppWangWangPhone`
- Love Boat：`https://github.com/qingzhouu/love-boat`
- 弯弯机：`https://github.com/wanonewan/wanwan`
- 叙事诗 StoryPhone：`https://github.com/Island-glitch/Poemnarapk`
- FLOAT：`https://github.com/xiaolongbao0709/ai-virtual-phone`
- PiggyPhone：`https://github.com/lw0129-jj/PiggyPhone.JJ-STAR`
- HiPhone：`https://github.com/ssochi/hiphone`
- Miya：`https://github.com/lixooo00-lab/mingruis-miya`
- InternalBeyond Mobile：`https://github.com/Sui-IB/InternalBeyond-Mobile`
- Melt：`https://github.com/EvenNetR/Melt`

在线页面 / 部署样本：

- 小心机：`https://xiaoxinchat.jia.ruiyaxin.xyz/`
- 小心机备用：`https://ruiruiyaxin.pages.dev/`
- 凛冬机：`https://todleffleiermyronwym-web.github.io/zimaos/`
- 蓝椰机：`https://todleffleiermyronwym-web.github.io/zmlanye/`
- 文件预览：`https://todleffleiermyronwym-web.github.io/lanye/`
- Love Boat Web：`https://loveboat.pages.dev/`
- Lavender Phone：`https://lavender-phone.pages.dev/`
- Plume：`https://rainmow52000.github.io/plume/`
- 手写卡辅助：`https://lucent-naiad-692171.netlify.app/`
- 代码辅助：`https://sparkly-halva-11dc2f.netlify.app/`
- 蓝椰备用：`https://heroic-wisp-712733.netlify.app/`
- Melt Web：`https://melt-eta.vercel.app`
- mf 机：`https://ubiqpiroshki-0b62ca.netlify.app/index.html`

`three-days-no-sleep` 目前只有关键词，没有唯一可靠仓库地址，因此只记为待核对样本，不编造链接。

### 学到的架构原则

#### 1. 角色运行时应高于 App

StoryPhone、Miya 等项目都把聊天、朋友圈、论坛、音乐等拆成多个功能模块。我们的长期结构也应是 Character Runtime 驱动多个 App Surface，而不是让 `ChatRoom.vue` 变成所有功能的宿主。

#### 2. 世界事实 / 通讯渠道 / 呈现方式必须分开

Miya / Plume 一类产品已经出现线上/线下作用范围或模式。我们的 Presence、微信/论坛 Resource Session、scene-merged/phone-text/phone-split 必须保持三个独立维度。

#### 3. 同一角色需要多 Conversation

Plume 等项目把“角色”和“聊天存档”分开管理。这与 V0.4.4.7 的 Character / Conversation 分离一致，后续继续保留 Branch、自由开局和多存档。

#### 4. 记忆不是越塞越多

StoryPhone 公开说明包含总结、关键词索引与 RAG；InternalBeyond Mobile 公开说明包含按预算自动注入、自然衰减和每个 AI 独立认知档案。我们的六层 Memory 应继续向“存很多、只召回当前相关少量”发展，而不是每轮把全部记忆发给模型。

#### 5. 主动消息必须走完整 Runtime

参考项目里的后台发信/主动提醒说明，主动消息需要携带角色记忆、世界书、时间与事件状态。应用可以调度，但不能用本地模板替角色写内容。

#### 6. App 能力需要权限边界

InternalBeyond Mobile 的日历/社交等能力区分读取与写入授权。这提示我们以后做“查手机 / 写日历 / 发朋友圈 / 购物”等功能时，需要 capability 层，而不是让模型默认看见/修改所有数据。

#### 7. Community UI 不应只在“执行 JS / 全部禁用 JS”之间二选一

StoryPhone 一类项目允许更强 HTML 互动，而我们的安全边界是不执行未知第三方 JS。长期方向是 Safe Capability Compiler：识别 Tab、折叠、数据绑定、按钮等常见意图，并用本地受控实现替代任意脚本执行。

#### 8. 本地优先可以继续

多个参考项目使用 IndexedDB / PWA / 本地导入导出。这证明当前 Dexie + Backup + PWA 不需要推翻；未来跨设备同步应是可选层。

### V0.4.5.0 实际落地

- selectiveLogic 数值语义纠正；
- recursive scanning；
- sticky / cooldown / delay timed effects；
- inclusion group / group scoring；
- 显式 token budget；
- Before/After Char、@D、Example Top/Bottom、Outlet；
- Prompt Debug Engine V2；
- 世界书资源级 Engine 设置；
- PWA manifest 白蓝主题同步。

### 仍然不做的事情

- 不按参考项目名称写产品分支；
- 不复制它们的角色设定、提示词或私有内容；
- 不因为别人执行第三方 JS 就放开我们的未知脚本安全边界；
- 不因为参考项目有某个 App，就假装本项目已经实现。

## 2026-09-13 · V0.5.0-alpha.4.4 社区 Persona 泛化

用户明确要求不能针对某一张卡做特殊修补。本轮以用户提供的社区资源包作为兼容语料审计，49 份可读取 JSON 中观察到多种用户 Persona 表达：世界书 `user人设/user设定/user基本情况`、creator_notes `[用户设定]/[我的设定]`、HTML 人物档案、对象型 `user_profile/player_profile`，以及应排除的 `user_personal_room`、`user人设自拟`。因此实现改为语义标签 + Persona 内容信号 + 误判排除三层策略，不包含特定角色名/用户名硬编码。


## 2026-09-16 · V0.5.0-alpha.5.0.2 正则语法热修复

Windows 完整 `npm run verify` 暴露出 alpha.5.0.1 的 `normalizePersonaNameToken` 在 `/u` Unicode 正则中使用 `\"`，属于非法 identity escape；Vitest/Rollup 在测试收集阶段直接失败。修复为字符类中的普通双引号字面量，保持 Persona 名称包裹符归一化语义不变。

## 2026-09-16 · V0.5.0-alpha.5.1 Social Runtime V2

在 V1 评论持久队列跑通后，将“谁来互动”从均匀随机抽样升级为可解释社交决策。没有重新引入关系积分；只读取已有会话更新时间、共享记忆、当前内容相关性和 Social Runtime 冷却，并叠加用户显式设置的角色社交权限/活跃度。UI 同步改为微信式简洁白底，并新增新互动通知。该候选选择层将作为后续群聊 Speaker Scheduler 的共用基础。

### V0.5.0-alpha.5.1.1 · 朋友圈封面与独立页面
- 将新互动、设置和每位好友权限从底部抽屉拆为独立路由；保持原 Social Runtime V2 行为。
- 用户朋友圈顶部增加自定义封面、本地图片校验压缩、恢复默认；存储复用世界级 appCustomizations，Backup V12 / IndexedDB V18 不变。
- 新增封面服务的边界单测，避免 SVG/远端 URL 与超大 base64 入库。


## 2026-09-17 · V0.5.0-alpha.5.1.6

- 按知间 UI 参考稿收敛四主标签、发现页、通讯录、我页和空间桌面。
- 新增「我 → 空间设置」及单角色可见/隐藏/黑名单管理。
- Social Runtime 增加整体 `private` 与黑名单执行前校验，避免只有 UI 隐藏、Runtime 仍在自动互动。
- 空间桌面从 9 个入口 + Dock 收敛到 6 个核心入口；音乐、日记、海龟汤仍保留代码和历史路由，不在当前桌面展示。
- 重做知间图标，去除双聊天气泡造型。
- 所有根目录逐版本 Markdown 移入 `docs/releases/`；参考项目文档移入 `docs/research/`；新增 2026-09-17 同类小手机研究文档。
- 重写 `docs/README.md` 和 `PROJECT_STATUS.md`，当前事实更新为 App alpha.5.1.6 / IndexedDB V18 / Backup V12 / 37 tests files / 308 test declarations。
- 当前容器 `npm test` 因 `vitest` 不存在无法执行；`npm ci` 尝试安装依赖超时。全局 `tsc --noEmit` 无报错；正式发布仍以 Windows/CI `npm run verify` 为门禁。


## 2026-09-18 · alpha.5.1.12
Launcher Grid V6 已将 App/Widget 统一为二维布局 Item，并推进 Character Card Import Report、WorldBook/Context Inspector、AgentAction capability boundary、Backup Zod preflight 与 HomeLayout Schema。WorldBook Inspector 已补逐条激活判定；Backup preflight 已扩到重复主键与主要跨表引用。
### 2026-09-18 · alpha.5.1.12 R2 build hotfix

Windows 首轮 `npm run verify` 显示 41 个测试文件 / 329 个测试均先通过，但 `vue-tsc` 在 Backup Zod 新代码处阻断构建：测试夹具缺少当前 `Message.worldId/status`，同时 Zod passthrough envelope 的窄 transport shape 被直接断言为完整 Domain 数组，触发 24 个 TS2352。R2 将此转换收口为单一 `asValidatedDomainRows<T>()` 边界，并保持真正的历史兼容迁移和 `assertBackupReferenceIntegrity()` 仍在破坏性 Dexie transaction 之前执行。没有数据库或 Backup 格式升级。



## 2026-09-18 · alpha.5.1.13 Launcher Flow Reorder

- 将桌面移动语义从 swap 改为 insert + reflow；App/Widget 共用同一搬运器。
- 增加拖拽时非持久化 preview，指针越过格子即重新计算目标页顺序。
- 增加 WAAPI FLIP 动画，其他项目会连续挤开/补位，形成更接近 iPhone 的果冻式反馈。
- 来源页只在本页补洞；目标页溢出才向后页级联，保持玩家人为分页。


## 2026-09-18 · alpha.5.1.14 Empty Page Reclamation Hotfix

- 根因不在持久布局压缩：`compactLayoutPages()` 已会过滤空页；问题来自 UI 层 `transientBlankPage` 可在拖拽结束后短路为稳定分页。
- 临时空页现在要求 `editMode && draggingId && transientBlankPage` 同时成立才渲染。
- 监听持久页数量变化并在非拖拽态夹紧 `currentPage`，覆盖移 Dock、隐藏 App、删除 Widget 等所有清空页入口。
- 新增回归：第二页只有一个 App，将其插回第一页后 `homeLayoutPages.length === 1`。


## 2026-09-18 · alpha.5.1.15 Ghost Page Self-Heal

实机反馈显示：第三个临时页可正常创建/回收，但第二页仍可能成为无内容的持久“幽灵页”。本轮将问题从单一 `items.length === 0` 扩展为完整的 Launcher 生命周期修复：

1. drag preview 只在实际 dragging 时渲染；
2. pointer finish 使用 try/finally 无条件清理 preview/transient state；
3. HomeLayout Revision 8 在 load 时压缩历史空页并回写；
4. UI 在非编辑/非拖拽状态下检查稳定页面是否真正渲染 Launcher item，无可见项目则触发持久自愈；
5. 显式删除 ghost page 时同步重算 App/Widget 清单，防止 normalize 将幽灵项目再次补回。
