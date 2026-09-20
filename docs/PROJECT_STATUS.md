# AI Companion Phone · 当前项目状态

更新于：**2026-09-20**  
当前版本：**V0.5.0-alpha.5.1.25**

```text
App：0.5.0-alpha.5.1.25
Launcher：Grid V13（Layout Inspector V4 + Dock/Home 去重 + DOM 绘制诊断）
IndexedDB：V18
Backup：V12
测试定义：42 files / 351 it-test declarations
```

> 本文件只描述“现在”。历史版本请看 `CHANGELOG.md`、`RELEASE_HISTORY.md` 和 `releases/`。


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

- 发布门禁热修：删除 `HomeScreen.vue` 中已无调用的 `pageDiagnosticLine()` 死代码，修复 `vue-tsc` 的 TS6133。
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

- 本轮修改的 TypeScript 与 Vue `<script setup lang="ts">` 已用 TypeScript 5.8.3 `transpileModule` 做语法检查：通过；
- 当前容器无法从离线 npm cache 取得 `zod@3.25.76`，因此无法组成完整 `node_modules`；
- 因此本轮**没有宣称 Vitest / vue-tsc / Vite Build 已通过**。

正式发布门禁仍是：

```powershell
npm ci
npm run verify
```

只有 Windows / CI 完整通过后才部署。
