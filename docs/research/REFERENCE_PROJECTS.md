# 参考项目与学习样本

> V1.1 专项吸收记录：`COUPLE_BOARD_V1_1_REFERENCE_STUDY_2026-09-22.md`（情侣空间 / 记忆连续性 / local-first → 心跳飞行棋）。

> 用途：记录公开项目、在线样本和可复用的工程/产品观察。这里只做设计与工程学习，不把第三方实现直接复制进本项目；涉及代码、素材、Prompt 时继续遵守原项目许可证和作者要求。

## 1. GitHub / 代码仓库

| 顺序 | 项目 | 网址 | 当前主要学习点 |
|---|---|---|---|
| 图2 | 汪汪机 | https://github.com/Liunian06/FlutterCppWangWangPhone | 虚拟 OS、Provider 与核心逻辑边界 |
| 图4 | Love Boat / 小船机 | https://github.com/qingzhouu/love-boat | 低部署成本、社区玩法验证 |
| 图5 | 弯弯机 | https://github.com/wanonewan/wanwan | 产品交互与部署体验 |
| 图6 | 叙事诗小手机 / StoryPhone | https://github.com/Island-glitch/Poemnarapk | 长期记忆、RAG、主动消息、Runtime |
| 图7 | FLOAT / 简易小手机 | https://github.com/xiaolongbao0709/ai-virtual-phone | 多 App Surface、群聊/朋友圈/角色生态 |
| 图8 | PiggyPhone / 猪猪机 | https://github.com/lw0129-jj/PiggyPhone.JJ-STAR | 快速产品原型与社区玩法 |
| 图11 | HiPhone | https://github.com/ssochi/hiphone | 工程文档、测试、架构/研究资料分层 |
| 图12 | miya 小手机 | https://github.com/lixooo00-lab/mingruis-miya | 手机壳、美化、模块化、本地优先/PWA |
| 图13 | InternalBeyond Mobile / IB机 | https://github.com/Sui-IB/InternalBeyond-Mobile | AI capability 权限、记忆档案、跨 App Runtime |
| 图14 | Melt | https://github.com/EvenNetR/Melt | 主/副模型分工、后台任务、关系/记忆系统 |

## 2. Cloudflare Pages / GitHub Pages / 独立网页

| 顺序 | 用途 | 网址 |
|---|---|---|
| 图1 | 小心机 | https://xiaoxinchat.jia.ruiyaxin.xyz/ |
| 图1 | 小心机备用 | https://ruiruiyaxin.pages.dev/ |
| 图3 | 凛冬机 | https://todleffleiermyronwym-web.github.io/zimaos/ |
| 图3 | 蓝椰机 | https://todleffleiermyronwym-web.github.io/zmlanye/ |
| 图3 | 文件预览 | https://todleffleiermyronwym-web.github.io/lanye/ |
| 图4 | Love Boat 网页版 | https://loveboat.pages.dev/ |
| 图10 | lav / mf机 | https://lavender-phone.pages.dev/ |
| 图15 | Plume / mf机分流 | https://rainmow52000.github.io/plume/ |

## 3. Netlify / Vercel 在线部署

| 顺序 | 用途 | 网址 |
|---|---|---|
| 图3 | 手写卡辅助工具 | https://lucent-naiad-692171.netlify.app/ |
| 图3 | 代码辅助工具 | https://sparkly-halva-11dc2f.netlify.app/ |
| 图3 | 蓝椰机备用部署 | https://heroic-wisp-712733.netlify.app/ |
| 图14 | Melt 在线版 | https://melt-eta.vercel.app |
| 图15 | mf机 | https://ubiqpiroshki-0b62ca.netlify.app/index.html |

## 4. 待核对样本

- `three-days-no-sleep`：目前只有仓库关键词，没有唯一可靠仓库地址；在确认用户名/仓库前不编造链接。

## 5. 本项目的学习方法

以后遇到新参考项目，不直接按“别人有某功能 → 我们也加”处理，而按下面顺序评估：

```text
参考项目功能
  ↓
它解决的用户/运行时问题是什么
  ↓
属于 Character / World / AI / Conversation / Resource / Capability / UI 哪一层
  ↓
是否与本毕设核心问题相关
  ↓
是否能抽象成通用能力
  ↓
是否值得在毕业前实现
```

### 长期吸收原则

1. **Character Runtime 高于 App Surface**：同一个角色在聊天、朋友圈、日记、论坛里仍然共享身份、记忆和世界状态。
2. **世界事实 / 通讯渠道 / 呈现方式分离**：Presence 不等于微信；phone-text 也不等于远程。
3. **存很多、召回少量**：Memory / WorldBook 都按当前上下文选择性注入。
4. **主动消息走完整 Runtime**：调度器只决定“是否进入生成”，不在本地替角色写内容。
5. **Capability 显式授权**：未来读取/写入日历、朋友圈、手机数据时区分 read/write 权限。
6. **Community UI 安全编译**：优先把常见 Tab、折叠、按钮、数据绑定转换成受控能力，未知第三方 JavaScript 不直接执行。
7. **本地优先保持不变**：IndexedDB + Backup + PWA 继续作为基础，跨设备同步以后作为可选层。
8. **不以功能数量作为毕业目标**：优先稳定性、可测试性、架构清晰度和论文可解释性。

## 6. 小手机 UI 的事实标准（2026-09 调研）

没有统一的官方“小手机 UI 规范”，但公开项目与真实手机交互已经形成明显共识：

1. **桌面首先是 Launcher**：主屏长期展示 App、Dock、小组件/摘要，不把普通设置按钮悬在最醒目的固定位置。
2. **美化集中管理**：Miya 明确采用“桌面 → 美化”，集中壁纸、图标、字号、挂件与锁屏；AI Virtual Phone 也把主题、壁纸、贴纸小组件、自定义 CSS 归为桌面美化。
3. **长按是桌面编辑的熟悉手势**：iPhone 通过长按主屏背景进入抖动/编辑，再进入 Customize；因此本项目用长按作快捷入口，而不是长期占一个“编辑”胶囊。
4. **记忆是一级能力**：Miya、InternalBeyond、Lulu Phone 都把 Memory / 记忆库作为独立模块，完整 CRUD、搜索/冲突等管理不应深埋在某个聊天设置里。
5. **App Surface 自己负责 UI**：模型提供内容/语义，桌面、设置、记忆、朋友圈、音乐等本地 App 负责交互结构；Community HTML 只在 Chat 的兼容边界内存在。

因此本项目后续默认遵循：

```text
Home = Launcher
Settings / Appearance = 美化与系统设置
Memory = 一级数据管理 App
Chat Settings = 当前聊天行为偏好
```

## 7. 本地 Community Compatibility Corpus（不提交第三方原始素材）

用户提供的真实社区样本已用于理解兼容边界，包括 V2/V3 Character Card、PNG metadata、WorldBook、Preset、Regex、Persona、Community HTML/UI 与“大世界/高 Token”角色卡。原始第三方素材只作为本地回归输入，不直接复制到 Git 仓库。

当前重点覆盖三类极端样本：

1. **Presentation-heavy**：关键词触发“看手机/手机模拟器”，模型输出完整 HTML 或语义标签，再由 Regex/Community UI 呈现；用于验证 Safe Rich UI、Regex、Command 语义与 Token 开销。
2. **World-heavy**：大量 constant WorldBook、NPC 社会网络、Character/User 双主体与自主生活规则；用于验证 Lorebook budget、Persona 边界、关系连续性和 branch cutoff。
3. **Hybrid command/UI**：WorldBook 同时承担人设检查、随机事件、全文总结、长期/短期剧情分支等 mode/command；用于验证未来 Command Runtime 与安全交互桥。

学习结论：模型优先生成**语义 payload**，本地 Runtime 负责安全、状态与 Renderer；第三方 `<script>` / inline JS 不作为直接执行能力。未来 UI Builder / Command Runtime 属于 V0.6+，不挤占 V0.5 毕业稳定线。
## 8. Chat / Community UI 兼容事实标准

结合现有“小手机”项目与 Tavern / Character Card 社区资源的共同使用方式，本项目不定义新的社区卡 UI 格式，而采用兼容层：

- **手机 Shell 统一**：顶部导航、头像、消息流、输入框、长按菜单由 App 控制，保持真实 IM 心智。
- **消息内容作者优先**：Rich Regex → WorldBook HTML → 作者直接 HTML → 结构化/纯文本 → 原生气泡 fallback。
- **开场连续**：`first_mes` / `alternate_greetings` 与后续回复使用同一套作者 UI Contract，避免第一屏和第二屏视觉断裂。
- **不把社区卡强转为私有 UI**：只有卡没有任何 Presentation 资源时，才由原生聊天气泡兜底。
- **安全边界不让步**：保留静态 HTML/CSS 与可映射交互，但不执行未知脚本；脚本型交互通过本地事件桥显式白名单承接。
- **玩家可覆盖**：纯气泡 / 动作台词拆分属于用户主动选择的显示模式，而不是默认改写作者设计。

这套规则用于后续社区回归语料：至少覆盖纯文本卡、WorldBook HTML 卡、Regex HTML 卡、`first_mes` 与后续 UI 连续性，以及固定宽度 / `<br>` / `<style>` 等常见兼容点。

