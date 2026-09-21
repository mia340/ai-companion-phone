# Changelog

## V0.5.0-alpha.5.2.0

- ChatRoom Generation Runtime 拆分第一阶段：新增 `runtime/generation/streamingReplyRuntime.ts`，统一管理流式 assistant placeholder 的 create / patch / debounce persistence / flush / discard / interrupted-preserve 生命周期。
- `ChatRoom.vue` 不再直接持有 stream persistence timer，也不再自己实现 placeholder CRUD；页面通过 hooks 只同步 Vue 消息列表、streaming id 与滚动。
- 保持现有 `generationOrchestrator.ts` 的冻结 Generation Context、真实 Provider 错误、Vision fallback 语义不变，不引入任何本地角色化 fallback。
- 新增 7 条 Streaming Runtime 回归测试；测试矩阵提升到 44 files / 373 tests。IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。

## V0.5.0-alpha.5.1.27

- 新增 `lorebookService.test.ts`，直接从公开 `buildLorebookPrompt()` 入口锁定 WorldBook Engine 核心行为，不再只依赖导入解析或语义辅助测试。
- 新增 15 条回归测试：关键词 / whole-word / case-sensitive / regex、四种 selective logic、scanDepth 与 recalled 过滤、Persona/Character 上下文匹配、多层递归、prevent/exclude recursion、sticky/cooldown/delay、group scoring、probability、token budget、At-Depth 与 Outlet。
- 运行时实现、IndexedDB V18、Backup V12、Launcher Grid V13 / HomeLayout revision 12 均不变；测试矩阵提升到 43 files / 366 tests。
- 延续 alpha.5.1.26 Release Safety：Windows 双 `npm run verify`、Git preflight/staged guard、ZIP UTF-8 文件名与 Node 侧 lockfile 版本验证继续作为发布门禁。

## V0.5.0-alpha.5.1.26

- 发布链安全收口：新增 `scripts/release-safety.mjs`，统一校验 package/lock 版本、`.gitignore`、`.gitattributes`、中文发布文档、Git main/origin、ignored-but-tracked 与禁止暂存路径。
- `npm run verify` 在测试与生产构建后追加 `release:source-check`；GitHub Actions 改为复用同一 canonical verify 门禁。
- 部署脚本在 commit 前检查 `node_modules / dist / *.tsbuildinfo / .env*`，并使用短 diff 摘要，避免历史 Git 污染再次刷入依赖或构建产物。
- IndexedDB / Backup / Runtime 行为不变。

## V0.5.0-alpha.5.1.25

- 修复 `greeting`「今天」Widget 的 CSS 类名碰撞：外层 Launcher Widget 不再与内部问候文字共用 `.widget-greeting`，避免 4×2 Widget 退化为约 1×1 像素并制造视觉幽灵页。
- Launcher painted 判定加入 8px 最小有效视觉尺寸；DOM 存在但退化为近零尺寸时，不再阻止连续两次确认后的幽灵页自愈。
- 保留恢复保险：自动回收前仍先尝试安全折叠/reflow，必要时写入 `companion-home-ghost-page:<worldId>` recovery snapshot 后再回收。
- 增加 2 条 Launcher 回归测试；测试定义更新为 42 files / 351 declarations。IndexedDB V18 / Backup V12 / Launcher Grid V13 / HomeLayout revision 12 不变。

## V0.5.0-alpha.5.1.24

- Windows Safe ZIP packaging hotfix: repair historical Chinese filenames that were stored with legacy CP437/mojibake metadata, and rebuild the ZIP with UTF-8 filename flags so Windows PowerShell `Expand-Archive` can extract it reliably.
- Keep the alpha.5.1.23 TypeScript hotfix: `pageDiagnosticLine()` dead code remains removed; no database, backup, Launcher revision, or user-data schema change.
- Deployment now verifies ZIP SHA-256, package version, and stale-code absence before `npm ci` / `npm run verify`.
- Test definition remains 42 files / 349 declarations; final release still requires both Windows `npm run verify` passes.

## V0.5.0-alpha.5.1.23

- 发布门禁热修：删除 `HomeScreen.vue` 中未使用的 `pageDiagnosticLine()`，修复 `vue-tsc` TS6133。
- 延续 alpha.5.1.22 的 Dock/Home 去重 canonical layout 修复；不改变 IndexedDB、Backup、Launcher revision 与业务数据结构。
- 测试定义仍为 42 files / 349 declarations；发布必须通过 Windows 双 `npm run verify`。

## V0.5.0-alpha.5.1.22

- Launcher Grid V13：HomeLayout revision 12；加载时清理 Dock/桌面重复 App、重复 Item 与空页，修复旧布局可能把 Dock App 留在幽灵页的问题。
- HomeLayout Inspector V4：逐项显示 persisted layout 与 DOM/paint 状态，可复制 JSON、修复结构异常、备份后回收当前视觉空白页。
- 空白页绘制判定增加祖先链 visibility/opacity 检查，避免透明父层仍被 `elementFromPoint` 误判为可见。
- WorldBook Activation Inspector V4：加入主/辅助关键词、selective logic、scan depth、regex/case/whole-word 信息。
- Context Inspector V3：Prompt section 保存估算 token，加入 Prompt Preset 来源与总输入 token 估算。
- IndexedDB V18 / Backup V12 不变。

## V0.5.0-alpha.5.1.21

- Launcher Grid V12：对持续残留的第二页执行完整状态审计；确认默认分页最少页数仍为 1，没有固定两页常量。
- 视觉空白页检测改为采样真实 icon/tile，而不是透明 shell；连续两次确认空白后，先尝试无损 reflow，再把原始 page JSON 写入本地恢复槽并强制回收 Launcher 页。
- HomeLayout revision 升至 11，并新增“默认布局不会硬编码第二页 / 强制移除幽灵页不影响其他页”回归测试。
- WorldBook Activation Inspector V3 增加 activation kind、match score、recursion depth、estimated tokens、priority/order/position/probability。
- Context Inspector V2 增加各 Context 来源字符数与近似 token。
- IndexedDB V18 / Backup V12 不变。

## V0.5.0-alpha.5.1.20

- Launcher 普通短按改由 Pointer Runtime 直接执行，修复 Widget/App 点击被 pointerup 吞掉的问题。
- “一起听”组件恢复明确播放/暂停按钮：有可播放 MusicState 时直接控制音频；无音源时进入音乐 App。
- 幽灵页修复升级：当前页通过 elementFromPoint 验证真实绘制，不能只看 DOM 布局盒。
- 幽灵页合并在空位碎片化时允许安全 reflow 前页，确保总空间足够时页面可以真正回收且不丢项目。

## V0.5.0-alpha.5.1.19

- Launcher Grid V10：不再继续盲删“空数组页”，增加幽灵页诊断与安全回收。
- 当前页视觉完全空白但数据仍含项目时，优先把项目安全搬回前面的已有页面；只有全部项目可保留时才删除该页。
- 页面 DOM key 改为由页内容签名驱动，避免页压缩/重排后复用旧页面 DOM。
- 新增 HomeLayout Inspector：显示每页真实 App / Widget / Folder、坐标与尺寸，并提供“修复当前幽灵页（保留项目）”。
- HomeLayout revision 升至 10；启动与翻页稳定后再次执行视觉空页审计。
- 新增幽灵页安全折叠回归测试；静态为 41 个测试文件 / 342 个测试声明。
- IndexedDB 仍为 V18，Backup 仍为 V12，不清站点数据。

## V0.5.0-alpha.5.1.18

- Launcher Page Compositor V2：移除分页轨道上的 flex + `contain: paint` 组合，改为每页独立绝对定位并按当前页做 `translate3d`。
- 这是针对“数据页非空但第二页视觉完全空白”的渲染级修复；不再继续把问题当成空数组清理。
- 主屏分页仍支持手指/鼠标跟手滑动、编辑态边缘翻页和临时新页；HomeLayout 数据模型、IndexedDB V18、Backup V12 均不变。
- 部署前仍要求 Windows 两次 `npm run verify` 全部通过。

## V0.5.0-alpha.5.1.17

- Folder Runtime V2：文件夹内 App 可长按拖回桌面、跨页或 Dock。
- 文件夹内支持插入式排序；离开文件夹面板后自动收起并继续命中真实 Launcher Grid。
- 拖出动作继续复用 Grid V7 的流式重排和边缘翻页；只剩一个成员时自动解散。
- 新增 3 条文件夹拖出/排序回归测试；静态为 41 个测试文件 / 341 个测试声明。

## V0.5.0-alpha.5.1.16

- 修复第二页幽灵空页：稳定 Launcher 页在 UI 层再次过滤空 items，切换到真正空白页时会触发当前页 DOM 回收兜底。
- HomeLayout Revision 提升到 9，历史布局重新归一化并回写。
- 新增 iPhone 式 App 文件夹 V1：两个 App 拖叠创建文件夹，继续拖入可追加成员。
- 文件夹进入统一 4×6 Grid，可移动、重命名、打开；成员可移出，只剩 1 个 App 时自动解散。
- HomeLayout Schema / 独立布局备份同步兼容 folder item；IndexedDB V18 / Backup V12 不变。
- 新增文件夹创建/追加/自动解散回归测试；静态为 41 个测试文件 / 338 个测试声明。


## V0.5.0-alpha.5.1.15

- 修复第二页幽灵空页：过期 drag preview 不再覆盖真实 HomeLayout。
- 拖拽结束改为 finally 清理，保存异常也不会留下临时页面。
- HomeLayout Revision 8：读取时自动压缩并回写历史空页。
- 增加渲染级 ghost-page 自愈与显式页面移除 helper。
- 新增 2 条回归测试，静态为 41 个测试文件 / 336 个测试声明。


## V0.5.0-alpha.5.1.14

- 修复 Launcher 临时空白页在拖拽结束/取消后仍可能保留第二个分页圆点的问题。
- 临时新页仅在编辑态且确实存在活动拖拽时渲染；稳定桌面永远只展示持久 `homeLayoutPages`。
- 当持久页面数量减少时自动夹紧当前页索引，防止停留在已回收页。
- 补“清空后一页即自动回收”回归测试；测试定义更新为 **41 files / 334 cases**。
- IndexedDB V18 / Backup V12 不变。

## V0.5.0-alpha.5.1.13

- Launcher Grid V7：桌面拖拽由“交换位置”升级为“插入 + 流式重排”。
- 拖动 App/Widget 经过其他项目时，后续项目会实时向后让位；来源页空洞会在本页向前补位。
- Widget 与 App 共用同一条 reflow 算法，2×1 / 2×2 / 4×1 等尺寸真实参与占位。
- 拖拽期间使用非持久化布局预览，周围项目通过 FLIP/WAAPI 过渡形成类似 iPhone 的果冻式挤开效果；松手后才写入 IndexedDB。
- 目标页装不下时，尾部项目会继续向下一页推进；不会因为前页有空位就擅自把后页内容拉回来，因此仍支持“一个 App 单独一页”。
- IndexedDB V18 / Backup V12 不变。


## V0.5.0-alpha.5.1.12 — 2026-09-18

- **5.1.12 R2 build hotfix**：修复 Backup Zod envelope 经 `vue-tsc` 暴露的 transport/domain 数组类型边界；修正 Message 完整性测试夹具。运行时格式不变，仍为 IndexedDB V18 / Backup V12。

- Launcher Grid V6：App/Widget 统一拖拽与交换，Widget 支持自由尺寸。
- Widget 默认尺寸收窄；音乐 Widget 移除独立播放箭头。
- 编辑态移除右上角大块完成控件，背景点击结束编辑。
- 新增照片/日历 Widget、主题预设、HomeLayout 独立备份。
- 新增 Character Card Import Report、Context Inspector、WorldBook Activation Inspector（逐条判定）、AgentAction capability runtime。
- Backup V12 增加 Zod envelope preflight，并在清库前校验重复主键、会话/消息、Memory、WorldBook、ResourceBinding、朋友圈、Social Profile 等跨表引用。
## V0.5.0-alpha.5.1.11 · Launcher Grid V5 / 真机边缘翻页 / Pointer 生命周期修复

- 定位左侧竖白线真实来源：并非 scrollbar，而是默认壁纸底部独立 `filter: blur()` 光斑在 Chromium 合成层裁切边界形成的 2px 竖缝；移除该独立 blur DOM，改为单层背景渐变。
- 主屏从“每页 App 数组 + Widget 顶部区”升级为 **4×6 Home Grid**；App 占 1×1，小组件占 2×2 / 4×2，可与 App 在同一网格混排。
- 新增 `homeLayoutPages` 持久布局：每个 Item 保存 page 内 `x / y / w / h`，允许留白，也允许一个 App 单独待在一页，不再由容量算法强制挤页。
- 新页面只通过拖拽自然产生：在最后一页把 App 拖到手机内容区右边缘会临时打开空页，真正落下后才保存；空页继续自动回收。
- 边缘翻页热区改为手机内部左右约 10% 区域，不要求把指针拖出手机外框。
- 拖拽与分页的 Pointer 生命周期改为 window 级收尾，补 `pointerup / pointercancel / blur`，修复松开鼠标后 ghost / 页面继续跟随的问题。
- `我的资料` 与其他 App 统一走 Grid Item 移动路径；新增“单 App 独占新页”“非空页不被自动压回”等回归测试。
- IndexedDB V18 / Backup V12 不变；测试定义更新为 **38 files / 319 cases**。

## V0.5.0-alpha.5.1.10 · Launcher V4 手势翻页 / 自动页数 / 白线根因修复

- 横向分页从浏览器原生 scroll 容器切换为 pointer 手势 + transform 页轨道，避免原生 scrollbar / edge indicator 产生竖白线。
- 鼠标和触屏都可左右拖动翻页；轻扫按位移和速度判断目标页，边界带阻尼。
- 页面数量改为内容驱动：至少 1 页，App 溢出自动新增页，空页自动删除。
- 取消页面编辑器中的“新增一页 / 删除一页”；“编辑页面”改名为“编辑桌面”。
- 增加空页自动收敛回归测试；测试定义更新为 38 files / 317 cases。

## V0.5.0-alpha.5.1.9 · Launcher V3 真机修正 / 持久分页 / 音乐图标统一

- 主屏通过 `PhoneFrame lockScroll` 关闭外层纵向滚动，Launcher 页面自身也禁止纵向滚动并强制隐藏 scrollbar，针对用户截图中的左侧竖白线做根因级处理；底部横向 Home Indicator 保留。
- 编辑态取消 `padding-top: 226px` 的让位逻辑；长按进入编辑后，Widget、App 与 Dock 保持原坐标，编辑菜单改为覆盖层，不再把整个桌面向下推。
- Launcher 从“按数量临时切片”升级为持久 `homePageKeys: HomeAppKey[][]`：旧 `homeAppKeys` 自动迁移，两页起步，跨页拖拽后 App 会真正留在目标页。
- 「编辑页面」新增页管理，可新增页面、切页和删除多余页；删除页面时 App 自动并回相邻页，不删除业务数据。
- Dock 与桌面拖拽继续复用同一纯函数，并新增跨页归属回归测试。
- 音乐 App 图标统一为用户指定的“小组件上方框选”的单音符样式；「一起听」Widget 直接复用同一个 `AppIcon`，不再出现双音符 / 单音符两套视觉。
- IndexedDB 仍为 V18，Backup 仍为 V12；`homePageKeys` 复用 `appCustomizations` 非索引字段，无需 schema migration，也不要清站点数据。
- 静态测试定义：**38 files / 316 it-test declarations**。完整 `npm run verify` 继续由 Windows / CI 作为发布硬门禁。

## V0.5.0-alpha.5.1.8 · Launcher Runtime V2 / Character Card 安全边界 / Memory Retrieval V2

- 修复主桌面左下角出现的竖向白线：Launcher 收敛为横向分页滚动层，并隐藏桌面浏览器 scrollbar；Phone Shell 底部横向 Home Indicator 保留。
- 主桌面升级为真正的多页 Launcher：长按 App 进入整理态，支持同页排序、桌面↔Dock 拖拽、Dock 满 4 格时交换、拖到左右边缘停留自动跨页。
- 新增 `paginateHomeAppKeys()` / `moveHomeAppPlacement()` 纯函数和回归测试，让 Launcher 排序与 Vue DOM 手势解耦。
- 新增 Character Card Security Boundary：导入和导出均递归剥离 API 凭据、发送者 UI / 语音偏好和 runtime 存档残留；原始社区资源仍由 Resource Archive 独立保存。
- WorldBook Import Adapter 新增 SullyOS-shaped 条目兼容回归：`keysecondary / selectiveLogic / sourceUid / scanDepth / caseSensitive / matchWholeWords` 等字段进入统一内部模型，禁用状态不被改变，unknown extension 继续保留。
- Memory Retrieval V2 第一批：`confidence` 与 capped `hitCount` recall feedback 进入评分；conflict penalty 仍具有更高优先级。
- 新增 `docs/research/SULLYOS_DEEP_STUDY_2026-09-18.md`，系统记录 SullyOS Launcher、Character Card、WorldBook、ContextBuilder、Memory、主动消息与备份边界，并明确 PolyForm Noncommercial 许可下只学习思想、独立实现。
- 静态测试定义：**38 files / 315 it-test declarations**。IndexedDB V18 / Backup V12 不变；完整 `npm run verify` 仍以 Windows / CI 为发布门禁。

## V0.5.0-alpha.5.1.7 · 真实手机桌面 + Dock + 小组件自定义

- 恢复主屏幕上的「音乐」与「海龟汤」入口；两者继续使用既有真实路由与 Runtime，不降级为占位页。
- 恢复 4 格底部 Dock，默认放置「知间 / 新建角色 / 世界 / 设置」，Dock 不显示文字标签，更接近真实手机。
- 主屏从三列“功能面板”改回四列 App 网格；移除“长按桌面空白处可调整壁纸与图标”说明文案。
- 长按桌面空白处进入编辑态：提供「添加小组件 / 自定义 / 编辑墙纸 / 编辑页面 / 完成」，App 与 Dock 进入轻微抖动状态，可从桌面或 Dock 移除入口。
- 新增可持久化主屏布局：桌面 App 列表、Dock App 列表、Widget 列表与 Widget 材质都写入现有 `appCustomizations`，无需升级 IndexedDB。
- 新增 4 类原生感 Widget：今天、最近的人、世界状态、一起听；支持通透 / 毛玻璃 / 实色三种材质。
- 「桌面与外观」升级为「桌面与小组件」：玩家可选择壁纸、小组件、桌面 App、Dock、图标图片、图标大小与名称显示。
- Widget 设计参考 Apple Home Screen customization、Widgetsmith、Color Widgets、ScreenKit 的“模板 + 主题 + 玩家可编辑”思路；研究记录归档在 `docs/research/HOME_WIDGET_CUSTOMIZATION_STUDY_2026-09-18.md`。
- IndexedDB V18 / Backup V12 不变；测试定义仍为 37 个测试文件，但导航测试新增布局归一化断言。完整 `npm run verify` 需 Windows/CI 执行。

## V0.5.0-alpha.5.1.3 · API 响应诊断（不增加恋爱剧情拦截）

- 在 Prompt Debug 记录 HTTP 状态、finish_reason、上游结构化拒绝标记以及保守的回复文本拒绝线索；文本拒绝无法归因到模型或中转服务。
- 记录最少量诊断元数据，不在诊断字段保存 API Key、Headers 或 HTTP 错误正文。
- 不新增客户端对成年人的虚构恋爱、亲密剧情的笼统禁止；保持服务商返回文本原样进入既有展示流水线。
- IndexedDB V18 / Backup V12 不变；完整 npm verify 需 Windows 验证。

## V0.5.0-alpha.5.1.2 · 朋友圈发布菜单构建热修

- 修复 `MomentsView.vue` 使用 `showCreateMenu` 却遗漏 `ref(false)` 声明导致的 5 个 vue-tsc 错误；不改变 Social Runtime、封面和独立页面功能。
- IndexedDB V18 / Backup V12 不变；Windows `npm run verify` 通过后方可部署。

## V0.5.0-alpha.5.0 · Social Runtime V1 / 后台朋友圈

- 新增 App 级 Social Runtime：朋友圈 AI 互动从页面内 `setTimeout` 升级为 IndexedDB V17 持久活动队列。
- 用户发动态后，即使离开朋友圈页，多角色评论仍会继续排队执行；页面被系统挂起/关闭时不强行请求 API，恢复 App 后补执行已到期任务。
- 用户回复某位角色评论后，被回复角色保证继续接话；回复链不再依赖当前页面存活。
- 角色可回复其他角色评论，形成多人评论串；按回复热度控制角色互聊概率，并设置线程深度上限避免无限对话。
- 角色自主动态 / 手动角色动态也可触发其他角色自然串门。
- 新增 `socialActivities`、失败重试、幂等键、异常 running 恢复；删除动态/评论/角色会同步清理相关队列。
- 抽离 `momentSocialSettings.ts`，让朋友圈社交参数与后续群聊共用。
- 新增角色对角色评论 Prompt 与 Social Runtime 纯函数回归测试。静态目标 **32 个测试文件 / 289 个用例**。
- IndexedDB **V17**；Backup **V11** 不变（社交队列属于可重建运行时元数据，不进入备份）。

## V0.5.0-alpha.4.5 · 叙事人称连续性 + 通用用户档案识别

- 修复长篇场景回复里当前用户在“你 / 她 / 女生”等称呼间漂移的问题：新增独立“叙事人称连续性”规则。除非角色卡、世界书或 Prompt 预设明确指定第三人称，否则旁白/动作叙事固定用第二人称“你”。
- 明确区分“人物资料中的第三人称描述”和“输出人称规则”：`<user_profile>`、Persona、世界书里写“她/他/TA”只算资料，不会再被模型误当成第三人称叙事要求。
- 修复默认 Persona 名称“我”被直接替换进 `{{user}}` 宏导致的语义污染。默认 UI 名“我/用户/User”等现在保留 `{{user}}` 语义，不再生成“与我年龄差”“我固定对应某某”等易混淆 Prompt。
- Prompt Debug 增加“叙事人称锁”分区/规则影响，方便直接判断本轮是否启用第二人称连续性。
- 社区 Persona 识别继续泛化：支持 `{{user}}某某设定`、`<user_profile>` 包装、`{{user}}固定对应某姓名` 等世界书格式，并从该映射提取实际 Persona 姓名；不依赖具体角色或用户名。
- 已导入旧角色的 Character Card Editor 会额外扫描当前绑定的 Lorebook，若发现可安全识别的 user Persona，可直接创建并绑定角色专属 Persona，无需删除旧聊天或重新导入整张卡。
- 新增通用人称/宏回归测试与带用户名 user-profile 世界书回归测试。静态定义目标为 **31 个测试文件 / 280 个用例**。
- IndexedDB **V16** / Backup **V11** 不变，无数据迁移。

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


## V0.5.0-alpha.5.0.2

- 修复 Persona 姓名归一化正则在 Unicode 模式下的非法双引号转义，避免 Vitest/Rollup 收集阶段 SyntaxError。
- Social Runtime V1 与数据库版本保持不变。

## V0.5.0-alpha.5.1

- Social Runtime V2：朋友圈参与者由均匀随机升级为最近聊天、共享记忆、内容相关性、互动冷却与角色活跃度共同加权。
- 新增每角色朋友圈权限：查看、点赞、评论、接话、主动发动态，以及安静/自然/活跃三档频率。
- 新增朋友圈评论/回复未读通知和主屏幕朋友圈角标。
- 朋友圈 UI 改为更接近微信的白底、紧凑评论区、顶部发布/通知入口与底部设置面板。
- IndexedDB 升级 V18；Backup 升级 V12 并备份角色社交设置。

## 0.5.0-alpha.5.1.1
- 朋友圈页面层级：新互动、设置、好友权限独立路由，不再使用底部抽屉。
- 朋友圈支持本地封面图片上传、压缩、持久化及恢复默认，头像与昵称叠在封面下沿。
- 封面使用现有 IndexedDB V18 `appCustomizations` / Backup V12，Social Runtime V2 保持不变。


## V0.5.0-alpha.5.1.6

- 知间 UI 收敛：四主标签为「知间 / 通讯录 / 发现 / 我」，主标签页返回箭头统一回空间桌面。
- 发现只保留朋友圈；我页改为个人资料 / 空间设置 / 钱包 / 设置。
- 新增空间设置：自主动态、公开/好友/仅自己、单角色可见、隐藏、黑名单。
- Social Runtime 对“仅自己”和黑名单做排队与执行时双重权限校验。
- 空间桌面收敛为六核心入口并取消重复 Dock；音乐/日记/海龟汤不再占桌面。
- 知间图标去除聊天气泡造型。
- 文档统一归入 `docs/`：逐版本交付到 `docs/releases/`，参考研究到 `docs/research/`。
- IndexedDB V18 / Backup V12 不变。

