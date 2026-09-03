# 开发记录

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
8. docs 做结构清理：`DEVELOPMENT_HISTORY.md`、`COMMUNITY_RUNTIME_HISTORY.md`、`ENGINEERING_AUDIT.md`、`REFERENCE_PROJECTS.md` 分离职责。

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
