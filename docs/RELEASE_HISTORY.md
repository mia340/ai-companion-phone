# 发布历史归档

> 本文件用于保存已经发布过的逐版本说明。  
> 当前使用说明请看 `README.md`，当前状态请看 `PROJECT_STATUS.md`，当前架构请看 `ARCHITECTURE.md`。  
> 这里的旧版本描述保持历史语境，不代表当前运行状态；数据库版本、限制和实现边界以当前文档为准。

# V0.4.4.7.2 · docs 整理

- docs 根目录由 60+ 份 Markdown 收敛为 10 份长期维护文档。
- 49 份逐版本说明完整合并到 `RELEASE_HISTORY.md`。
- 社区 JSON / UI / User Resolver 专题合并到 `COMMUNITY_RUNTIME.md`。
- 开发日志与早期聊天备忘合并到 `DEVELOPMENT_LOG.md`。
- README / PROJECT_STATUS / ARCHITECTURE 去除重复的逐版本流水账，只保留当前职责。
- 部署说明统一为 `部署与更新.md`。
- 运行逻辑、IndexedDB V14、Backup V9 不变。

---

## 来源：`V0.4.4.7.1_构建修复说明.md`

# V0.4.4.7.1 构建修复说明

## 版本

```text
应用：V0.4.4.7.1
IndexedDB：V14
Backup：V9
```

本版本只修复 V0.4.4.7 在 Windows `npm run build` 中暴露的两个 TypeScript 错误，不改变 V0.4.4.7 已完成的功能、数据库结构或角色卡兼容逻辑。

## 修复 1：TS6133

`deriveUserSceneTransition(text, previous)` 已接收上一轮 `ConversationState`，V0.4.4.7 中却未读取 `previous`，开启 `noUnusedParameters` 后构建失败。V0.4.4.7.1 让上一状态参与“状态切换 / 确认当前状态”的判断，不删除参数，也不退回永久锁定逻辑。

## 修复 2：TS2554

Branch V2 创建分支时需要在同一事务中操作 Conversation、Message、ChatSettings、ConversationState、Memory、StateHistory 和 MusicState 共 7 张表。Dexie 的位置参数 TypeScript 重载不能接受这么多表，因此改为项目中已经使用的表数组事务写法：

```ts
await db.transaction('rw', [tableA, tableB, ...], async () => {
  // branch snapshot writes
})
```

事务原子性与 Branch V2 行为不变。

## 更新后测试

先执行：

```powershell
npm run build
```

Build 通过后再继续 V0.4.4.7 的 10 项功能测试。不要因为本构建修复版重新导入角色卡、清 IndexedDB 或重新绑定资源。

---

## 来源：`V0.4.4.7_多会话场景状态与CommunityUICompilerV2.md`

# V0.4.4.7 多会话、场景状态机与 Community UI Compiler V2

## 版本

```text
应用：V0.4.4.7
IndexedDB：V14
Backup：V9
```

本版不升级数据库结构，不要求清库或重新导入角色卡。新增会话字段均为可选字段。

## 1. 通用兼容原则

本版继续禁止按角色名、作者名、卡 ID、文件名写生产特判。角色卡只作为 regression fixture；发现问题时修复其代表的 Character Card / WorldBook / Preset / Regex / Community UI 协议类型。

## 2. 同一角色支持多份独立聊天

角色卡是共享角色/资源，不再等同于一条唯一剧情。

```text
Character
  ├─ Conversation A
  ├─ Conversation B
  └─ Conversation C · Branch
```

角色详情新增：

- 继续最近聊天
- 新建聊天
- 当前角色的聊天记录列表

再次导入完全相同的原始角色卡时，会提示已有角色并建议直接“新建聊天”；用户仍可主动另存为独立角色。

## 3. 新聊天可以完全不使用 first_mes

只要角色卡存在开场，新建聊天会先选择：

```text
自由开局 / 不使用开场白
默认开场
备用开场 1
备用开场 2
...
```

自由开局只意味着 `first_mes` 不进入消息历史、也不被视为已发生剧情。角色 description/personality、WorldBook、Regex、Preset、Persona 绑定仍然正常使用。

`scenario` 是作者背景/建议场景，不得压过用户在自由开局或后续消息里明确建立的新当前事实。

## 4. Branch V2

“从这里创建聊天分支”现在复制分支节点之前的：

- 消息及 reply reference
- ChatSettings
- ConversationState
- ConversationStateHistory
- 当前节点之前可追溯的记忆
- Active Resource Session
- 音乐状态（新分支默认不自动播放）

新会话记录：

```text
parentConversationId
rootConversationId
branchFromMessageId
```

因此分支是一份真正独立的剧情档案，而不只是复制几条消息。

## 5. Presence 改为“当前状态”，不是永久锁

“自动 / 在身边 / 远程”只描述当前世界事实。手动选一次不会永久锁死后续剧情。

用户本轮明确动作会在请求 AI 之前触发 Scene Transition，例如：

```text
（回家）/ 我到家了 / 我先走了
→ remote

（上车）/ 来到你身边 / 走进你的办公室
→ together
```

`我想见你 / 我快到了` 等尚未真正完成位置变化的表达不会提前切换。

显示方式仍与 Presence 完全独立，因此以下组合都合法：

```text
同场 + 场景合并
同场 + 纯手机
同场 + 动作/台词分开
远程 + 场景合并
远程 + 纯手机
远程 + 动作/台词分开
```

## 6. Action Parser V2

结构区域优先保护：

- 状态栏
- 人物 / 在场角色 / 相对位置 / 衣着
- HTML / XML / 代码块
- 作者文本状态头
- 型号、饰品、地点备注

例如：

```text
写字楼门口（刚出来）      → 不是 Action
黑色领带（铂金领带夹）    → 不是 Action

（顿了顿，他声音低了几分）→ Action
（轻轻叹气）              → Action
（抬眼看向你）            → Action
```

## 7. Dialogue Parser V2

纯手机继续严格只显示角色真正可发送/说出的内容，但判断从“引号检测”升级为上下文感知：

```text
他说 / 问 / 回答 / 低声道 → Dialogue
发消息 / 回复 / 发来一句   → Dialogue

备忘录里写着               → 不是 Dialogue
文件上写着                 → 不是 Dialogue
屏幕显示                   → 不是 Dialogue
心里想着                   → 不是 Dialogue
```

如果模型本轮只有旁白，没有任何真实可发送语句，纯手机不会回退显示整段旁白。

Natural Message Segmentation 仍保持：连续独立短消息可拆为多个气泡；完整解释、道歉、安慰、告白和“小作文”保持一个气泡，不按句号机械切碎。

## 8. 作者文本状态头

类似：

```text
【地点∶北京｜酒吧】
【时间∶2025年4月16日，星期三，23∶00】
【季节∶春天】
【天气∶细雨】
【内心∶……】
```

归类为 Author Text Status Header，不等同于 Rich UI，也不等同于 Action。

字段分隔符统一支持常见 Unicode 形式：

```text
:  ：  ∶  ﹕  ︰
```

场景合并可保留作者文本格式；手机式呈现不把状态字段混进消息气泡。

## 9. User 叙事视角

默认继续用第二人称“你”指代当前 `{{user}}` / Persona。`first_mes` 偶尔使用“她/他/TA”只视为开场写法，不自动升级成后续持续人称合同。

只有角色卡 / WorldBook / Preset / System Prompt 明确要求第三人称 user 叙事时才覆盖默认规则。

## 10. Community UI Compiler V2 · 第一阶段

对可识别的“作者固定 HTML 外壳 + 状态信息 + 正文”合同，不再要求 AI 每轮重复整份 HTML/CSS。

```text
作者 HTML/CSS 模板
        ↓ 本地保存安全外壳
AI 一次生成
        ↓
状态字段 + 【正文】 + 可选作者栏目
        ↓
本地 Compiler 把 AI 已生成内容填回作者原模板
```

原则：

- 动态剧情、人物状态、心理、关系、NPC 内容仍全部由 AI 生成。
- 应用只做字段映射与模板填充，不编角色内容。
- 缺失栏目保持空，不本地补剧情。
- 第三方 JavaScript 仍不执行。
- 无法安全识别的模板继续走现有兼容降级路径。

目标是减少“AI 明明写了正文，但没复刻完整 HTML，所以又调用一次模型”的高 Token 不稳定链路。

## 11. 白蓝视觉主题

小手机主界面由旧粉色背景改为：

- 白色卡片 / 输入区
- 极淡蓝页面背景
- 淡蓝按钮与选中态
- 蓝灰文字与边框
- 保留危险操作所需的红色语义色

不修改社区角色卡作者自己提供的 HTML/CSS 配色。

## 12. 数据版本

```text
IndexedDB：V14
Backup：V9
```

不需要：

- 清空数据库
- 重新导入角色卡
- 重新导入 Persona
- 重新绑定 WorldBook / Regex / Preset

## 13. 本版重点测试

1. 同一角色新建两份聊天，互不污染消息/记忆/状态。
2. 新聊天选择“自由开局”，确认 first_mes 不进入历史。
3. 从中间消息创建分支，确认进入新聊天且原聊天保持不变。
4. 设置当前远程后发“（上车）”，请求 AI 前应切为同场；之后“我先回家了”应切回远程。
5. Action：`（顿了顿，他声音低了几分）` 应作为动作；状态栏括号备注不得成为动作。
6. 纯手机：备忘录/文件文本不得误当角色消息，真正“发来/回复”的内容必须显示。
7. 古彻明类 `【地点∶...】` 文本状态头在场景合并中保持，手机式呈现不混入消息。
8. 第三人称开场后继续聊，没有明确第三人称协议时应优先使用“你”。
9. 作者强制 HTML 状态 UI 在场景合并中应尽量由 Compiler V2 恢复，不应因为单纯缺 HTML 外壳再发第二次 AI。
10. 检查整体小手机背景已变为白 + 很淡的蓝色。

---

## 来源：`V0.4.4.6_纯手机呈现、人称与消息所有权修复.md`

# V0.4.4.6｜纯手机呈现、人称与消息所有权修复

## 版本信息

```text
应用：V0.4.4.6
IndexedDB：V14
Backup：V9
```

本版不升级数据库，不需要清空数据，不需要重新导入角色卡、Persona、WorldBook、Preset 或 Regex。

---

## 一、通用兼容原则

本版继续把社区角色卡当作“协议测试样本”，而不是生产条件分支。

生产代码禁止按以下信息写特判：

```text
角色名
作者名
角色卡 ID
来源文件名
某一张测试卡名称
```

所有新增行为只依据：

```text
Character Card 原字段
WorldBook / Lorebook 元数据与作者触发规则
Preset / System Prompt
Regex 结构与 placement
社区 HTML / structured markup
Persona / {{user}}
当前场景证据
用户主动选择的聊天呈现方式
真实聊天历史中的消息归属
```

目标不是“兼容某几张卡”，而是让同一类社区协议一次修复、同类卡一起受益。

---

## 二、纯手机消息重新定义：可见层只能有角色真正发送的语句

`phone-text` 不再尝试保留任何作者状态 UI 外壳。

用户可见聊天流只允许：

```text
角色真正发送 / 说出的 text
```

以下全部不显示：

```text
动作
旁白
心理
状态栏
日期 / 时间 / 地点 / 天气
好感度 / 人物面板
原卡 HTML / XML 状态 UI
场外观众席
角色互动栏
Action 卡
Sidecar
社区状态说明
```

这些信息如果 AI 已经生成，仍可用于后台场景判断、状态更新、Prompt Debug 和原始输出归档；“不显示”不等于伪造或删除世界事实。

### 场景合并

`scene-merged` 继续承担最接近原社区卡 / SillyTavern 的沉浸 RP 呈现：作者强制 UI、动作和对白可以保持原结构。

### 动作 / 台词分开

`phone-split` 只显示两类内容：

```text
scene_action
角色 text
```

状态栏 / HTML 状态面板同样不插入聊天流。

---

## 三、Natural Message Segmentation｜自然消息分段

纯手机模式不再“一句话一个气泡”。

规则：

```text
作者 / 模型已经明确给出多个 text
→ 尊重这些真实消息边界

明显是连续几条独立短消息
→ 可以拆成多个普通气泡

长解释 / 道歉 / 告白 / 安慰 / 小作文
→ 保持一个完整气泡
```

本地不会按句号机械切分，不改写文字，也不会为拆气泡额外调用 AI。

---

## 四、User Message Ownership｜用户消息所有权

社区微信、短信、群聊、邮件、私信等模板常同时提供“对方消息”和“自己消息”示例。

V0.4.4.6 新增通用约束：

> AI 不能为了填社区模板而伪造用户从未发送过的新消息。

作者 HTML 如果明确标注：

```text
自己消息
用户消息
我方消息
user message
self message
```

该区块只有在内容能对应真实用户历史消息时才允许保留。

在纯手机模式下，如果模板同时明确标注“对方 / 角色 / assistant 消息”，运行时优先抽取这些角色侧消息，用户侧示例和模板时间戳不会进入可见气泡。

这是消息归属保护，不针对某一种微信模板。

---

## 五、结构化状态栏括号不再误判 Action

旧逻辑容易把所有圆括号都看成动作，导致：

```text
相对位置：写字楼门口（刚出来）
衣着：黑色领带（铂金领带夹）
```

被错误拆成：

```text
Action：刚出来
Action：铂金领带夹
```

V0.4.4.6 改为“动作语义 + 所在结构”双判断。

以下区域中的括号备注不会再转 Action：

```text
日期 / 时间 / 地点
人物 / 在场角色
相对位置
衣着 / 穿着
关系 / 内心 / 状态
代码块
HTML / HTML 注释
结构化 UI 字段
```

而独立、确实有动作语义的：

```text
（点头）
（抬手替你拢好围巾）
```

仍可以作为 scene_action。

---

## 六、User Viewpoint｜默认回到第二人称“你”

角色卡首条开场使用“她 / 他 / TA”不再自动决定后续用户人称。

默认规则：

```text
叙事中的当前 Persona / {{user}}
→ 使用第二人称“你”
```

只有角色卡、WorldBook、Preset / System Prompt **明确规定**第三人称叙事 user 时，才覆盖这一默认。

也就是说：

```text
开场写“她抬头看他”
≠
后续永远必须叫用户“她”
```

文风连续性与用户叙事人称正式解耦。

---

## 七、Presence V2.1｜结构化人物 / 相对位置进入同场判断

自动相处状态继续增强对社区状态栏的理解。

新增识别：

```text
人物：
在场人物：
在场角色：
地点：
相对位置：
衣着：
```

例如状态栏出现：

```text
人物：我，角色，大门保安
相对位置：我站在写字楼大门口，角色站在我面前
```

当当前 Persona 为“我”时，可作为强同场证据。

这里不会简单把所有“我”都认作 user，而是结合 Persona、角色名、在场信息和相对位置语义处理。

---

## 八、纯手机仍保存原始 AI 输出

纯手机投影后的气泡只保存用户真正应该看到的角色语句，但第一条可见 assistant 消息同时保留 `rawContent` 作为原始 AI 输出归档。

`rawContent` 不会因为是普通文本消息而重新注入未来 Prompt；当前 Prompt 仍使用可见消息内容。它主要用于调试、回溯和以后更安全的本地结构解析。

---

## 九、Prompt Debug 与可见输出对齐

自然度检查改为针对最终用户可见投影，而不是对已经被纯手机模式隐藏的状态栏 / HTML / 旁白继续评分。

Prompt Debug 仍保留：

```text
原始输出
用户看到的回复
API 实际 Token
资源调度
场景判定
```

因此可以直接比较“模型真正返回了什么”和“纯手机最终显示了什么”。

---

# 如何更新

## 1. 解压源码

把：

```text
ai-companion-phone-v0.4.4.6.zip
```

解压到：

```text
D:\ai\ai-companion-phone-v0.4.4.6
```

确认目录中直接存在：

```text
package.json
src
docs
scripts
public
```

不要出现二层同名套娃目录。

## 2. 覆盖 Git 工作目录

PowerShell：

```powershell
cd "D:\ai"

robocopy `
  ".\ai-companion-phone-v0.4.4.6" `
  ".\ai-companion-phone-git-clean" `
  /E `
  /XD .git node_modules dist `
  /XF "*.tsbuildinfo" `
  /R:2 `
  /W:1
```

最后必须确认：

```text
失败        0
```

## 3. 检查版本

```powershell
cd "D:\ai\ai-companion-phone-git-clean"
Select-String '"version"' package.json
```

应看到：

```text
"version": "0.4.4.6"
```

---

# Build

```powershell
npm run build
```

正常应经过：

```text
prebuild
vue-tsc -b
vite build
PWA generateSW
```

结尾应有：

```text
✓ built in ...
dist/sw.js
```

`Some chunks are larger than 500 kB` 是性能 warning，不是失败。

只要出现：

```text
error TSxxxx
```

先不要 commit / push，把完整 build 日志发回。

---

# V0.4.4.6 专项测试

## 测试 1：纯手机必须只有语句

选择一张会输出状态栏 / 动作 / HTML 的社区卡，把：

```text
聊天呈现方式 → 纯手机消息
```

发一轮普通消息。

预期用户可见区域：

```text
只有角色语句气泡
```

不得出现：

```text
状态栏
日期地点
Action
HTML 卡
旁白
心理
角色互动 / 场外观众席
```

Prompt Debug 可以继续看到完整原始输出。

## 测试 2：短消息自然多气泡

让角色自然连续发几句很短、彼此独立的话。

预期：可出现 2～4 个普通角色气泡。

不得按每个句号强拆。

## 测试 3：小作文保持一条

给角色一个需要认真解释 / 道歉 / 安慰的问题。

预期：一段完整长消息仍然可以保持一个大气泡，不被切碎。

## 测试 4：社区微信不能替用户编消息

进入带双方消息示例的社区聊天资源。

预期：

```text
角色侧消息正常出现
真实用户历史消息可按作者 UI 引用
AI 新编的“自己 / 用户 / 我方”消息不得成为真实用户气泡
```

纯手机模式下只显示角色侧语句。

## 测试 5：状态栏括号不能变 Action

找一张包含类似：

```text
相对位置：门口（刚出来）
衣着：领带（领带夹）
```

的卡。

预期：

```text
“刚出来”不是 Action
“领带夹”不是 Action
```

独立的：

```text
（点头）
```

仍可在“动作 / 台词分开”模式显示为 Action。

## 测试 6：第二人称

找一张开场用“她 / 他”代称 user 的卡，继续聊一轮。

预期：默认后续叙事回到“你”。

如果原卡 / WorldBook / Preset 明确要求第三人称，则尊重作者明确规则。

## 测试 7：结构化同场

当前 Persona 使用状态栏中出现的 user 名称或“我”，并让状态栏出现：

```text
人物：我，角色
相对位置：角色站在我面前
```

预期聊天设置显示：

```text
自动 · 当前：在身边
```

Prompt Debug 场景判定应为同场。

## 测试 8：场景合并回归

切回：

```text
场景合并
```

作者强制状态 UI / Regex / HTML 应继续正常呈现，不能因为纯手机改造而被全局关闭。

## 测试 9：动作 / 台词分开

切换：

```text
动作 / 台词分开
```

预期：

```text
真正动作 → Action
角色语句 → 普通消息气泡
状态栏 / HTML 状态面板 → 不进入聊天流
```

## 测试 10：论坛 / Regex 回归

调用已有 Regex → HTML 资源。

预期仍是：

```text
Resource Focus
→ Regex 命中
→ Safe Rich UI
```

不能被本轮纯手机代码破坏场景合并模式下的社区 UI。

---

# 测试通过后 Git

先：

```powershell
git status
```

再：

```powershell
git add .
git status
```

确认进入：

```text
Changes to be committed:
```

提交：

```powershell
git commit -m "refactor: 纯手机呈现与消息所有权修复 v0.4.4.6"
```

最后：

```powershell
git push origin main
```

如果只是：

```text
Failed to connect to github.com:443
```

且 commit 已成功，不要重新 commit，只等网络恢复后再次：

```powershell
git push origin main
```

---

# 部署

当前仓库如果继续使用 GitHub Pages / Actions 自动部署，则 push 成功后查看 GitHub Actions。

部署完成后至少在正式站再测一次：

```text
纯手机普通聊天
纯手机长消息
社区微信消息所有权
场景合并原卡 UI
动作 / 台词分开
刷新页面后历史与设置保存
```

---

## 已知边界 / 下一步

第三方作者 JavaScript 仍不会直接执行。后续继续通过 Safe Community UI 编译器实现可证明安全的 tabs / data-target / 静态数据绑定等常见交互。

WorldBook Engine V2 仍是后续核心：recursive scanning、sticky/cooldown、group scoring、depth/position 与真正的生成前 Token Budget。

---

## 来源：`V0.4.4.5_相处状态呈现与资源会话修复.md`

# V0.4.4.5：相处状态、聊天呈现与资源会话修复

本版不新增数据库版本，重点修复 V0.4.4.4 实测暴露的三类边界：场景事实与排版混用、按需资源无法连续使用、社区 UI 因确定性格式差异触发额外 AI 调用。

## 1. 相处状态与聊天呈现拆开

`presenceMode` 继续只表示“是否同一现场”；新增 `conversationPresentationMode`：

- `scene-merged`：动作与台词同气泡，默认。
- `phone-text`：只显示语句，scene_action 不进入可见消息。
- `phone-split`：动作与台词分开。

社区角色卡自己的固定 HTML / Regex / 状态栏始终高于这三种普通聊天呈现设置。

## 2. Presence V2 补强

自动判断新增：

- 当前 Persona 姓名出现在 `😶在场角色` / 周围信息中。
- `垂眸看着你`、`凝视你`、`盯着你` 等自然近距离语义。
- 给用户披衣、直接身体接触等明确只能同场发生的动作。

手动 together / remote 仍具有最高优先级。

## 3. Active Resource Session

显式打开作者按需资源后，会话状态记录当前 `LorebookEntry`。例如：

```text
给角色发私聊：我到家了
→ 首轮 Focus 私聊模块

喝啦
→ 资源会话延续：私聊模块

回到普通聊天
→ 退出当前资源会话
```

大型功能模块续聊不再重复注入整份 HTML 说明书，而是保留作者原始入口规则和一段会话延续指令；剧情内容仍完全由 AI 根据原卡与聊天上下文生成。

## 4. Regex 本地结构容错

当作者 Regex 明确使用方括号而模型仅把结构括号写成中文全角样式时，运行时会在 Regex 输入视图中兼容：

```text
【折叠标题：...】 → [折叠标题：...]
【主题：...】       → [主题：...]
```

作者 Regex、AI 原始输出、存档内容均不被改写，也不会为此重新请求 AI。

## 5. 社区 HTML 确定性本地修复

若原卡定义 exact HTML template，而 AI 已经生成至少三项状态事实 + 正文，仅漏掉 HTML 外壳，本地可把这些已有内容重新装回作者模板。没有生成的“角色互动 / 场外观众席”等内容只保留空栏目，不添加本地剧情。

只有本地无法确认问题纯属格式时，才保留一次真实模型纠偏路径。

## 6. 数据版本

- App：V0.4.4.5
- IndexedDB：V14（不变）
- Backup：V9（不变）

---

## 来源：`V0.4.4.1_AI内容权威与Token硬停止.md`

# V0.4.4.1 · AI 内容权威与 Token 硬停止

## 目标

这一版把“谁负责生成角色内容”收口成单一原则：**角色台词、动作、心理、情绪、关系感受、主动消息与剧情推进只允许来自真实 AI + 原角色卡资源。小手机只组织上下文、调用模型、解析协议、渲染 UI、保存结果，不再生成角色化兜底内容。**

## AI 是唯一角色内容作者

- 删除可选 Mock Provider 与“接口失败时本地回复”开关。
- 旧 `mock` 配置仅用于数据库迁移识别；升级后改为真实 API 配置入口并清空 Key，不会继续生成本地回复。
- API / 网络失败时整轮停止；不会切换本地模型，不会补写台词、动作或心理。
- 流式请求异常时，除用户主动点击“停止”外，不再保存半截角色回复；刷新、崩溃或断线遗留的 `pending` assistant 消息会在恢复时删除。
- “心里的小角落”刷新统一调用真实 AI；AI 失败时保留原状态并显示错误，不用本地“平静 / 正在……”等模板补写。
- 新会话默认关闭主动消息；只有用户显式开启“小手机增强 + 主动消息”后，本地才负责决定“是否到达一次询问 AI 的时机”，具体要不要联系、说什么完全由 AI 根据角色卡与上下文决定；AI 可返回 `<no_proactive_message/>` 静默放弃。
- `自动识别` 对所有角色（包括小手机原生角色）都保持 AI / 原卡原样输出；只有用户明确选择“小手机增强”时才允许额外消息整形或隐藏互动协议。
- 小手机互动协议只提供结构，不提供可照抄的角色台词或动作。
- 移除角色回复后的本地“用户事实纠偏重写”链路；应用不再基于本地语义规则二次改写 AI 台词。原卡 UI / Regex 的结构校验仍保留。

## Token 硬停止

支持识别以下情况：

- Provider 返回 `finish_reason=length` / `max_tokens`；
- Provider 明确报告上下文窗口不足；
- Provider 明确报告 Token / quota / credit / balance 不足；
- OpenAI-compatible 接口返回 HTTP 402（常见余额/额度耗尽）；
- 少数兼容接口不返回 `finish_reason`，但 `completion_tokens` 正好打满本轮 `max_tokens`。

一旦命中：

1. 立即把本轮视为失败；
2. 删除流式占位和已经出现的半截文本；
3. 不写入不完整角色消息；
4. 用户消息标记为失败，可在调整 Token / 上下文 / API 后重试；
5. 明确显示 Token / 上下文 / 额度错误；
6. 不自动续写，不使用本地内容继续。

用户主动点击“停止”属于明确的人为中断，已出现的真实 AI 内容仍允许保留；这与 Token 截断不同。

## IndexedDB V13 清洗

V13 做一次 AI-only 数据迁移：

- 删除历史 Mock / 本地 fallback 角色消息；
- 删除历史本地生成但没有真实 provider 的主动消息；
- 从剩余消息移除旧 `fallback` 元数据；
- 删除 `fallbackToMock` / `autoFallback` 设置；
- 删除旧 `relationships` / `relationshipEvents` 本地关系积分 stores；
- 清空来源无法可靠区分的旧心理/关系/剧情派生字段（包括 unresolvedTopics、pendingEvents、shortTermGoals 等），之后只由角色卡明确值或真实 AI 重新生成；
- 删除 Mock Prompt Debug 痕迹；
- 旧 Mock 模型配置迁移到 DeepSeek 配置入口，但 API Key 为空，必须由用户配置真实接口。

Backup V9 仍可读取历史 `relationships / relationshipEvents` 字段，但 V13 恢复时会忽略这些旧本地关系积分数据。

## 不属于“本地生成角色内容”的功能

以下能力仍保留，因为它们只处理结构或作者原资源，不替角色写内容：

- 角色卡 / WorldBook / Preset / Regex / Depth Prompt 注入；
- `{{user}} / {{char}}` 宏替换；
- 原卡 HTML / XML / Regex UI 的安全解析与渲染；
- presence / 标签 /结构化字段解析；
- Prompt 中的用户事实边界提示与原卡安全格式校验；
- Prompt Debug、消息状态、Token 错误提示。

## 版本

- 应用：V0.4.4.1
- IndexedDB：V13
- Backup：V9

---

## 来源：`V0.4.4.0_通用角色卡兼容内核与数据库清洗.md`

# V0.4.4.0 · 通用角色卡兼容内核与数据库清洗

这次不是为某一张测试角色卡继续加例外，而是把角色卡导入、运行时、UI、Persona、世界书、Regex、消息整形和 IndexedDB 统一改成“原卡优先”的兼容内核。

## 核心原则

1. **原卡优先**：社区导入角色在 `auto` 模式下默认使用 `card-first`。原角色卡、世界书、Regex、Depth Prompt、Preset/扩展约束优先于小手机自己的互动协议。
2. **不猜角色设置**：导入时不再补“朋友 / 初识 / 平静 / 正在等待 / 远程 / 主动性 / 动作比例 / emoji 频率”等应用默认角色值。
3. **有 UI 才按 UI**：只有结构上真的检测到原卡 HTML/XML/Regex/固定输出协议时才接管 Rich UI；普通角色卡保持普通文本，不由小手机自造状态栏。
4. **世界观与 App 外壳隔离**：小手机是产品界面，不等于角色世界里存在手机。原卡没有现代设备时，不注入“看手机屏幕 / 聊天软件 / 手机震动”等剧情动作。
5. **未知字段无损留档**：不能识别的社区扩展字段不会擅自解释或丢弃；原始 JSON/PNG metadata 继续保存在角色卡 archive 中，便于后续兼容器升级。
6. **功能增强显式可选**：用户可以手动切到“小手机增强”，但原卡存在固定 UI/输出协议时仍优先保护原卡结构。

## 通用导入层

- 支持 SillyTavern V2/V3、Tavo、常见旧 JSON、无 spec 的社区 JSON、PNG Character Card metadata。
- 字段通过别名映射读取，不依赖角色名。
- V2/V3 判断不再把任意 `version: 2/3` 当成 Tavern 版本；必须有角色卡结构/spec 信号。
- PNG 卡面会作为角色头像保存；JSON 中无法解析的相对头像路径仍保留原引用，避免无损信息丢失。
- 没有角色姓名但有有效角色数据时，文件名可作为兼容 fallback。
- `description` 与 `personality` 分开保存，不再合并后丢失作者语义边界。

## Community Persona Extractor

角色专属 `{{user}}` 不再依赖单一写法。会从 description、scenario、creator notes、system prompt、post-history instructions、扩展字段及内嵌世界书中统一寻找高置信 Persona，同时排除房间、座驾、衣橱、NPC、普通剧情句等误判。

无法安全确认用户姓名时：

- 保留原卡 user 设定；
- 使用当前聊天 Persona；
- **不猜名字，不覆盖全局资料**。

## UI / Regex 运行时

- 结构检测，不按角色名检测。
- HTML contract、structured contract、Regex→HTML contract 各自独立校验。
- opening-only Regex 不会劫持后续每轮回复。
- 原卡有固定 UI 时，禁止小手机私有协议二次切分/改写作者输出。
- 任意第三方 JavaScript 仍不直接执行；只对已识别的安全交互做本地 Runtime 映射。

## 消息与场景

- 普通文本默认整轮一个消息块，不按句号、引号、换行机械拆气泡。
- `presence=auto` 从“未知”开始，不默认远程。
- 直接身体接触和明确同场证据可覆盖历史 remote；明确分隔两地才判 remote。
- 用户可见状态统一解析 `{{user}} / {{char}}`，模板变量不直接漏到 UI。

## IndexedDB V12

V12 是通用清洗迁移，不按社区角色姓名匹配：

- 清理孤儿会话设置、消息、记忆、关系事件、状态历史、Prompt Debug、资源绑定；
- 移除社区角色旧版小手机关系积分状态；
- 移除旧版占位心情/活动/无证据 remote；
- 清除社区卡曾被应用自动写入的主动性、动作风格、emoji/question 频率；
- 清除社区会话旧版小手机 `roleCardUi` 元数据，保留原始正文/rawContent；
- 删除旧的精确“看手机屏幕”合成 Action；
- 清理旧 Persona 自动注入的应用边界文案；
- 归档补齐 `characterId`，过滤失效资源 ID；
- 从角色卡无损 archive 回填旧角色缺失的原始 description/personality。

历史 V11 中固定演示数据 ID 只保留为**一次性旧数据库迁移兼容**，不会参与新角色运行时判断。

## 角色换卡与删除

- 给现有角色重新导入角色卡时，只替换“上一张角色卡拥有”的世界书/Regex/archive，不删除用户自己创建的共享资源。
- 旧角色卡专属 Persona 会随换卡同步，不让上一张卡的 user 设定污染新卡。
- 删除角色会清理单聊、群聊中该角色发送的消息、记忆、关系、状态、Prompt Debug、角色专属 Persona、资源绑定与角色卡 archive，避免孤儿记录。

## 明确边界

“兼容所有角色卡”在工程上应理解为：尽量覆盖公开标准和常见社区格式，并对未知字段无损保存，而不是声称可以安全执行任何未知私有插件。以下仍不会直接执行：

- 任意第三方 `<script>`；
- tavern_helper 的远程 JavaScript/import；
- 未知插件的私有运行时代码。

后续遇到新格式，应新增**结构适配器**，不能新增 `if (角色名 === ...)` 之类角色专用补丁。

---

## 来源：`V0.4.3.7.6_场景语义与普通消息渲染修复.md`

# V0.4.3.7.6 场景语义与普通消息渲染修复

本版集中修复社区角色卡在真实聊天中的五类基础问题，不新增娱乐 App。

## 1. 自动相处状态增强

自动 presence 会优先识别当前回复中的直接身体接触和明确同场景证据，例如捏下巴、触碰手腕、目光落在用户脸/眼睛/身上、坐在床边/榻边等。`{{user}}` 在场景判定前会按“你”处理，因此角色卡原始模板里的 `捏着{{user}}下巴` 也能判定 together。

手动 together / remote 仍然最高优先级；自动模式不再因为上一轮是 remote 就长期锁死远程。

## 2. 社区 UI 只尊重原卡真实定义

角色卡/世界书/Regex/Preset 明确定义 UI 时继续由 Community UI Runtime 接管。真实测试：夜临的常驻世界书确实包含“状态栏”HTML，并要求每次回复携带，因此夜临继续显示原卡粉色状态 UI；沈墨言原卡未包含 HTML/Regex/UI 协议，因此不会被小手机凭空套状态卡。

普通角色仍可从状态文本中提取日期、地点、内心等用于世界状态，但这些内部状态不会自动渲染成小手机自造的粉色 UI。

## 3. 世界观与设备外壳隔离

“小手机”是用户侧产品界面，不等于角色世界里一定存在手机。默认互动协议不再写“正在通过手机联系”，也不再自动补“低头看手机屏幕”的动作。

旧版本由系统自动生成、内容精确匹配“低头看着手机屏幕，停了一会儿才继续回复”的 Action 会在加载聊天时自动清理。真实现代角色如果自己写手机行为不会因此被全局禁止。

## 4. 普通回复默认整轮一颗气泡

普通纯文本不再按句号、引号、换行机械拆成多条消息。只有模型明确输出多个 `text` 消息（例如 companion_packet 中连续消息）时，才保留多气泡意图。

因此不会再出现单独一个 `”` 占一颗气泡，长篇古风回复也会保留为一个完整消息块并保留内部段落。

## 5. 用户可见宏变量统一清理

聊天状态、角色当前活动、心理面板等用户可见区域会解析 `{{user}}` / `{{char}}`。角色详情会优先使用该角色绑定的专属 Persona 名；没有专属 Persona 时用“你”。

## 数据版本

- 应用：V0.4.3.7.6
- IndexedDB：V11
- Backup：V9

无需数据库迁移。

---

## 来源：`V0.4.3.7.4.1_构建修复说明.md`

# V0.4.3.7.4.1 构建修复说明

Windows 完整构建暴露 3 个 TypeScript 错误：

- TS7023：递归函数 `objectPersonaTemplate` 隐式返回 `any`。
- TS7024：递归 map 回调的返回类型随之被推断为 `any`。

修复：

```ts
function objectPersonaTemplate(value: unknown): string {
  // ...
}
```

这是纯类型修复，不改变 Persona 提取逻辑。

数据版本不变：IndexedDB V10，Backup V9。

---

## 来源：`V0.4.3.7.4_CommunityPersonaExtractorV2与文档归档.md`

# V0.4.3.7.4：Community Persona Extractor V2 与文档归档

## 本版目的

不再按单张测试角色卡补 `{{user}}` 规则，而是建立通用角色卡用户 Persona 识别层。

## 支持的来源

- 角色 `description`
- `scenario`
- `creator_notes`
- `system_prompt`
- `post_history_instructions`
- data/root `extensions` 中的 user Persona/template 字段
- 内嵌 `character_book`

`first_mes` 和 `mes_example` 不作为独立 Persona 来源，避免把剧情/示例对白误判成用户资料。

## 支持的典型写法

- `{{user}}:` + 缩进结构化字段
- `③{{user}}我是江梨,女,19岁,162cm...`
- `[用户]{{user}}是{洛梨,女,...}`
- `{{user}}洛梨，疑似西国女将...`
- 世界书 `user人设 / user设定 / user基本情况 / 用户档案 / 关于user`
- 世界书正文直接 `姜阮,女,25岁,168cm...`，即使没有 `{{user}}` 占位也能作为专属 Persona
- HTML 格式 user 人物档案会先转成可读文本再提取

## 反误判

以下不会自动建立 Persona：

- `{{user}}要求不高...` 这类剧情描述
- `{{user}}已发生的故事...`
- `{{user}}网恋用的小号...` 等局部设定片段
- `<user_personal_room>` / 住址 / 房间
- user 座驾、衣橱、单位、NPC、联系人、手机等世界资料

只有明确 Persona 声明或专门 user 人设资源达到安全阈值才自动建立。

## 夜临实测

原卡：`③{{user}}我是江梨,女,19岁,162cm.A大大一新生...`

当前解析：

- Persona 名称：江梨
- 年龄：19
- 性别：女
- 身高：162cm
- 身份：A大大一新生
- 范围：仅夜临角色专属

## 社区包回归

用现有社区资源包中的 32 张角色卡回归：32/32 可继续解析；其中 16 张达到安全阈值并识别到独立 user Persona。其余角色卡存在普通 `{{user}}` 剧情占位或关系描述时，不会为了“看起来兼容”而猜造姓名。

## 文档目录

V0.4.3.7.4 起，项目内所有 Markdown 统一放在 `docs/`。ZIP 根目录不再放 `.md`。

## 数据版本

- App：V0.4.3.7.4
- IndexedDB：V10
- Backup：V9

---

## 来源：`V0.4.3.7.3_多开场分支与Regex契约修复.md`

# V0.4.3.7.3 多开场分支与 Regex 契约修复

## 本轮实机问题

- 多开场角色首次进入聊天时没有先选开场，默认 `first_mes` 已经写进历史。
- 在聊天设置里选择备用开场时，旧开场没有被替换，而是作为新消息继续追加，导致最近上下文同时存在两套剧情。
- “离婚的诱惑”同时有“开场白”Rich Regex 和“状态栏”Rich Regex；旧检测会把两者都当成每轮 UI，导致模型再次输出 `【八卦主页】` 也可能被误判为合规。
- 原卡 HTML 里的 `triggerStory(n) / setChatMessages(...swipe_id...)` 因第三方 JS 被安全禁用，无法像酒馆里一样切换开场分支。

## 修复

### 1. 首次聊天先选开场

角色存在至少两个不同开场时：

- 创建角色时不再提前把默认 `first_mes` 写入消息历史。
- 第一次打开单聊会弹出“选择开场白”。
- 默认开场 + alternate greetings 按原顺序列出。
- 单开场角色仍保持原行为，不多弹一步。

### 2. 切换开场 = 重置当前剧情分支

开场不再“追加”。选择另一开场时会：

- 删除当前会话消息；
- 清空本会话记忆；
- 清空 ConversationState / 状态历史；
- 清空旧 Prompt Debug trace；
- 重新根据所选开场生成第一条角色消息与状态；
- 保留 Character / Persona / WorldBook / Regex / Preset 等角色资源。

已有真实聊天内容时会先确认；如果当前只有旧默认开场 seed，则直接替换，不额外打扰。

### 3. 社区开场页安全支持 swipe 跳转

Safe Rich HTML 继续不执行第三方 JavaScript，但会识别：

- `triggerStory(1)`
- `setChatMessages(... swipe_id: 1 ...)`

只提取安全的数字 swipe 编号，并交给小手机本地开场分支系统处理。

因此“离婚的诱惑”八卦主页里的三条帖子可以映射到对应备用开场，而不需要开放 `tavern_helper` / 任意 JS。

### 4. 开场 Rich Regex 不再冒充每轮状态栏 Regex

如果同一角色同时存在：

- `开场白`：`【八卦主页】 -> HTML`
- `状态栏`：多字段 XML -> HTML

每轮 UI 合规检查只要求真正的 `状态栏` Regex。

`【八卦主页】` 即使成功生成黑色主页 HTML，也不能再让普通回合错误通过 UI 校验。

## 数据版本

- App: V0.4.3.7.3
- IndexedDB: V10
- Backup: V9

无需数据库迁移。

---

## 来源：`V0.4.3.7.2_社区UI模板注入与检测可靠性修复.md`

# V0.4.3.7.2 社区 UI 模板注入与检测可靠性修复

- 墨清尘：直接 HTML 状态栏会把原卡模板再次注入最高优先级 Prompt，模型无需凭“关键标签”猜布局。
- 离婚的诱惑：即使格式世界书没有稳定进入本轮，`状态栏` Rich Regex 的多字段 findRegex 也足以触发 regex-html 接管，并给模型完整 XML 输入骨架。
- UI 两次失败时调试器会留下真实模型输出。
- 修复角色导入页专属 Persona 卡片窄屏布局。
- 社区资源卡编辑器显示“社区资源已载入”。
- IndexedDB V10 / backup V9。

---

## 来源：`V0.4.3.7.1_IndexedDB克隆安全与PromptDebug旁路修复.md`

# V0.4.3.7.1 IndexedDB 克隆安全与 Prompt Debug 旁路修复

## 修复问题

V0.4.3.6 实机仍出现 IndexedDB `DataCloneError`。之前只在 Prompt Debug 单点做 JSON plain 化，不足以覆盖 Vue 嵌套 Proxy 和其它设置/会话状态写库入口。

## 本版修复

- `storageSanitizer.ts` 改为递归重建 clone-safe 数据。
- 保留 IndexedDB 支持的 Date / Blob / File / RegExp / ArrayBuffer / TypedArray / Map / Set。
- `saveChatSettings()` 写库前统一 sanitizer。
- `patchConversationState()` 写库前统一 sanitizer。
- `saveMusicState()` 写库前统一 sanitizer。
- Prompt Debug 首次保存失败时降级为“不记录调试”，继续请求模型。
- Prompt Debug 回填结果失败时只输出 console warn，不影响回复保存。

## 版本

- App：V0.4.3.7.1
- IndexedDB：V10
- Backup：V9

---

## 来源：`V0.4.3.7_社区UI可靠执行与资源型角色卡修复.md`

# V0.4.3.7 社区 UI 可靠执行与资源型角色卡修复

## 本次针对实机截图修复

### 1. 墨清尘开场 `<br>` 仍作为文字显示

旧数据库里已经保存的普通角色消息，如果包含 `<br>` / `<br/>`，重新打开聊天时会自动转成真实换行。

新建普通单聊时，角色卡 `first_mes` 也会先经过普通社区文本换行归一化。

Rich HTML / Regex UI 不会被当成普通文本清洗。

### 2. JSON 明明规定了 UI，模型却退化成普通文本

新增“社区 UI 输出合规检查”：

- `html-contract`：角色卡 / 世界书明确要求每轮 HTML UI 时，最终回复必须真的包含 Rich HTML。
- `regex-html`：角色卡通过 assistant-output Regex 生成 UI 时，本轮原始输出必须命中 Regex 并最终得到 Rich HTML。
- `structured-contract`：固定 XML / 状态栏协议必须保留原卡要求的结构标签。

如果第一次输出不合规，小手机会自动用更低温度做一次“格式纠偏重写”。

如果第二次仍不合规，本轮不会把错误的普通文本写进聊天，而是明确报错让用户重试。

这样不会再出现“检测到了社区 UI，但实际聊天仍显示普通大段文字”的假兼容。

### 3. 避免把“只用于开场/特殊触发”的 Rich Regex 错当成每轮 UI

只有同时检测到角色卡 / 世界书 / Preset / Prompt Regex 明确的“每轮固定输出协议”时，Rich assistant Regex 才会升级为每轮 UI 接管。

单纯存在一个“开场白 UI Regex”，不会强迫之后每一条普通回复都必须走它。

### 4. Safe Rich UI 增强常见无 JS 交互

第三方 JS 仍然不执行，但增加几个安全兼容层：

- `data-target` Tab 切换；
- 常见 `switchTab('posts', this)` 形式会转换成纯 DOM Tab；
- 关注按钮本地视觉切换；
- `.blur-overlay` “点击揭开”遮罩可安全隐藏；
- Rich UI Host 改为正常 HTML whitespace，并强化图片 / 音视频宽度约束。

不会执行 `script / onclick / javascript: / iframe`。

### 5. “离婚的诱惑”这类资源型 / 多角色卡不再显示成“什么都没填”

如果角色基础 persona / speakingStyle / background 为空，但角色已经绑定大量世界书、Regex 或 Depth Prompt：

- 角色详情页会明确显示“社区资源已接管设定”；
- 展示世界书 / Regex / Preset / Depth Prompt 数量；
- 空白字段改为说明“设定来自社区资源”，而不是误导成“未填写”。

### 6. V3 角色卡编辑时不再被降成 V2

此前“沉浸角色卡”页面标题固定写 `角色卡 V2`，保存时也固定 `cardVersion: 2`。

现在：

- V3 导入后显示 `角色卡 V3`；
- 保存仍保持原始 cardVersion；
- 资源型社区卡不再显示误导性的“完整度 22%”，改为“社区资源已载入”。

“导出为 V2 JSON”仍然保留，因为它本来就是显式的兼容导出功能。

## 数据版本

- 应用：V0.4.3.7
- IndexedDB：V10
- backup：V9
- 不需要数据库迁移

## 仍保留的安全边界

社区任意 JavaScript 不直接执行。

像 `setChatMessages(...)`、Tavern Helper、远程 import JS 等酒馆专属脚本会继续无损归档，但不会直接获得浏览器执行权限。后续可以把高频交互逐个做成安全的本地 Runtime Adapter。

---

## 来源：`V0.4.3.6.1_构建修复说明.md`

# V0.4.3.6.1 构建修复说明

## 修复内容

Windows 完整构建 V0.4.3.6 时，`vue-tsc -b` 报错：

```text
src/views/ChatRoom.vue:1557:83 - error TS2304: Cannot find name 'lorebookPrompt'.
```

原因：V0.4.3.6 新增“社区 UI 输出接管”后，在用户事实支持文本中引用了旧变量名 `lorebookPrompt`；当前作用域实际变量名已经是 `runtimeLorebookPrompt`。

本版仅将该引用修正为：

```ts
runtimeLorebookPrompt
```

不修改社区 UI 接管规则，不修改数据库结构，不迁移数据。

## 版本

- 应用：V0.4.3.6.1
- IndexedDB：V10
- backup：V9

## 验证重点

1. `package.json` 版本为 `0.4.3.6.1`。
2. `ChatRoom.vue` 不再引用未定义的 `lorebookPrompt`。
3. V0.4.3.6 的社区 UI 优先逻辑保持不变。
4. 最终仍以 Windows 上 `npm run build` 的 `vue-tsc -b && vite build` 结果为准。

---

## 来源：`V0.4.3.6_社区UI输出接管.md`

# V0.4.3.6 · 社区 UI 输出接管

## 目标

社区角色卡、世界书、Preset 或 Regex 已经定义 UI / 状态栏 / 固定输出格式时，小手机不再用自己的“动作与对白分开/合并”规则覆盖作者格式。

优先级改为：

```text
社区 JSON 自带 UI / 输出协议
↓
角色卡 / Persona / WorldBook / Preset / Memory 等内容约束
↓
普通小手机场景与动作协议（仅无社区 UI 时兜底）
```

## 识别来源

运行时会综合检查：

- 本轮实际激活的 WorldBook Prompt；
- 当前绑定的 Prompt Preset；
- 当前角色绑定的 assistant-output Regex；
- 角色卡 system prompt / post-history instructions / depth prompt / creator notes / first message / raw extensions。

强特征包括：

- “每次回复必须 / 严格遵守 / 最高优先级 / 输出格式 / 状态栏格式 UI”；
- `<日期>...</日期>`、`<状态栏>...</状态栏>`、角色状态/心声/计划等固定 XML 标签；
- `<div> / <style> / <details> / <!DOCTYPE html>` 等 UI 模板；
- assistant-output Regex 把状态标签转换成 HTML/CSS。

## UI 接管时的行为

检测到社区 UI 后：

1. 不注入小手机 `scene_action / companion_packet` 输出协议；
2. 不执行默认“远程分开、同场合并”的气泡整形；
3. 不把社区标签改成中文括号动作；
4. assistant-output Regex 直接作用于模型原始输出，避免模型标签在正则执行前被解析器吃掉；
5. Regex 生成 HTML 时直接进入 Safe Rich HTML Runtime；
6. Regex 未生成 HTML 时也保留社区结构化文本，只移除小手机自己的私有协议残片；
7. 流式生成期间隐藏原始标签预览，完成后一次性按 UI 渲染，避免 HTML/XML 碎片闪现。

## 普通角色

没有检测到社区 UI 时保持自动规则：

- remote：动作独立、对白按手机消息显示；
- together：动作与对白自然合并；
- 不再提供“始终分开 / 始终合并”的手动选择。

旧数据库里已有 `actionTextLayout=separate/merged` 不删除，以保证备份兼容，但运行时不再让它覆盖自动场景规则。

## Full HTML Regex 兼容

社区 Regex 常返回完整：

```html
<!DOCTYPE html>
<html>
<head><style>...</style></head>
<body>...</body>
</html>
```

V0.4.3.6 会提取 `<head>` 中的 `<style>` 和 `<body>` 内容，再挂载到 Shadow DOM；完整 document 不再直接塞进聊天 div。CSS 中 `body/html { ... }` 会安全映射到 Shadow Host。

安全边界不变：`script / iframe / object / embed`、事件属性和 `javascript:` URL 不执行。常见 `data-target` Tab 会由小手机自己的安全交互绑定恢复切换效果，不执行原卡脚本。

## 真实资源验证

### Tavo_墨清尘_20251008T2000.json

世界书“状态栏”条目明确要求每次回复开头携带状态栏 UI，并包含 `<div>/<details>` HTML 模板。检测结果：

```text
active = true
mode = html-contract
reason = 世界书定义了每轮 UI / 状态栏输出格式
```

### cb118ca09fa1bd50.json（离婚的诱惑）

世界书明确要求每次回复末尾输出 `<日期>/<时间>/<地点>/...` 固定 XML 状态栏，同时内嵌“状态栏” Regex 将其转换为完整 HTML。检测结果：

```text
active = true
mode = regex-html
reason = 输出正则生成 UI + 世界书定义每轮状态栏
```

## 数据版本

```text
应用：V0.4.3.6
IndexedDB：V10
Backup：V9
```

无数据库迁移。

---

## 来源：`V0.4.3.5_初始状态与UserPersona识别修复.md`

# V0.4.3.5 · 初始状态与 User Persona 识别修复

## 这版解决什么

### 1. “刚刚来到这个世界”不再写死

旧版所有新角色都会得到同一条 activity，导致已经有几十年、几万年经历甚至明确场景的角色看起来像刚出生。

现在：

- first_mes 有明确 `💛 / 活动 / 状态`：使用卡内内容。
- 没有明确内容：activity 留空。
- 旧数据打开通讯录或聊天时自动清理这条历史占位。

墨清尘实测从 first_mes 得到：

```text
关系：师徒
活动：负手立于田埂
```

### 2. `{{user}}` 不再被误解成“一个待识别的用户名”

`{{user}}` 是社区角色卡宏。V0.4.3.5 把来源分开：

- 当前聊天 Persona：真正用于本轮 `{{user}}` 名称和用户资料。
- 原卡独立 user 人设：创建为角色专属 Persona。
- 世界书剧情身份：只作为本角色世界设定，不改全局用户资料。

### 3. 墨清尘的 user 人设现在能识别

它不是写在 description 的旧式 `{{user}}:` 块，而是在 character_book 的“user人设”条目里：

```text
{{user}}我是洛梨,墨清尘徒弟,筑基期剑修,20岁...
```

现在会识别出：

```text
姓名：洛梨
年龄：20
身份：墨清尘徒弟、筑基期剑修
作用域：仅墨清尘
```

### 4. 没有明确姓名的卡不瞎猜

像“离婚的诱惑”这种卡大量使用 `{{user}}`，也写了角色世界中的婚姻/职业等关系，但没有独立可安全提取的用户名。

处理规则：

- 不猜名字；
- 运行时使用当前 Persona 名称；
- 卡内剧情关系继续进入本角色 Prompt；
- 不把剧情身份写进全局“我的资料”。

### 5. `<br>` 和备用开场

普通文本开场中的 `<br>` 会变成正常换行；真正的 HTML/CSS UI 仍走 Safe Rich Runtime。

备用开场现在与首条开场共用：

```text
宏替换 → Regex → Rich UI → Role Card UI 状态 → ConversationState
```

## 数据版本

```text
应用：V0.4.3.5
IndexedDB：V10
完整备份：V9
```

无需数据库迁移。

---

## 来源：`V0.4.3.4_可靠性与社区JSON兼容修复.md`

# V0.4.3.4 可靠性与社区 JSON 兼容修复

本版根据实际聊天截图和一整包 Tavo / SillyTavern 社区资源做针对性修复。重点不是增加新的“大功能入口”，而是让已有聊天协议、角色卡、Persona、世界书、Preset、Regex 和 Rich UI 更可靠地真正跑起来。

## 1. 输出截断与 Scene Action

- 模型最大输出长度默认值从旧版 576 / 600 提升到 **2048**。
- 已保存的历史默认值 576 / 600 会在读取时自动迁移到 2048；用户主动设置的其它值不强改。
- `<scene_action>` 支持属性、额外空格、大小写、`scene-action` / `scene_action` 以及流式未闭合/半截标签。
- 流式过程中即使只收到 `<scene_act`、缺闭标签或标签被截断，也不会再把 XML 碎片显示进聊天气泡。
- 打开历史聊天时也会清理已保存的残缺 scene_action 标记。
- 修正直接接触误判：不再把普通“把你介绍给导演 / 将你说的话记下来”当成身体接触；“把你圈进怀里 / 将你捞进怀里 / 拍你的后背”等仍会正确判定 together。

## 2. 动作与对白排版可选

聊天设置新增“动作与对白排版”：

- **自动**：远程默认分开；在一起默认合并。
- **分开显示**：scene_action 与对白使用独立消息。
- **合并显示**：动作转成中文括号后直接接对白。

合并时不再人为插入换行，例如：

```text
（翻过身，手臂一伸，将你捞进怀里）我也没睡着。
```

而不是：

```text
（翻过身，手臂一伸，将你捞进怀里）
我也没睡着。
```

手动排版选择优先于自动规则；场景 presence 的手动指定仍保持最高优先级。

## 3. Prompt 调试 IndexedDB DataCloneError

Prompt 调试记录写入 IndexedDB 前统一转成 plain storage value，不再直接把 Vue Proxy / reactive 嵌套对象交给 Dexie。

修复目标错误：

```text
Failed to execute 'put' on 'IDBObjectStore':
[object Object] could not be cloned.
DataCloneError
```

## 4. 实际社区资源兼容复核

本次用用户提供的真实资源包逐个解析，覆盖：

- 32 张 Character Card V2 / V3
- 10 本 Lorebook，共 211 条世界书条目
- 7 份 Prompt Preset
- 2 个 Regex ZIP，共 8 条有效 Regex JSON
- 2 个 TXT，其中一份为 GB18030 用户 Persona 文本

### Character Card

新增/加强读取：

- `data.extensions` 与 root `extensions`
- `talkativeness`
- `depth_prompt`，包括 `depth_prompt.prompts[]`
- `world`
- root / data 内嵌 `regex_scripts`
- `group_only_greetings`
- root avatar 兼容
- root 额外元数据无损保留
- `tavern_helper` 等未知扩展无损保存，但第三方 JavaScript **不执行**

运行时：

- `talkativeness` 会参与主动程度和远程多消息节奏。
- `depth_prompt` 会进入角色运行时 Prompt。
- `world` 名称提示会保留到角色卡上下文与兼容信息中。
- 内嵌 Regex 会作为角色专属 Regex 导入并启用。
- `{{user}}` 用户模板继续可生成角色专属 Persona。

### Lorebook

同时识别 camelCase / snake_case，重点补齐真实 Tavo 字段：

- `uid`
- `key / keysecondary`
- `order`
- `selectiveLogic`
- `caseSensitive`
- `matchWholeWords`
- `groupOverride / groupWeight`
- `scanDepth`
- `excludeRecursion / preventRecursion / delayUntilRecursion`
- `useGroupScoring`
- `matchPersonaDescription`
- `matchCharacterDescription`
- `matchCharacterPersonality`
- `matchCharacterDepthPrompt`
- `matchScenario`
- `matchCreatorNotes`

`vectorized / addMemo / automationId / displayIndex` 等当前没有完全对应运行时语义的字段继续保存在 raw extensions 中，不静默丢弃。

### Prompt Preset

- 不再只取第一个 `prompt_order`。
- 多个 order group 时，按与 `prompts` 的有效覆盖率和完整度选择实际运行组；所有分组仍完整保存。
- 本次真实资源中最大的预设会正确选中 212 项的 order group，而不是误用 11 项的小分组。
- 支持常用宏 `{{char}} / {{user}} / {{scenario}} / {{personality}} / {{persona}} / {{lastChatMessage}} / {{lastUserMessage}}`。
- 新增安全文本级 `setvar / getvar / random` 宏兼容，不执行脚本。
- 供应商专属 temperature / top_p / model / reasoning 等配置继续无损保留；不会擅自覆盖 App 的 API 与模型设置。

### Regex / Rich UI

- ZIP 中自动跳过 `__MACOSX` 和 `._*` 资源叉垃圾文件。
- 兼容“文件名实际是 UTF-8 但 ZIP 没有写 UTF-8 flag”的老包，避免中文文件名乱码。
- 真实 2 个 Regex ZIP 中 8 条有效脚本均可解析。
- HTML / CSS 状态栏、朋友圈、校园墙、小剧场等仍走 Safe Rich HTML 渲染。
- `script`、`onclick`、`iframe`、`javascript:` 与第三方 JS 继续禁止执行。

### Persona 文本

用户 Persona TXT 支持 UTF-8 → GB18030 兼容解码。实际资源中的 GB18030 文本可正确读取“姓名、年龄、身高、外貌、性格”等字段，不再出现乱码。

## 5. “我的资料”页面

重新整理为三层信息：

1. 顶部“手机基础身份”概览；
2. Persona 概览（区分全局 Persona / 角色卡专属 Persona）；
3. 基础昵称、身份、简介与头像编辑。

Persona 列表统一使用 `CharacterAvatar` 渲染，因此 `data:image/jpeg;base64,...` 不再作为一长串文字撑爆页面。

## 6. 数据兼容

- 应用：**V0.4.3.4**
- IndexedDB：**V10**
- 完整备份：**V9**

本版没有改变 Dexie schema，不需要数据库迁移。

## 7. 本版明确仍是“部分兼容”的区域

- WorldBook 的递归、sticky / cooldown / delay 已有兼容行为，但还不是原客户端逐消息状态机的 1:1 实现。
- `vectorized` 暂不启用向量检索。
- Theme JSON 仍以安全归档为主；本次用户资源包里没有独立 Theme JSON，HTML/CSS 美化主要来自 Lorebook / Regex。
- 第三方 JavaScript 永远不会因为“兼容 Tavo”而自动执行。

这些限制都会在资源兼容报告里明确标注，而不是假装已经完整支持。

---

## 来源：`V0.4.3.3_场景冲突与SceneAction解析修复.md`

# V0.4.3.3 场景冲突与 Scene Action 解析修复

本版针对“角色已经抱住用户却仍显示远程 Action”和 `<scene_action perspective="remote">` 标签泄漏。

## 修复
- 直接身体接触优先判定 together，并覆盖模型错误的 remote / 角色卡“独处”冲突。
- 角色卡 UI 原始内容仍保留；ConversationState 保存系统最终解析后的场景状态及判定原因。
- 支持带属性的 scene_action XML 标签、大小写和换行；不完整开标签也会安全兜底。
- 打开旧聊天时会自动清理历史遗留的 `<scene_action ...>` 泄漏消息；若最后一条角色消息明确发生身体接触，会同步修正当前 presence。
- together 时动作与对白合并同一剧情气泡；remote 才拆独立 Action。
- 手动相处模式最高优先级。
- Prompt Debugger 新增场景判定详情。

数据兼容：IndexedDB V10，备份 V9，不迁移数据库。

---

## 来源：`V0.4.3.2_社区资源导入构建修复.md`

# V0.4.3.2 社区资源导入构建修复

本版为 V0.4.3.1 的构建修复，不改变数据库结构和社区资源运行行为。

## 修复

- 修复 `CharacterCreate.vue` 中导入内嵌世界书时对象字面量重复声明 `characterId`。
- 修复同一对象重复声明 `lorebookId` 导致的 TypeScript `TS1117`。
- 保留 `...entry` 后的 `characterId` / `lorebookId` 强制覆盖，确保社区角色卡内嵌世界书始终归属于本次新创建的角色和 Lorebook。
- IndexedDB 仍为 V10，备份格式仍为 V9。

## 兼容性

V0.4.3.1 的世界中心、原始社区资源归档、全局/角色作用域、角色卡 V2/V3、世界书、Preset、Regex 与 Rich UI 功能全部保留。

---

## 来源：`V0.4.3.1_社区资源无损归档与全局作用域升级.md`

# V0.4.3.1 社区资源无损归档与全局作用域升级

本补丁继续完善 V0.4.3 的 Tavo / SillyTavern 兼容底座，重点解决“能识别但解析后丢掉原始扩展”和“通用资源必须逐角色重复绑定”两个问题。

## 主要变化

- 新增社区资源原始归档表，完整保存导入 JSON / TXT / MD、文件名、格式识别与兼容报告。
- 资源中心可以查看、复制、导出原始归档。
- Character Card V2/V3 从创建角色入口导入时同步保存整张原始 JSON。
- Lorebook / Preset / Regex 支持全局和当前角色两个作用域。
- 全局世界书、Regex 会自动参与所有角色；角色级 Preset 优先于全局 Preset。
- 角色卡内嵌 worldbook / regex 显式绑定为 character scope。
- Universal Inspector 可识别角色卡、Persona、Theme、世界书、Preset、Regex 和未知 JSON；暂不支持的资源安全归档。
- IndexedDB V10；备份 V9。

## 当前安全边界

Theme 和未知社区扩展暂时不直接执行。HTML/CSS Rich UI 继续通过安全 Renderer；第三方 JavaScript 不会获得 App、IndexedDB 或 API Key 权限。

---

## 来源：`V0.4.3_Tavo与SillyTavern资源兼容运行时.md`

# V0.4.3 Tavo / SillyTavern 资源兼容运行时

## 目标

把桌面“✨ 世界”从占位页升级为真正的资源与世界系统中心，让角色卡、世界书、Prompt 预设、正则和角色 UI 能按资源组合运行，而不是继续把兼容逻辑写死在聊天页。

## 世界中心

入口：`桌面 → ✨ 世界`

五个页签：

- 世界书：查看、编辑、启停并绑定到当前角色。
- 世界状态：查看地点、剧情时间、相处状态、活动和心情。
- 预设：导入并为角色选择 Prompt 预设。
- 正则：查看角色卡内嵌或独立正则，并按角色启停。
- 资源库：导入社区 JSON / 正则 ZIP，并生成兼容报告。

## 角色卡兼容

创建角色继续支持 SillyTavern / Tavo Character Card V2 / V3。V0.4.3 新增：

- 内嵌 `character_book` 不再只抽取简单关键词，而是保留 `selective / use_regex / position / depth / probability / sticky / group / recursion` 等常见扩展字段。
- 内嵌世界书保存为独立 Lorebook Resource，并自动绑定到该角色；用户可以在“世界”里关闭。
- `extensions.regex_scripts` 会保存为角色专属正则并自动绑定。
- 角色卡首条消息会尝试执行角色卡自带的 AI Response 正则；如果结果是 HTML/CSS UI，会直接按安全 Rich UI 显示。
- 继续保留卡内 `{{user}}` → 角色专属 Persona 能力。

## 世界书运行时

新增 Lorebook Resource / Entry 两层结构。旧版没有 `lorebookId` 的散装世界书继续兼容。

本轮触发会参考：

- 常驻 / 关键词
- 正则关键词
- secondary keys / selective
- case sensitive
- insertion order
- probability
- scan depth
- group / group override / group weight
- sticky（兼容近似）
- delay（兼容近似）

`cooldown / recursion` 等字段会保留，后续继续提高与社区客户端的一致性。

## Prompt 预设

支持导入常见 `prompts + prompt_order` JSON：

- 保存 Prompt 名称、role、content、marker、启用状态和顺序。
- 每个角色同时选择一套预设。
- 自定义 Prompt 会进入运行时系统 Prompt；`main / chatHistory` marker 用于安放本 App 的完整角色上下文。
- 供应商专属采样参数原样保存在 `rawConfig`，当前仍以本 App“模型设置”为最终参数来源。

## Regex Pipeline

正则运行时支持：

- User Input
- AI Response
- World Info
- Prompt Only
- `findRegex / replaceString`
- capture group `$1...`
- `{{user}} / {{char}}` 替换
- placement
- trimStrings
- promptOnly / markdownOnly / depth 字段保存

角色卡内嵌正则和独立正则都可以按当前角色启停。

## UI / 前端渲染

V0.4.3 新增安全 Rich HTML Renderer：

- 支持 HTML、CSS、`details / summary`、图片和 CSS 动画。
- 支持正则把状态块替换成 HTML/CSS UI。
- 如果模型直接输出可识别 HTML，也可进入 Rich UI，而不必一定经过正则。
- Rich 消息保留 `rawContent`，后续聊天仍把原始模型输出作为历史上下文，避免 UI 转换破坏剧情状态。

安全边界：

- 删除 `script / iframe / object / embed / form` 等危险节点。
- 删除 `onclick` 等事件属性和 `javascript:` URL。
- CSS 在 Shadow DOM 中隔离。
- 不执行第三方 JavaScript，不允许角色卡直接读取 API Key、其他聊天或 IndexedDB。

## 角色卡 UI 与场景状态

除了本项目原有 `{日期}{时间}{地点}{内心}{周围}{待办}`，新增对常见 Tavo `字段 | 值` 状态头的只读提取，例如：

```text
时间 | 3055年6月5日 18:30
地点 | 言氏府邸·三楼卧室
心声 | 她应该能继续维持合约
正文 | ...
```

这些字段不会破坏原正则匹配，但会同步剧情时间、地点和内心状态。正文出现明确现实接触动作时仍可辅助判断 `together`。

## 数据版本

- IndexedDB：V9
- 完整备份：V8
- V1～V7 旧备份继续可导入；V8 新增世界书资源、预设、正则和绑定表。

## 当前兼容边界

V0.4.3 的目标是“主流资源尽量正确运行 + 安全降级”，不是无条件执行任意社区代码。

仍未完全等价的部分包括：

- SillyTavern/Tavo 所有递归扫描、sticky/cooldown 的逐消息状态细节。
- 预设的全部 in-chat depth、provider 专属采样参数和所有 marker 语义。
- 依赖任意 JavaScript 的第三方前端扩展。
- PNG 角色卡嵌入数据及资产包自动解包。

遇到不支持资源时应保留原数据并通过兼容报告说明，而不是静默丢弃。

---

## 来源：`V0.4.2.11_角色卡UI同场景与Persona头像升级.md`

# V0.4.2.11 角色卡 UI、同场景与 Persona 头像升级

- Persona 支持本地图片头像。
- 用户消息“已读/已发送”移动到气泡正下方。
- 角色卡 UI `{日期}{时间}{地点}{内心}{周围}{待办}` 自动解析为状态卡。
- UI 不再以代码块和花括号原样显示。
- UI 的地点、周围、内心、待办会同步持续世界状态。
- `周围:xx在场` 或明显现实接触动作会自动识别为同场景。
- 同场景动作使用中文括号合并进剧情气泡；远程动作继续独立 Action。
- 角色卡拥有独立剧情日期时，保留角色卡时间线，不以设备年份强制覆盖。

数据库仍为 V8，备份格式仍为 V7。

---

## 来源：`V0.4.2.10_角色卡user模板Vue构建修复.md`

# V0.4.2.10 角色卡 {{user}} 模板 Vue 构建修复

## 修复内容

- 修复 `UserProfileView.vue` 中动态兜底字符串直接包含 `{{user}}`，导致 Vite 把宏内容误判为嵌套 Vue 插值。
- 动态兜底文案改为 `<script setup>` 常量 `characterCardUserTemplateFallback`。
- `CharacterCreate.vue`、`CharacterCardEditorView.vue`、`UserProfileView.vue` 的静态 `{{user}}` 展示继续使用 `v-pre`。
- 删除源码中的旧 `characterCardImportService.js` 残留，避免与 TypeScript 实现混淆。

## 兼容性

- IndexedDB：V8
- 备份格式：V7
- 不需要迁移现有角色、Persona、聊天、记忆、世界书或图片。

---

## 来源：`V0.4.2.9_角色卡用户模板构建修复.md`

# V0.4.2.9 角色卡用户模板构建修复

Windows 实际生产构建在 V0.4.2.8 中通过了 `vue-tsc`，但 Vite 编译 `CharacterCreate.vue` 时因模板里嵌套 `{{user}}` 字面量报 `Unterminated string constant`。

本版修复：
- `CharacterCreate.vue` 的 `{{user}}` 提示使用 `v-pre` 显示字面量，不再让 Vue 当表达式解析。
- `CharacterCardEditorView.vue` 同步修复。
- `UserProfileView.vue` 同步修复。
- 不修改 IndexedDB V8、备份格式 V7 或角色专属 Persona 行为。
- 覆盖旧仓库后建议删除残留的 `src/services/characterCardImportService.js`，项目正式实现为 `.ts` 文件。

---

## 来源：`V0.4.2.9_角色卡user模板Vue构建修复.md`

# V0.4.2.9 角色卡 {{user}} 模板 Vue 构建修复

本次为纯构建修复，不改变数据库版本和功能行为。

## 修复内容
- 修复 `CharacterCreate.vue` 中直接在 Vue 插值表达式里写 `{{user}}` 导致的 `Unterminated string constant`。
- 同步修复 `UserProfileView.vue`、`CharacterCardEditorView.vue` 中同类写法。
- 改为使用 `v-pre` 显示字面量 `{{user}}`，避免 Vue 模板解析器把它当成嵌套插值。
- 保留 V0.4.2.8 的角色专属 Persona、角色卡自带 `{{user}}`、自动绑定聊天等功能。

## 数据版本
- IndexedDB：V8
- 备份格式：V7

---

## 来源：`V0.4.2.8_角色专属Persona创建事务构建修复.md`

# V0.4.2.8 角色专属 Persona 创建事务构建修复

本版本只修复 V0.4.2.7 的严格 TypeScript 构建错误，不改变数据库版本和功能行为。

## 修复

- 修复 `CharacterCreate.vue` 中 Dexie `transaction()` 同时传入 6 张表时超过 TypeScript 重载参数上限的问题。
- 将 6 张表改为数组方式传入同一个事务，继续保证：角色、私聊、开场消息、内嵌世界书、角色专属 Persona、聊天设置在创建时保持同一事务。
- 保留角色卡 `{{user}}` → 角色专属 Persona → 自动绑定新聊天的完整 V0.4.2.7 行为。
- IndexedDB 仍为 V8，备份格式仍为 V7，不需要迁移数据。

## 构建

```powershell
npm run build
```

构建开头应为：

```text
> ai-companion-phone@0.4.2.8 build
> vue-tsc -b && vite build
```

---

## 来源：`V0.4.2.7_角色卡用户模板与角色专属Persona.md`

# V0.4.2.7 角色卡用户模板与角色专属 Persona

## 目标

让 Tavo / SillyTavern 角色卡中自带的 `{{user}}` 不再只是藏在 `description` 里的文本，而是可以直接成为当前角色专属的用户 Persona。

## 新增功能

- 导入角色卡时检测独立 `{{user}}:` 段落。
- 创建角色页展示检测结果和完整用户模板原文。
- 默认允许“一起创建角色专属 Persona”。
- Persona 与角色、私聊会话自动绑定。
- 角色专属 Persona 不参与全局默认 Persona 竞争。
- 角色卡编辑页可查看原始 `{{user}}` 并重新生成/更新 Persona。
- 我的资料页新增 Persona 概览，区分全局与角色专属。
- Persona 管理页新增“角色专属”标记。
- 卡内 Persona 的未识别字段和原始文本继续保留，避免社区卡信息丢失。

## 用户事实边界

角色卡 `{{user}}` 只有在它被明确创建并绑定为当前聊天 Persona 时，才可以作为当前用户的剧情事实。
切换回其他 Persona 后，卡内 `{{user}}` 不得继续被当作当前用户事实。

## 数据兼容

- IndexedDB：V8
- 备份格式：V7
- 不增加新表，不修改索引。
- `Character` 和 `UserPersona` 仅新增可选字段，旧数据可直接读取。

---

## 来源：`V0.4.2.6_角色卡创建DataClone修复.md`

# V0.4.2.6 角色卡创建 DataClone 修复

本版修复创建页直接导入 Tavo / SillyTavern JSON 后，点击“创建角色”可能出现：

```text
DataCloneError: Failed to execute 'add' on 'IDBObjectStore': [object Array] could not be cloned.
```

## 根因

角色卡解析结果被放进 Vue `ref` 后，嵌套数组可能被转换为响应式 Proxy。Dexie 最终调用 IndexedDB structured clone 时不能克隆这些 Proxy。

## 修复

- 角色卡导入状态改用 `shallowRef`，避免把社区 JSON 的嵌套数组深度代理。
- 角色与内嵌世界书写入 IndexedDB 前统一转换为纯 JSON 数据。
- Persona 保存也增加同样的存储净化，避免 `extraFields` / `tags` 出现同类问题。
- `alternate_greetings: null`、`character_book: null`、空 tags 等 Tavo 常见字段继续规范化为空数组。
- 新增 DataClone 回归测试。
- 补充 Tavo 卡内置 `{{user}}` 模板约束：它不是当前用户事实，除非 Persona / 历史 / 可信记忆明确确认。

数据库保持 V8，备份格式保持 V7，无需迁移。

---

## 来源：`V0.4.2.5_创建角色页直接导入角色卡.md`

# V0.4.2.5 创建角色页直接导入角色卡

- 创建角色页顶部新增“直接导入角色卡”。
- 支持 SillyTavern / Tavo Character Card V2、V3 JSON。
- 无需先创建空角色；选择 JSON 后立即预填姓名、人设、场景、开场和示例对话。
- 支持“直接创建这个角色”，也可以先修改表单再创建。
- 导入时保留 system_prompt、post_history_instructions、备用开场、作者、版本、标签等高级字段。
- 支持 Character Card V2 的内嵌 character_book；创建角色时自动转为角色专属世界书。
- 在已有角色的沉浸角色卡页面再次导入时，也会导入内嵌世界书，并按标题+内容去重。
- 选择预设、世界书或正则 JSON 时会给出明确错误，不再误创建空角色。
- 数据库仍为 V8，备份格式仍为 V7，无需迁移已有数据。

---

## 来源：`V0.4.2.4_Persona导入导出与Tavo兼容增强.md`

# V0.4.2.4 Persona 导入导出与 Tavo 兼容增强

## 本次目标

让“用户 Persona”像角色卡一样具备可迁移、可分享、可预览的资源能力，同时避免把世界书、预设或角色卡误当成用户事实。

## 新增功能

- 用户 Persona 支持导入 `.json`、`.txt`、`.md`。
- 支持本项目 `ai_companion_persona` V2 JSON。
- 支持通用 Persona JSON 字段映射。
- 支持 Tavo / 酒馆常见文本式用户人设；文件不是 UTF-8 时会尝试 GB18030 解码。
- 检测到 SillyTavern Character Card V2/V3 时，可明确“转换为用户 Persona”，而不是静默误识别。
- 世界书、Prompt 预设和正则脚本会被资源识别器拦截，避免导入到 Persona。
- 导入前显示预览：资源类型、识别字段数、保留扩展字段数、身份、外貌和性格摘要。
- 同名 Persona 可覆盖，也可自动另存为“（导入 2）”。
- Persona 支持导出本项目 V2 JSON。
- 未识别的自定义字段保存在 `extraFields`，避免社区资源在导入时被静默丢弃。
- Persona V2 增加标题、年龄、性别、生日、身高、职业、公开表现、私下表现、优点、弱点、兴趣、明确习惯、生活状态、标签、作者/来源等可选字段。
- Prompt 继续执行严格用户事实约束：没有写进 Persona、可信记忆或真实聊天历史的用户习惯、偏好和经历都视为未知。

## Tavo / 酒馆样本研究后的兼容原则

1. 先识别资源类型，再决定导入目标。
2. 社区 JSON 不假设所有作者都遵循固定字段。
3. 结构化字段用于编辑和 Prompt 分层，原始描述与未知扩展字段用于保真。
4. 角色卡转换为 Persona 必须显式提示，因为角色卡与用户人设语义不同。
5. 世界书、预设、正则不能偷偷变成用户人设内容。
6. `{{user}}` / `{{char}}` 这类宏的语义转换后续继续做专门兼容，不在本版静默替换。

## 数据兼容

- IndexedDB 仍为 V8。
- 完整备份格式仍为 V7。
- 新增 Persona 字段均为可选字段，旧 Persona 无需迁移。

## 主要新增文件

- `src/services/personaImportService.ts`
- `src/services/personaImportService.test.ts`

## 主要修改文件

- `src/types/domain.ts`
- `src/services/personaService.ts`
- `src/views/PersonaManagerView.vue`

## 验收

- 导入本项目 Persona JSON。
- 导入通用 JSON。
- 导入 Tavo 风格 TXT 用户人设。
- 导入 Character Card V2/V3 时显示转换警告。
- 尝试把世界书/预设导入 Persona 时被拒绝。
- 未识别字段导入后仍可随 Persona 导出。
- 同名 Persona 可覆盖或另存。
- 导出的 Persona JSON 可再次导入。
- 旧聊天和旧 Persona 正常工作。

---

## 来源：`V0.4.2.3_实时多气泡Action与事实约束修复.md`

# V0.4.2.3 实时多气泡、Action 与事实约束修复

## 本次目标

修复 V0.4.2.2 实测中出现的四类核心体验问题：

1. AI 对当前时间判断与设备时间不一致。
2. 远程模式先在一个流式气泡中显示完整回复，结束后才拆分。
3. 远程回复仍可能把多个完整句子放进同一个气泡，且 Action 不稳定出现。
4. 模型会把没有 Persona、聊天历史或长期记忆依据的用户习惯与偏好当成既有事实。

## 本次完成

- 每次请求把浏览器设备本地日期、星期、精确时间与 UTC 偏移写入 Prompt。
- 明确要求“还有多久”等相对时间必须基于设备时间精确计算；无法确定时只说具体时间，不估算。
- 远程 + 多气泡 + 互动协议模式下，不再创建“先显示整段再拆分”的临时流式大气泡。
- Provider 仍可流式接收，但界面保持“正在输入”，最终内容按实际消息节奏逐条落库、逐条出现。
- 远程文本严格执行“一完整句子一个气泡”，句号、问号、感叹号与明确换行均作为消息边界。
- `scene_action` 在“远程 + 始终显示动作”时要求每轮至少一条；模型遗漏时由状态生成一个安全的 Action 兜底。
- 在身边模式保持原逻辑：动作使用 `（……）` 与对白合并在同一剧情气泡。
- 加强用户事实来源约束：只有 Persona、用户聊天原文和命中的长期记忆可以支持用户习惯、偏好、工作地点、作息、旧经历和旧约定。
- 角色卡示例对话、世界书示例与创作者备注不得被当作用户真实经历。
- 新增无依据用户事实检测；发现“我记得你上次……”“你平时……”“你总是……”“你一直很喜欢……”等缺乏证据的陈述时，真实 Provider 会自动进行一次低温纠偏重写。
- 当前一次性的“我今天想吃寿司”不会被自动提升成“你一直很喜欢吃寿司”。
- IndexedDB 保持 V8，备份格式保持 V7，无需迁移旧数据。

## 建议验收

### 时间
在 11:36 左右发送：

```text
我12点下班
```

回复不应再出现“还有两个小时”之类明显错误的时间估算。

### 远程多气泡
远程模式发送：

```text
我好饿，不过12点就下班了
```

预期：

- 生成期间只显示“正在输入”，不先出现一个完整大气泡。
- 回复完成后按顺序出现 Action 与多个独立消息。
- 每个完整句子独立一个气泡。

### Action
设置：

```text
当前相处状态：远程
角色动作视角：始终显示
```

每轮通常应至少看到一条“角色此刻” Action。

### 用户事实约束
如果用户从未说过喜欢寿司，则角色不能说：

```text
我记得你上次想吃寿司。
你平时不是最喜欢寿司吗？
```

如果不知道，应自然询问或只回应当前问题。

## 数据

```text
项目版本：0.4.2.3
IndexedDB：V8
备份格式：V7
```

---

## 来源：`V0.4.2.2_构建修复说明.md`

# V0.4.2.2 构建修复说明

## 修复内容

Windows 执行 `npm run build` 时，V0.4.2.1 出现：

```text
src/views/ChatRoom.vue:145:7 - error TS6133:
'displayedConversationState' is declared but its value is never read.
```

V0.4.2.2 将该计算属性实际用于：

- `ChatThoughtPanel` 的 `conversation-state`
- `ChatSettingsPanel` 的 `conversation-state`

这样既消除严格类型检查错误，也让界面读取到 `auto / together / remote` 解析后的有效相处状态。

## 数据兼容

- IndexedDB：V8
- 备份格式：V7
- 不需要迁移角色、聊天、图片、Persona、世界书或记忆。

## 构建

```powershell
npm install
npm run build
```

构建开头应为：

```text
> ai-companion-phone@0.4.2.2 build
> vue-tsc -b && vite build
```

---

## 来源：`V0.4.2.1_场景距离双模式消息与记忆纠偏.md`

# V0.4.2.1 场景距离双模式消息与记忆纠偏

## 本次目标

修复 V0.4.2 实际聊天中暴露的三个核心问题：远程回复仍容易堆在一个气泡、动作描写无法根据相处状态切换表现、明确记忆指令的分类与冲突处理不够准确。

## 场景距离双模式消息

聊天设置新增“当前相处状态”和“角色动作视角”。

### 在身边

- `scene_action` 会转换为中文全角括号动作并和对白合并进同一个剧情气泡。
- 同一轮可以保留多段对白与动作，不强制拆成手机短消息。
- 适合见面、约会、同处一个房间等面对面场景。

示例：

```text
（柏源把菜单推到你面前）
先看看想吃什么。

（抬眼看你）
不是刚才还喊饿吗？
```

### 不在身边

- 对白按真实手机节奏保存为多条独立消息，而不是只在视觉上换行。
- 角色当前的身体动作仍可由玩家看到，但会作为独立 Action 样式显示，不冒充角色发送的文字。
- `typing_pause`、撤回、回应表情等继续作为手机行为处理。
- 每轮远程场景动作通常控制在 0～2 条，只保留有情绪或情境价值的动作。

示例：

```text
[柏源此刻] 柏源把刚拿到的行李推到一旁，低头看了一眼手机。

行李拿到了。

我现在出来。

五点以后去找你。
```

## 动作视角

可选：

```text
始终显示
只在身边显示
关闭动作描写
```

默认“始终显示”。“自动”相处状态读取持续状态中的 `presence`，也可手动指定“在身边 / 远程”。

## 记忆纠偏

- “请记住，我下周三有面试”优先保存为客观事实 / 未来事件，不再误判为共同经历。
- “明天面试，记得提醒我”可同时形成事实和承诺提醒。
- 重复发送同一事实会合并，不重复创建。
- “有面试”与“没有面试”等同主题正反表达会标记为冲突。
- 记忆管理页可选择“采用这条 / 保留另一条 / 两者都保留”。
- “下周三”按下一自然周的星期三解析，不再误算成最近的星期三。
- 明确记忆指令会把本轮写入结果交给角色，让角色自然确认，不再机械回复“然后呢？”。
- Prompt 增加共同经历真实性约束：没有聊天历史或命中记忆支持时，不应编造“我记得你上次……”等共同经历。

## 数据兼容

```text
项目版本：0.4.2.1
IndexedDB：V8（不升级）
备份格式：V7（不升级）
```

本次新增字段均提供旧数据默认值，不需要迁移现有角色、聊天、图片、Persona、世界书、关系和长期记忆。

---

## 来源：`V0.4.2_长期记忆与主动陪伴系统升级.md`

# V0.4.2 长期记忆与主动陪伴系统升级

## 本次目标

让角色不只拥有丰富设定，还能可靠地记住重要信息、延续尚未结束的话题，并以更接近真实手机聊天的节奏主动互动。

## 主要升级

### 多层长期记忆

记忆拆分为：

- 客观事实
- 角色主观记忆
- 共同经历
- 承诺和约定
- 关系事件
- 长期剧情

自动提取支持“请记住”“别忘了”“提醒我”等明确记忆表达，并识别生日、偏好、面试、考试、旅行、复诊等重要信息。相似内容会合并，单值事实出现不同内容时会标记冲突。

### 记忆管理

新增完整记忆管理页面：

```text
聊天页 → 右上角 ··· → 记忆 → 打开完整记忆管理
```

支持查看本轮命中、分层筛选、手动添加、编辑、锁定、降权、标记错误、解决冲突和永久删除。锁定记忆视为高可信事实；错误和未解决冲突不会直接进入 Prompt。

### 状态协议 V2

持续状态新增：

- 当前地点和时间段
- 当前活动、心情和精力
- 当前关系感受
- 未完成话题
- 等待中的事件
- 短期目标
- 最近完成事件

状态只在确实发生变化时更新，并记录自然语言变化历史，不向聊天正文泄露 JSON 或技术字段。

### 主动陪伴

主动消息现在可以来源于：

- 延续话题
- 履行承诺
- 分享日常
- 关心状态
- 剧情事件

支持低、自然、较高三档频率、最短联系间隔、安静时段和来源开关。主动时间还会参考角色主动程度和关系阶段，并避免连续重复同一种模板。

### 小手机动作协议 V2

新增：

- 输入停顿
- 撤回角色消息
- 对用户消息作表情回应
- 主动分享图片占位
- 更完整的持续状态更新

普通模型仍可直接返回文字；协议解析失败时继续保留可见正文。

### Prompt 调试器增强

新增：

- Prompt 分区字符预算
- 较早消息省略和超预算提醒
- 世界书触发原因
- 记忆命中分数与原因
- 影响本轮回复的角色规则
- 原始输出与用户可见回复对比
- 一键复制完整调试报告
- 角色一致性、AI 腔、重复、提问、长度、关系回应和图片使用等自然度评分

## 数据兼容

- IndexedDB：V8
- 备份格式：V7
- 旧角色、聊天、图片、Persona、世界书和 V1～V6 备份继续兼容
- Prompt 调试记录仍只保存在本地，不进入备份

## 验收重点

- 明确要求记住的内容能够保存
- 相似记忆不会反复新增
- 单值事实冲突会显示待处理状态
- 记忆可编辑、锁定、降权、标错和删除
- 主动消息能够延续具体话题或提醒约定
- 状态字段不会出现在聊天正文
- 连续短消息、停顿、撤回和回应表情正常
- 调试器能解释世界书与记忆命中原因
- `npm run build` 在 Windows 项目目录通过

---

## 来源：`V0.4.1.1_构建修复说明.md`

# V0.4.1.1 构建修复

## 修复内容

- 修复 Dexie `EntityTable` 类型不支持直接调用 `first()` 导致的 TypeScript 错误。
- 改为通过 `toCollection().first()` 读取删除默认 Persona 后的下一条记录。
- 删除 `ChatRoom.vue` 中已经不再使用的 `saveAssistantBubbles()` 旧兼容函数，解决 `TS6133`。
- 项目版本更新为 `0.4.1.1`。

## 数据兼容

- 不修改 IndexedDB 结构。
- 不修改备份格式。
- 原有角色、Persona、世界书、聊天记录和图片无需迁移。

## 验证命令

```powershell
npm install
npm run build
```

---

## 来源：`V0.4.1_角色互动引擎与小手机行为系统.md`

# V0.4.1 角色互动引擎与小手机行为系统

## 版本目标

让模型不再只能返回一个大段文字气泡，而是可以在不暴露技术字段的前提下，像真实聊天对象一样选择连续短消息、表情、语音样式和状态变化；同时补齐 Prompt 调试、记忆命中查看和酒馆角色卡 JSON 兼容能力。

## 本次完成

### 小手机互动协议

- 新增隐藏的 `<companion_packet>` 输出协议。
- 支持 `text`、`emoji`、`voice` 三类角色消息。
- 单轮最多生成 4 条连续消息，界面按顺序逐条出现。
- 普通模型不输出协议时继续按纯文本兼容，不强制每轮使用动作协议。
- 流式生成时会隐藏尚未完成的协议标签，避免 JSON 或 XML 闪现在聊天气泡里。
- 协议解析失败时保留可见正文，不让状态数据破坏正常回复。

### 回复节奏与主动陪伴

- 新增关闭、快速、自然、慢速四种消息节奏。
- 连续消息会结合角色回复速度、消息长度和消息类型计算间隔。
- 主动消息会优先延续用户之前提到但尚未结束的话题。
- 主动程度、角色说话风格和关系阶段会影响主动消息的语气。
- 主动陪伴不使用催促、威胁离开或情感施压。

### 结构化角色状态

- 模型可在隐藏协议中更新心情、活动、地点、关系感受和短暂内心想法。
- 正文与状态数据分离，技术标签不会显示给用户。
- 心理活动面板新增地点和关系感受展示。
- 继续兼容旧的 `<role_status>` 状态格式。

### Prompt 调试与记忆命中

- 每个聊天可保存最近 20 次本地 Prompt 调试记录。
- 可查看角色模式、Persona、模型、上下文字符数、图片数量。
- 可查看本轮触发的世界书和实际注入的长期记忆。
- 可查看最终 System Prompt、最近聊天上下文、模型原始输出和用户可见回复。
- 新增常见 AI 腔检测：图片助手腔、客服二选一、模型身份暴露、说明文列表腔等。
- 调试记录只保存在当前浏览器，不随备份导出。
- 长期记忆不再简单全部注入，而是结合关键词重合、重要度、类别和更新时间选择本轮相关记忆。

### 酒馆角色卡兼容

- 支持导入 SillyTavern Character Card V2 JSON。
- 支持导入 SillyTavern Character Card V3 JSON 的主要通用字段。
- 支持常见旧版角色 JSON。
- 支持 `{{user}}`、`{{char}}` 和 `<START>` 示例对话格式。
- 支持导出为 SillyTavern V2 JSON。
- 角色卡新增作者、资源版本、来源链接、许可说明、是否允许二改和导入格式。
- 当前版本尚未读取 PNG 角色卡中的嵌入元数据。

### 数据升级

- IndexedDB 升级至 V7，新增 `promptDebugTraces` 表。
- 备份格式升级至 V6。
- 备份包含角色卡资源元数据、互动消息和结构化角色状态。
- Prompt 调试记录出于隐私和体积考虑不进入备份。
- 继续兼容 V1～V5 旧备份。

## 主要新增文件

```text
src/services/interactionProtocol.ts
src/services/promptDebugService.ts
src/services/characterCardImportService.ts
src/views/PromptDebugView.vue

src/services/interactionProtocol.test.ts
src/services/characterCardImportService.test.ts
src/services/memoryService.test.ts
```

## 使用入口

```text
聊天页 → 右上角 ··· → 角色扮演 → 小手机互动协议
聊天页 → 右上角 ··· → 聊天 → 连续消息节奏
聊天页 → 右上角 ··· → 高级 → 查看本轮 Prompt、世界书与记忆命中
角色详情 → 沉浸角色卡 → 导入角色卡 JSON / 导出为 V2 JSON
```

## 已知限制

- “语音消息”目前是语音样式气泡，并使用浏览器 TTS 播放，不是模型生成的真实音频文件。
- 主动消息只会在应用打开并满足时间条件时检查，尚无后台推送。
- 不同模型对隐藏协议的遵循程度不同；解析器会自动回退纯文本。
- PNG 角色卡、完整 V3 扩展字段和酒馆正则脚本尚未兼容。
- Prompt 调试内容可能包含角色卡和聊天上下文，只适合用户本人在本地查看。

---

## 来源：`V0.4.0_角色卡与沉浸剧情系统升级.md`

# V0.4.0 角色卡与沉浸剧情系统升级

## 本次定位

V0.4.0 将项目从“带角色设定的 AI 聊天”升级为“角色卡驱动的长期陪伴与剧情系统”。角色身份、用户 Persona、场景、世界书、关系和示例对话会按固定层级编排，图片只作为角色看到的信息，不再把回复带回通用图片分析助手的语气。

## 角色卡 V2

- 新增外貌、价值观、习惯、弱点、秘密、边界和标签。
- 新增当前场景、默认开场白和多条备用开场白。
- 新增示例对话，用真实台词塑造角色语气和聊天节奏。
- 新增主动程度、动作描写、表情频率和提问频率。
- 新增角色专属规则、回复前最终提醒和创作者备注。
- 旧角色会自动补默认值，不需要重新创建。

## 用户 Persona

- 可以建立多套“我”的身份、外貌、性格、背景和关系说明。
- 每段聊天可以选择独立 Persona，也可以沿用默认 Persona。
- 明确约束角色不能替用户决定动作、台词、心理或感受。

## 世界书 Lorebook

- 支持世界级和角色专属设定。
- 支持关键词触发、常驻条目、大小写匹配和优先级。
- 仅把本轮相关设定注入上下文，避免每轮塞入全部世界资料。

## 沉浸 Prompt 编排器

上下文按以下层级组织：

```text
角色卡
→ 用户 Persona
→ 当前关系与情绪
→ 长期记忆和剧情摘要
→ 本轮触发的世界书
→ 示例对话
→ 图片内部观察
→ 本轮用户消息
→ 回复前最终角色约束
```

同时加入去 AI 腔规则：不机械复述、不客服式二选一、不强制每条提问、不把图片写成分析报告，也不频繁使用固定开场和表情。

## 酒馆式聊天操作

- AI 回复支持保留多个候选版本，并在气泡下左右切换。
- 长按 AI 消息可“换一个回复”，旧版本不会消失。
- 支持编辑任意消息。
- 支持继续生成当前角色回复。
- 支持从任意消息创建独立聊天分支。
- 支持 `/ooc 指令` 或 `OOC：指令` 临时导演剧情，角色不会复述指令标签。
- 可以从聊天设置中插入默认或备用开场白。

## 图片陪伴感

- 图片信息先作为内部视觉观察，再由角色结合附言、关系和性格自然回应。
- 默认不复述图片数量、文件名、构图或分析步骤。
- 用户表达喜欢、吃醋、怀念等情绪时，优先回应关系含义。
- 无法确认真实人物身份时保持诚实，但不破坏角色语气。

## 数据与兼容

- IndexedDB 升级至 V6，新增 `personas` 和 `lorebookEntries`。
- 备份格式升级至 V5，包含 Persona 与世界书。
- 兼容导入旧版 V1～V4 备份。
- 原有角色、消息、图片、关系、记忆和模型配置继续保留。

## 功能入口

```text
角色详情 → 沉浸角色卡
设置 → 用户人设 Persona
设置 → 世界书 Lorebook
聊天页 → 右上角 ··· → 角色扮演
长按 AI 回复 → 换一个回复 / 继续生成 / 创建分支 / 编辑
输入框输入 /ooc 你的导演指令
```

---

## 来源：`V0.3.8_图片处理可靠性与多图理解升级.md`

# V0.3.8 图片处理可靠性与多图理解升级

## 本次完成

- 图片改为串行队列处理，连续选择多张 2K 图片时逐张解码、压缩并释放资源。
- 优先使用 `ImageBitmap` 解码，失败后自动回退到 `HTMLImageElement`。
- 优先尝试 JPEG，失败后自动切换 WebP；两种编码都失败时回退安全原图。
- 对 JPEG、PNG、WebP、GIF 增加原图兜底，不再因为单次 Canvas 编码失败直接丢图。
- 失败项显示文件名、真实原因、原始体积、格式和已尝试路径。
- 失败图片支持单独重试、使用原图和移除。
- 已处理图片支持查看尺寸、压缩前后体积和处理方式。
- 待发送图片支持前移、后移，AI 按用户调整后的顺序接收。
- 处理进度显示当前文件名和完成数量。
- 重复图片、超出 6 张上限和失败图片分别统计，不再只显示模糊的“无法处理”。
- AI 图片回复状态新增“已发送、检查能力、正在查看、组织回复、文字兜底”。
- 图片消息完成后显示“AI 已查看 N 张图片”或“模型未读取图片”。
- 多图提示词增加图片顺序和文件名，便于模型区分图片 1、图片 2。
- 图片下载会根据真实 MIME 类型使用 JPG、PNG 或 WebP 扩展名。
- 数据库版本不变，旧单图、多图消息和备份继续兼容。

## 验收建议

1. 一次选择 6 张 2K PNG，确认逐张处理且页面不冻结。
2. 混合选择正常图片、损坏图片和超过 15 MB 的图片。
3. 确认失败项能显示具体文件名和原因。
4. 分别测试“重试”“使用原图”“移除”。
5. 调整图片顺序后发送，确认消息网格顺序一致。
6. 观察 AI 回复前的图片处理状态和回复后的“AI 已查看”状态。
7. 刷新页面，确认已发送图片和旧聊天记录正常。

---

## 来源：`V0.3.7_图片与消息体验完整升级.md`

# V0.3.7 图片与消息体验完整升级

## 本次完成

- 单图根据横图、方图、竖图自动使用不同气泡尺寸，避免长图占满整屏。
- 2～6 张图片重新设计网格布局，5～6 张使用三列紧凑网格。
- 全屏图片预览支持左右滑动、键盘方向键、缩略图跳转和保存当前图片。
- 图片处理改为逐张容错，一张图片失败不会导致整批图片全部丢失。
- 重复图片会自动跳过，超过 6 张的部分会给出明确提示。
- 图片整理过程显示进度。
- 普通提示改为悬浮提示并在约 3 秒后自动消失，不再长期占据聊天顶部。
- 待发送图片显示顺序编号、压缩后总体积和单张原图限制说明。
- 图片最大处理边长提高到 1440 像素，压缩目标调整为约 760 KB。
- 保留相册多选、相机拍摄、图片理解、保存全部图片和旧单图消息兼容。

## 兼容性

- 数据库版本不变。
- 原有角色、会话、消息、图片和设置无需迁移。
- 旧单图消息和 V4 备份继续兼容。

## 建议验证

- 横图、方图和竖图的聊天气泡尺寸。
- 一次选择 2～6 张图片，以及分多次追加图片。
- 混合选择正常图片、超大图片和重复图片。
- 全屏左右滑动、缩略图切换和保存当前图片。
- PWA 更新后清除旧 Service Worker 缓存。

---

## 来源：`V0.3.6.2_文件选择器兼容性修复.md`

# V0.3.6.2 文件选择器兼容性修复

- 相册与相机入口改为原生 label/input 绑定，不再调用 input.click()。
- 隐藏文件输入框改为视觉隐藏，避免部分浏览器阻止 display:none 输入框。
- 相册继续支持多选，最多累计 6 张。
- 相机入口继续使用后置摄像头提示。
- 部署后需清除旧 PWA 缓存或注销 Service Worker。

---

## 来源：`V0.3.6.1_多图选择入口修复.md`

# V0.3.6.1 多图选择入口修复

- 修复聊天输入区“＋”按钮在部分浏览器中无法打开相册的问题。
- 相册选择器改为在用户点击时直接触发，避免跨组件调用被浏览器拦截。
- 保留 `multiple` 多选能力，一次最多选择并累计 6 张图片。
- 每次打开相册前清空旧选择值，允许连续选择同一张图片或继续追加图片。
- “📷”按钮继续只负责调用设备相机。
- 图片隐私提示改为选择完成后、处理图片前确认。

---

## 来源：`V0.3.6_聊天逻辑解耦与多图陪伴升级.md`

# V0.3.6 聊天逻辑解耦与多图陪伴升级

## 本次完成

- 一条消息最多发送 6 张图片
- 相册多选与移动端相机拍摄
- 多图发送前预览、逐张移除和全部清空
- 多图气泡自适应网格和全屏轮播
- 多张图片作为同一轮视觉输入发送给兼容模型
- 长按多图消息可保存全部图片
- 拆出心理活动和一起听歌面板
- 提取语音、滚动和面板拖动 composables
- 旧单图消息、旧聊天记录和 V4 备份继续兼容
- 数据库仍为 V5，无需迁移

## 新增文件

```text
src/composables/useBottomPanel.ts
src/composables/useChatScroll.ts
src/composables/useChatSpeech.ts
src/components/chat/ChatThoughtPanel.vue
src/components/chat/ChatMusicPanel.vue
src/services/messageImageService.ts
```

## 验证

- `vue-tsc -b` 严格类型检查通过
- 27 个 Vue 单文件组件解析与模板编译通过
- 当前容器缺少 Rollup Linux 可选模块，完整生产构建需在 Windows 执行 `npm run build` 复核

---

## 来源：`V0.3.5_聊天页面组件化与语音设置优化.md`

# V0.3.5 聊天页面组件化与语音设置优化

## 本次升级

- 新增 `ChatHeader.vue`，负责聊天顶部导航与入口
- 新增 `ChatMessageList.vue`，负责消息列表、输入状态和滚动容器
- 新增 `ChatSettingsPanel.vue`，负责聊天、记忆、语音和高级设置
- 新增 `ChatActionSheet.vue`，负责消息长按操作
- 新增 `ChatImagePreview.vue`，负责全屏图片预览
- 设置面板新增“试听当前角色声音”
- 试听沿用当前角色的音色、语速与情绪节奏
- 保留语音输入、AI 朗读、流式回复、图片理解、引用、重试、关系、记忆与音乐功能

## 架构说明

`ChatRoom.vue` 仍是会话编排页面，但不再直接承载顶部、消息列表、设置、消息操作和图片预览的完整模板。后续可以继续拆分心理活动、音乐面板，以及请求、语音和滚动 composables。

## 数据兼容

- IndexedDB 仍为 V5
- 备份格式仍为 V4
- 不需要迁移已有聊天、角色、记忆和设置数据

## 验证

- TypeScript 严格类型检查通过
- 当前容器缺少 Rollup Linux 可选模块，完整生产构建请在 Windows 项目目录执行：

```powershell
npm install
npm run build
```

---

## 来源：`V0.3.4_语音陪伴与聊天可靠性升级.md`

# V0.3.4 语音陪伴与聊天可靠性升级

本版本按“先体验、后重构”的顺序完成第一批升级，尽量避免一次性改动过大。

## 已完成

### 语音输入

- 点击麦克风开始或结束语音输入。
- 长按麦克风录音，松开后结束。
- 显示录音时长和识别中的状态。
- 支持取消本次录音。
- 识别结果自动填入输入框，由用户确认后发送。
- 未识别到内容或识别失败时提供重试提示。
- 首次使用前展示麦克风与隐私说明。
- 浏览器不支持时自动隐藏语音入口。

### AI 语音播放

- AI 文字回复下方增加朗读按钮。
- 支持暂停、继续和停止。
- 聊天设置中可开启自动朗读。
- 每个聊天角色可独立保存声音和基础语速。
- 根据角色说话风格、当前情绪和关系阶段轻微调整语速与停顿。
- 当前环境无法播放语音时只显示文字。

### 消息可靠性

- 用户消息显示发送中、已发送、已读、失败和停止状态。
- 失败或停止状态可直接点击重试。
- 停止生成后保留已出现的流式内容。
- AI 回复过程中输入框仍可编辑并保存下一条消息草稿。

## 兼容说明

语音输入和朗读能力取决于浏览器与系统。功能不可用时会自动降级，不影响文字聊天、图片消息和原有模型调用。

## 下一批建议

继续拆分 `ChatRoom.vue`：

- `ChatHeader.vue`
- `ChatMessageList.vue`
- `ChatActionSheet.vue`
- `ChatImagePreview.vue`
- `ChatSettingsPanel.vue`

拆分完成后再扩展更细的角色音色预设、主题和主动语音消息。

---

## 来源：`V0.3.3_本次更新说明.md`

# V0.3.3 本次更新说明

## 版本主题

**流式陪伴与聊天架构升级**

## 新增功能

- AI 回复可以边生成边显示，不再等待整段内容全部完成。
- 流式文字在角色气泡中实时呈现，并带有轻量输入光标。
- 图片理解回复同样支持流式输出。
- 本地模拟模式加入逐步回复，未配置接口也能测试效果。
- 聊天设置新增“边想边回复”，可按会话开启或关闭。
- 接口不返回 SSE 时自动兼容普通 JSON 回复。

## 停止与可靠性

- 生成过程中点击“停止”，已经显示的文字会保留下来。
- 网络在流式回复途中断开时，现有内容会保留并标记“回复中断”。
- 页面刷新或异常退出后，遗留的发送中消息会恢复为“已停止”，可以重新发送或重新生成。
- 流式内容约每 140 毫秒节流写入 IndexedDB，减少高频数据库操作。
- 自动滚动使用 `requestAnimationFrame`，用户上滑查看旧消息时不会被强行拉回底部。

## 代码结构

新增两个聊天子组件：

```text
src/components/chat/ChatMessageItem.vue
src/components/chat/ChatComposer.vue
```

其中：

- `ChatMessageItem` 负责消息气泡、头像、图片、引用、发送状态和流式光标。
- `ChatComposer` 负责文本输入、图片选择、待发送图片预览、引用预览、发送和停止按钮。
- `ChatRoom` 继续负责会话加载、Provider 请求、记忆、关系和音乐等编排逻辑。

## Provider 改进

- `ModelProvider` 新增 `chatStream(request, handlers)`。
- OpenAI 兼容 Provider 支持解析 `text/event-stream` 中的 `data:` 事件。
- 支持 `choices[0].delta.content` 字符串或文本数组。
- 对返回 `application/json` 的兼容接口自动调用增量回调并正常完成。
- 视觉不支持自动重试和真实接口失败后的本地兜底逻辑继续保留。

## 使用方法

进入：

```text
聊天页 → 右上角 ••• → 聊天
```

开启“边想边回复”。该设置默认开启。

## 升级说明

本版本不修改 IndexedDB 索引，也不升级备份格式。直接覆盖 V0.3.2 源码即可，已有聊天设置会自动补上流式回复默认值。

---

## 来源：`V0.3.2_本次更新说明.md`

# V0.3.2 本次更新说明

本版本将 V0.3.1 的“能发送图片”升级为“角色在模型支持时可以真正看见图片”，并补齐图片发送确认、能力检测、失败重试和备份体积控制。

## 图片理解

- 图片会以 OpenAI 兼容多模态格式发送给当前模型
- 支持图片与文字附言一起发送
- 视觉模型可根据人物、宠物、食物、风景、截图和图片文字自然回复
- 自动模式会记录当前接口与模型的检测结果
- 模型不支持图片时自动改用文字兜底，不猜测图片细节
- 本地模拟模型继续只生成演示回复，不读取图片内容

## 发送体验

- 选择图片后先显示预览，不会立刻发送
- 可在预览状态下补充一句话、移除图片或重新选择
- 图片处理期间显示“正在整理图片”
- 等待图片回复时显示“正在认真看你发来的图片”
- 用户消息显示发送中、发送失败或已停止状态
- 失败或停止的消息可长按后重新发送
- 图片消息长按可保存到设备
- 路由切换不再让整个手机外框消失后重新出现

## 图片处理与隐私

- 单张原图最大 15 MB
- 最长边自动缩放到 1280 像素
- 较大的图片会逐步降低 JPEG 质量，目标约 900 KB
- 第一次选择图片时显示隐私确认
- 图片仍保存在当前浏览器 IndexedDB 中

## 模型设置

新增“图片理解”设置：

- 自动检测并降级
- 始终按视觉模型发送
- 关闭图片理解
- 测试图片理解
- 显示当前能力状态

切换供应商、API 地址或模型后，旧的图片能力检测结果会自动失效并重新检测。

## 记忆与关系

- 图片附言继续参与重要记忆提取
- 分享图片会提高熟悉度和亲密度
- 角色在收到图片时会进入更符合场景的“好奇”状态

## 数据与备份

- 消息新增图片尺寸、压缩后体积、是否使用视觉和是否降级等元数据
- 备份格式升级至 V4
- 导出时可以选择是否包含聊天图片
- 备份预览显示图片数量和图片体积
- 继续兼容 V1、V2、V3 备份导入

---

## 来源：`V0.3.1_本次更新说明.md`

# V0.3.1 本次更新说明

本版本集中优化聊天沉浸感与手机操作体验，不改变已有角色、模型和记忆设置。

## 新增

- 聊天输入框会随文字自动增高，最高保持在适合手机操作的范围
- 消息列表离开底部后显示“回到最新消息”按钮
- 长按消息可以选择“回复”，发送后会显示引用内容
- 支持从输入框左侧“＋”选择并发送图片
- 聊天图片会自动压缩，并支持点击全屏预览
- 心理活动、一起听歌、聊天设置与消息菜单支持下滑关闭
- 页面切换加入轻量手机式过渡动画
- 气泡出现加入自然的淡入上移动画

## 优化

- 全项目隐藏浏览器滚动条，但继续保留滚动能力
- 去除移动端按钮点击蓝色高亮和不必要的文字选中
- 使用 Visual Viewport 适配手机软键盘，减少输入时页面跳动
- 加强 iPhone 安全区和底部 Home Indicator 避让
- 长按消息菜单增加轻微触觉反馈（设备支持时）
- 聊天面板滚动继续保留惯性效果

## 数据

- 消息新增图片数据、图片名称与引用消息快照
- 备份格式升级至 V3
- V3 备份包含关系成长与关系事件，并继续兼容 V1、V2 备份导入
- 图片会保存在浏览器 IndexedDB 中，建议定期导出备份

## 使用方式

- 点击输入框左侧“＋”选择图片
- 长按任意消息后点击“回复”
- 在消息列表向上浏览时，点击右下角“↓”回到最新消息
- 按住底部面板顶部的小横条向下滑动即可关闭

---

## 来源：`V0.3.0_本次更新说明.md`

# V0.3.0 本次更新说明

- 新增关系成长系统：初识、熟悉、亲近、依赖、特别关系。
- 新增亲密、信任、熟悉度内部数据，界面仅展示自然关系描述。
- 新增动态情绪与情绪原因，并影响角色回复与心理活动。
- 新增主动陪伴：久未聊天后，打开会话时角色可自然发来问候。
- 新增主动消息开关与间隔设置。
- 新增一起听歌关系事件与关系成长。
- 数据库升级到 V5，兼容旧数据。
- 聊天主界面继续保持沉浸式，不显示模型或接口信息。

---

## 来源：`V0.2.0_本次更新说明.md`

# V0.2.0 本次更新说明

## 这次新增

1. 聊天页改成干净的真实手机风格，主界面不显示模型名称和 API 状态。
2. 点击聊天顶部角色头像或名字，可以查看角色心情、当前状态和面向用户展示的心理活动。
3. 右上角新增“♫”一起听歌：支持网络音频地址、本地音频、播放进度和角色陪听反应。
4. 右上角新增“•••”聊天设置：回复长度、多气泡、正在输入、自然发送间隔、心理活动可见程度。
5. 新增三层记忆：最近聊天、旧对话摘要、重要记忆。
6. 自动识别姓名、喜好、事件、关系和约定，也可以手动新增、删除和清空记忆。
7. 长按消息可以复制、删除，角色消息还可以重新生成。
8. 支持停止等待回复、草稿自动保存、滚动位置恢复和消息时间分隔。
9. 模型状态、接口错误和自动降级选项只放在聊天设置的“高级”页面。
10. 数据库升级到 V4，备份格式升级到 V2，并兼容旧版 V1 备份。

## 使用提示

- “心理活动”是根据角色设定和聊天内容生成的虚构角色表现，不是模型内部推理。
- 本地音频使用浏览器临时地址，刷新页面后需要重新选择；网络音频地址可以保存。
- 第一次打开旧数据时，Dexie 会自动升级数据库，不会主动清除原来的角色和聊天。

## 本地验证

```powershell
npm install
npm run build
npm run dev
```

如果网页仍显示旧版，请停止开发服务后重新运行，并在浏览器中按 `Ctrl + F5`。

---

# 旧版架构演进原文归档

> 下方内容来自整理前的 `ARCHITECTURE.md` 历史章节，保留用于追溯早期设计决策。

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
│   ├── Real Provider Adapter（DeepSeek / OpenAI-compatible）
│   └── Token / Network Error Handling
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


---

## 21. V0.1.0 模型发现与选择架构

### 21.1 Provider 接口扩展

```text
ModelProvider
├── chat(request)
├── listModels()
└── testConnection()
```

`listModels()` 返回统一的 `ProviderModel[]`，页面不直接解析各服务商的原始响应。

### 21.2 模型拉取流程

```text
用户填写 API 地址与 Key
↓
点击“拉取模型”
↓
OpenAICompatibleProvider.listModels()
↓
GET {baseUrl}/models
↓
解析 data / models / 字符串数组
↓
去重模型 ID
↓
生成下拉框
↓
保存可用模型列表与当前选择
```

### 21.3 双模式选择

```text
模型列表可用 → 下拉选择
接口不支持 /models → 手动填写
```

该设计保证标准接口操作方便，也兼容不提供模型枚举的第三方服务。

### 21.4 地址规范化

保存前移除：

- 末尾多余 `/`
- `/models`
- `/chat/completions`

Provider 再统一拼接实际接口路径，避免地址重复。

### 21.5 旧模型迁移

读取 DeepSeek 设置时，如发现旧模型：

```text
deepseek-chat
deepseek-reasoner
```

自动迁移到当前默认模型，并保留拉取模型功能供用户刷新服务端实际列表。


---

## 22. V0.2.0 沉浸式聊天、记忆与音乐架构

### 22.1 聊天界面边界

聊天主界面只展示角色身份、消息与真实手机式交互。Provider、模型名、降级和技术错误不会直接显示在消息顶部，而是保存到消息元数据或 `conversationStates`，仅在右上角聊天设置的“高级”标签中查看。

### 22.2 数据表

- `chatSettings`：每个会话独立的回复长度、多气泡、输入动画、自然延迟、记忆和心理活动设置。
- `memories`：结构化的重要用户信息，按会话和角色隔离。
- `conversationStates`：旧对话摘要、角色可见心理状态、最近技术错误。
- `musicStates`：一起听歌的曲目、地址、进度、音量和播放状态。

### 22.3 三层记忆

1. 最近聊天：按 `recentMessageLimit` 取最后若干消息。
2. 对话摘要：消息积累到阈值后，把较旧消息压缩为本地摘要。
3. 重要记忆：从用户消息中提取姓名、喜好、事件、约定和关系信息，也支持手动管理。

最终系统提示由角色设定、用户资料、摘要、重要记忆和最近聊天共同组成。

### 22.4 心理活动

心理活动属于面向用户的角色化状态，不读取或展示模型内部推理。在线 Provider 可生成结构化 JSON；失败或使用 Mock 时由本地角色规则生成。

### 22.5 一起听歌

音乐由浏览器原生 `HTMLAudioElement` 播放。网络音频地址可持久化，本地文件使用临时 Object URL，只在当前浏览器会话有效。角色陪听反应作为 `type: music` 的普通角色消息写入消息表。

### 22.6 请求取消与降级

`ChatRequest` 支持 `AbortSignal`。用户点击停止后中断网络请求、Mock 等待或多气泡间隔。在线 Provider 失败时是否降级由全局模型设置和当前会话 `autoFallback` 共同决定。

---

## V0.3.1 交互层补充

### 消息扩展

`Message` 支持：

- `type: 'image'`
- `imageDataUrl`
- `imageName`
- `replyTo` 引用消息快照

引用使用快照而不是运行时关联查询，即使原消息被删除，已发送的引用气泡仍能显示当时的发送者与摘要。

### 图片保存策略

图片选择后在浏览器端缩放到最长边不超过 1440 像素，并在需要时压缩为 JPEG。压缩结果以 Data URL 写入 IndexedDB，适合当前本地原型；未来大量图片场景应迁移到 Blob 表或对象存储。

### 视口与键盘

`PhoneFrame` 监听 `window.visualViewport`，将可视高度写入 `--app-viewport-height`。手机软键盘出现时，手机外框和聊天区域使用新的可视高度重新布局，减少输入框被遮挡或页面整体跳动。

### 底部面板手势

面板顶部拖动条使用 Pointer Events 和 pointer capture。向下位移超过阈值时关闭，未超过阈值时回弹。面板内容区域仍保持独立滚动。


## V0.3.2 多模态与消息可靠性补充

### 多模态消息类型

Provider 的 `ChatTurn.content` 从单一字符串扩展为：

```ts
string | Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
>
```

聊天页只在回复当前图片消息时把该图片的 Data URL 放入请求。历史图片使用文字摘要，避免每轮对话重复上传全部图片。

### 图片能力状态

`ModelSettings` 新增：

- `visionMode`: `auto | enabled | disabled`
- `visionSupported`
- `visionTestedSignature`
- `visionTestedAt`

能力签名由供应商、标准化 API 地址和模型名称组成。切换其中任意一项后，旧检测结果自动失效。

自动模式流程：

1. 首次图片消息按多模态格式发送。
2. 成功后缓存“支持图片”。
3. 若接口返回图片内容类型不兼容错误，立即用文字消息重试。
4. 文字重试成功后缓存“不支持图片”。
5. 后续图片直接使用自然兜底，避免重复失败。

### 图片处理

`imageService.ts` 负责：

- 文件类型与 15 MB 上限检查
- 最长边缩放到 1280 像素
- 大图转 JPEG
- 逐步降低质量直到接近 900 KB 目标
- 计算 Data URL 近似字节数

处理结果保存图片宽高、压缩后体积和原始体积，聊天消息保存其中与展示、备份有关的字段。

### 消息状态

用户消息写入时状态为 `pending`。角色回复完成后改为 `read`；请求失败改为 `failed`；主动停止改为 `cancelled`。失败和停止消息可以复用原消息重新请求，不会重复插入用户气泡。

### 图片隐私

第一次打开图片选择器时使用本地一次性确认。确认状态只保存在 `localStorage`，不会进入备份。图片仍由当前配置的第三方模型服务处理，应用不承诺第三方服务的数据保留策略。

### 备份 V4

V4 继续使用 JSON，但导出函数接受 `includeImages`。关闭时保留图片消息、文件名与附言，移除 `imageDataUrl` 和图片体积。恢复后聊天页会显示“图片未包含在这份备份中”。


## V0.3.3 流式回复架构

### Provider 增量接口

`ModelProvider` 在普通 `chat()` 之外新增：

```ts
chatStream(
  request: ChatRequest,
  handlers?: {
    onDelta?: (chunk: {
      delta: string
      text: string
    }) => void | Promise<void>
  }
): Promise<ChatResponse>
```

`delta` 是当前新增片段，`text` 是截至当前的完整文本。聊天页不直接解析供应商协议，只消费统一增量事件。

### OpenAI 兼容 SSE

`OpenAICompatibleProvider` 发送 `stream: true`，并处理：

- `Content-Type: text/event-stream`
- `data: { ... }` 事件
- `data: [DONE]`
- `choices[0].delta.content`
- 兼容文本数组内容

若兼容接口忽略流式参数并返回 `application/json`，Provider 会提取完整消息并以一次增量事件交给界面，因此不会破坏原有接口兼容性。

### 临时消息生命周期

ChatRoom 仅在收到第一段有效文字后创建临时角色消息：

1. 第一段到达：写入 `pending` 角色消息。
2. 后续片段：更新 Vue 响应式消息。
3. 每约 140 毫秒：节流同步到 Dexie。
4. 生成完成：标记 `delivered`，必要时按多气泡规则拆分。
5. 用户停止：保留现有文字并标记 `cancelled`。
6. 中途失败：保留现有文字并标记 `failed`。

没有收到任何文字就失败时，仍沿用用户消息的失败与重试流程。

### 滚动策略

增量更新期间使用 `requestAnimationFrame` 合并滚动请求。只有用户仍处于最新消息附近时才自动跟随；用户主动上滑后，界面保留当前位置并显示“回到最新消息”按钮。

### 异常恢复

重新加载会话时会检查遗留的 `pending` 消息：

- 有内容的用户或角色消息恢复为 `cancelled`。
- 没有内容的临时角色消息直接清理。

这样浏览器刷新或意外关闭后不会永久显示“发送中”。

### 聊天组件边界

V0.3.3 新增：

- `ChatMessageItem.vue`：消息行、头像、图片、引用、状态与流式光标。
- `ChatComposer.vue`：输入框、图片选择、语音入口、图片预览、引用预览和发送控制。
- `ChatHeader.vue`：返回、角色状态入口、一起听歌和聊天设置入口。
- `ChatMessageList.vue`：消息遍历、输入状态、空状态与滚动容器。
- `ChatSettingsPanel.vue`：聊天、记忆、语音和高级设置。
- `ChatActionSheet.vue`：消息回复、复制、保存、重试、重新生成和删除。
- `ChatImagePreview.vue`：聊天图片全屏预览。

`ChatRoom.vue` 继续作为会话编排层，负责 Provider、记忆、关系、语音、音乐和请求生命周期。后续版本可继续拆分心理活动、音乐面板与 composables，而不改变消息组件接口。



---

## V0.3.6 多图消息与聊天逻辑解耦

### 新增组件和 composables

- `ChatThoughtPanel.vue`：角色心理活动、关系阶段和刷新入口。
- `ChatMusicPanel.vue`：歌曲资料、音频元素、进度和陪听反应。
- `useChatSpeech.ts`：语音识别、角色音色、语速、暂停和停止。
- `useChatScroll.ts`：消息滚动、位置恢复和回到最新消息。
- `useBottomPanel.ts`：底部面板下滑关闭。

### 多图消息兼容策略

`Message.images` 保存多张图片的 Data URL、名称、尺寸和体积。旧版的 `imageDataUrl`、`imageName` 等字段继续保留，读取时由 `messageImageService.ts` 统一转换为图片数组，因此已有单图聊天记录无需迁移。一次消息最多选择 6 张图片，Provider 请求会在同一条用户消息中依次加入多个 `image_url` part。

备份格式版本保持 V4。导出时关闭图片会同时清除旧单图字段和 `images[].dataUrl`；备份摘要按实际图片张数和总体积统计。Dexie 仍为 V5，因为新增字段不需要新索引。


## V0.3.8 图片处理管线

图片选择后不再并发创建多个 Canvas，而是进入串行队列：

```text
File
→ 类型与 15 MB 限制检查
→ ImageBitmap 解码
→ HTMLImageElement 解码兜底
→ 按设备内存计算 1080 / 1280 / 1440 最长边
→ 优先 JPEG，失败后尝试 WebP
→ 编码失败切换格式
→ 安全格式保留原图兜底
→ 释放 ImageBitmap、Object URL 与 Canvas
```

待发送阶段同时保留 `sourceFile`，因此用户可对单张图片重新处理或改用原图；消息写入 IndexedDB 时只保存处理结果和元数据，不保存临时 `File` 对象。


---

## V0.4.0 角色卡与沉浸 Prompt 架构

### 数据层

Dexie V6 新增：

```text
personas
lorebookEntries
```

`Character` 在不改变主键和索引的情况下扩展角色卡 V2 字段；`Message` 通过可选 `alternatives` 和 `activeAlternativeIndex` 保存候选回复。旧记录读取时由服务层补默认值。

### Prompt 编排

`promptComposer.ts` 是唯一的沉浸系统提示词入口：

```text
characterCardService
personaService
relationshipService
memoryService / conversation summary
lorebookService
visual input metadata
→ promptComposer
→ Provider
```

视觉消息保留为 OpenAI 兼容多模态内容，但文字指令只要求内部观察。最终输出受角色卡、关系和自然度规则约束。

### 聊天分支与候选

候选回复保存在原 `Message` 上，不创建重复消息；切换时同步更新 `content`。聊天分支会复制所选消息及之前的历史，并重新映射消息 ID 和引用关系，然后继承聊天设置。

### 兼容策略

- 旧角色缺失 V2 字段时使用自然默认值。
- 旧聊天设置缺失角色扮演字段时自动补齐。
- 旧备份不含 Persona 和世界书时按空数组恢复，并在首次使用时创建默认 Persona。


---

# V0.4.1 角色互动与调试架构

## 互动输出链路

```text
Provider 原始输出
  ↓
流式可见文本过滤 visibleStreamingText()
  ↓
parseCompanionOutput()
  ├─ text / emoji / voice 动作消息
  ├─ mood / activity / location / relationshipNote / innerThought
  └─ 解析警告与动作摘要
  ↓
消息节奏调度 saveAssistantActions()
  ↓
Dexie messages + conversationStates + characters
  ↓
ChatMessageItem / ChatThoughtPanel
```

模型不输出协议时，解析器把纯文本转换为普通 `text` 动作，确保旧模型和普通 OpenAI 兼容接口继续可用。

## Prompt 调试链路

```text
角色卡 + Persona + 关系 + 相关记忆 + 世界书 + 历史 + 视觉规则
  ↓
composeRoleplaySystemPrompt()
  ↓
savePromptDebugTrace()
  ↓
Provider
  ↓
原始输出 / 可见输出 / 动作摘要 / 自然度警告
  ↓
PromptDebugView
```

调试追踪保存在 `promptDebugTraces` 表，每个聊天最多 20 条，不写入备份。

## 角色资源兼容

`characterCardImportService.ts` 负责 SillyTavern V2 / V3 JSON 主要字段映射。内部仍统一转换成项目自己的 `Character`，避免聊天链路直接依赖外部卡格式。

## 数据版本

```text
Dexie：V7
Backup：V6
新增表：promptDebugTraces
```


---

## V0.4.2 长期记忆与主动陪伴架构

### 记忆写入与检索

```text
用户消息
→ extractMemoryCandidates
→ 相似度去重 / 合并
→ 单值主题冲突检测
→ memories（六层结构）

本轮消息 + 未完话题
→ selectMemoryHitsDetailed
→ 关键词、重要度、层级、锁定、日期与冲突评分
→ buildMemoryPrompt
→ Prompt Composer
```

角色状态中的关系感受和内心想法可作为“角色主观记忆”保存，和客观事实分开。

### 状态协议 V2

```text
companion_packet.status
→ parseCompanionOutput
→ mergeStatusIntoConversationState
→ conversationStates
→ recordConversationStateChanges
→ conversationStateHistory
```

状态字段只用于后续上下文和自然 UI，不直接显示 JSON。

### 主动消息

```text
打开聊天
→ 检查安静时段 / 最短间隔 / 频率 / 关系阶段
→ 承诺到期 > 未完话题 > 关心状态 > 剧情事件 > 分享日常
→ 去重
→ 写入带 proactiveSource 的普通角色消息
```

主动消息当前仍是“打开应用时检查”，尚未使用后台推送。

### 调试链路

```text
最终 Prompt
→ analyzePromptSections / buildTruncationNotes
→ 世界书触发原因 + 记忆命中原因
→ 原始模型输出 / 互动协议解析
→ 自然度规则评分
→ promptDebugTraces（最多 20 条，不进入备份）
```

### 数据版本

- Dexie V8：新增 `conversationStateHistory`，扩展 memories/messages 索引。
- Backup V7：加入状态变化历史，继续兼容 V1～V6。


---

## V0.4.2.1 场景距离双模式消息架构

### 表现模式

```text
ChatSettings.presenceMode = auto | together | remote
ConversationState.presence = together | remote
        ↓
resolvePresenceMode()
        ↓
shapeCompanionActions()
   ├─ together：scene_action → （动作）+ dialogue → 同一 text 消息
   └─ remote：scene_action → 独立 action 消息；dialogue → 多条 text 消息
```

`actionVisibility` 控制玩家是否看到场景动作：`always / together / off`。远程 Action 是玩家可见的角色侧写，不等价于角色通过手机发送的文字；`typing_pause / recall_message / react_to_message` 等仍属于手机行为。

### 消息落库

同一轮角色回复共享 `replyGroupId`，分开的消息记录使用 `replySequence` 保持顺序。`Message.type = action` 用于独立场景动作，普通对白仍为 `text`。旧消息没有这些字段时按旧格式正常渲染。

### 记忆纠偏

```text
明确记忆消息
→ stripMemoryCommand
→ 未来事件识别 / reminder 拆分
→ fact + 可选 promise
→ subject 稳定化
→ 重复合并或正反冲突
→ buildMemoryWriteNotice
→ Prompt Composer
```

“下周X”按下一自然周计算。冲突记录不直接同时作为事实注入 Prompt，而由记忆管理页确认。

### 数据版本

- Dexie：V8（不变）
- Backup：V7（不变）
- 新增字段均为可选字段或设置默认值，不需要 schema 迁移。


## V0.4.2.4 Persona 资源兼容架构

- `personaImportService.ts` 负责资源类型识别、Persona 字段映射、文本编码兼容、未知字段保真和导出。
- Persona 导入先识别 `persona / character-card / world-book / preset / regex`，避免不同社区资源串类型。
- Character Card 转 Persona 是显式转换：保留描述、性格、场景和原始扩展，但不把角色开场白/系统提示直接注入用户身份。
- Persona 结构化字段与 `description`/`extraFields` 分离：结构化字段服务于 Prompt 分层，原始内容服务于迁移保真。
- `buildPersonaPrompt()` 只把明确填写的用户事实作为事实；未提供字段保持未知。
- IndexedDB 仍为 V8，因为 Dexie 对新增可选对象字段无需新建表或索引。


## V0.4.2.5 创建期角色卡导入
CharacterCreate 直接调用 characterCardImportService；角色基础与高级字段在创建事务中一次落库，Character Card 内嵌 character_book 转换为带 characterId 的 LorebookEntry。无需建立临时空角色。


## V0.4.2.8 角色卡内嵌用户模板

`Character.embeddedUserTemplate` 保存从 Tavo / SillyTavern `description` 中检测到的独立 `{{user}}` 段。
当用户选择使用原卡用户模板时，会创建一条 `UserPersona`：

```text
personaScope = character
boundCharacterId = Character.id
boundCharacterName = Character.name
sourceUserTemplate = 原始 {{user}} 文本
isCardTemplate = true
```

新建角色时，同时把 `ChatSettings.personaId` 指向该 Persona。因此角色卡作者预设的用户身份只在当前角色私聊生效，不会成为全局默认，也不会污染其他角色。


## V0.4.3 社区资源兼容运行时

资源关系不再写死在角色或 ChatRoom 中：

```text
Character
  └─ ResourceBinding
       ├─ LorebookResource -> LorebookEntry[]
       ├─ PromptPreset -> PromptPresetPrompt[]
       └─ RegexScript
```

聊天运行顺序：

```text
角色 / Persona / 记忆 / 状态
        ↓
绑定世界书扫描
        ↓
World Info Regex
        ↓
Prompt Preset 编排
        ↓
Prompt-only Regex
        ↓
模型请求（User Input Regex 作用于用户历史）
        ↓
模型原始输出
        ↓
AI Response Regex
        ↓
结构化消息 / Safe Rich HTML
        ↓
IndexedDB（Rich 消息同时保留 rawContent）
```

`SafeRichHtml.vue` 使用 Shadow DOM 做样式隔离，并剔除可执行脚本与事件属性。资源兼容优先“保留原数据 + 安全降级”，不执行任意第三方 JavaScript。

## V0.4.3.1 社区资源无损归档与作用域

社区资源现在采用“双层保存”模型：

```text
原始资源 CommunityResourceArchive
        │
        ├─ rawText / rawJson
        ├─ 来源文件与识别格式
        └─ 持久兼容报告
                │
                ▼
标准化运行资源
  Lorebook / Preset / Regex
                │
                ▼
ResourceBinding
  global / character / conversation / persona
```

### 无损原则

解析器只负责生成当前版本能执行的 normalized resource；原文件另外保存在 `communityResourceArchives`。因此未知 `extensions`、社区自定义字段或尚未实现的 Theme 数据不会因为一次导入而永久丢失。

### 作用域优先级

运行时绑定优先级为：

```text
conversation > persona > character > global
```

V0.4.3.1 的世界中心 UI 先开放 `global / character`，后端接口已经能解析 conversation / persona 作用域，为后续聊天级和 Persona 级资源绑定保留升级路径。

### Preset 冲突

同一作用域一次只启用一套 Preset；运行时同时出现多个层级时，优先使用更具体的绑定，因此角色专属 Preset 会优先于全局 Preset。

### 安全边界

Theme、未知 JSON 与未知文本可以归档，但不会直接执行。第三方 Rich UI 仍只允许安全 HTML/CSS 子集，禁止任意 JavaScript 获得 App 数据权限。

---

## V0.4.4.1 · AI 内容权威层

```text
用户输入 / 角色卡资源 / 记忆 / 世界状态
                  ↓
            Prompt Composer
                  ↓
             真实 AI Provider
                  ↓
       完整性检查（Token / finish）
          ↓完整             ↓不足
 原卡协议解析 / Safe UI      硬停止 + 错误提示
          ↓                 不保存半截回复
       保存真实 AI 输出
```

边界：

- **AI / 原角色卡**负责角色台词、动作、心理、情绪、关系感受和剧情内容。
- **小手机 Runtime**只负责上下文编排、格式、宏、资源注入、协议解析、UI、安全过滤、状态持久化与错误处理；不提供角色化文案。
- Runtime 不得创建“看手机 / 想你 / 平静 / 查岗 / 本地角色回复”等角色化兜底。
- UI 修复如需改写内容，必须再次调用真实 AI；Token 不足时不得用程序拼接补齐。
- 旧本地关系积分不再作为角色事实源；V13 删除其 IndexedDB stores。

- `compatibilityMode=auto` 对社区卡和小手机原生角色统一解析为 `card-first`：默认保存/展示 AI 原始语义输出，不做小手机消息重塑；`phone-enhanced` 只允许用户显式选择。
- 角色回复完成后不再运行本地“事实纠偏/语义改写器”。除原卡明确 UI / Regex 结构校验外，应用不根据固定语义规则重写 AI 台词。
- HTTP 402、上下文窗口不足、额度不足、`finish_reason=length/max_tokens` 与无 finish reason 但输出打满上限都进入 Token 硬停止路径。
- 新会话主动消息默认关闭；刷新/崩溃/断线遗留的 pending assistant 不作为有效角色内容恢复，统一删除。
