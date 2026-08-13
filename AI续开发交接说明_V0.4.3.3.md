# AI Companion Phone 续开发交接说明 · V0.4.3.3

## 当前基线
- 应用版本：0.4.3.3
- IndexedDB：V10
- 完整备份格式：V9
- 当前主线：Tavo / SillyTavern 社区资源兼容运行时 + 沉浸场景状态可靠性。

## 本版重点
V0.4.3.3 修复“角色明明和用户在一起，却被错误拆成远程 Action”的场景状态冲突问题。

### 已实现
1. 新增场景冲突解析：直接身体接触优先于模型 `presence=remote` 和角色卡 UI `周围=独处`。
2. 同轮即刻使用最终 resolved presence，不等待下一轮；together 动作和对白合并同一剧情气泡。
3. 支持 `<scene_action perspective="remote">...</scene_action>` 等带属性 XML 标签，标签不会显示给用户。
4. 对不完整 scene_action 开标签做安全兜底；旧聊天中已经泄漏的 scene_action 标签会在加载时自动清理。
5. 手动相处模式（together / remote）仍为最高优先级。
6. ConversationState 新增 reportedPresence / presenceResolutionReason / presenceResolutionSource，用来区分“模型报告”与“系统最终世界状态”。
7. Prompt Debugger 新增场景判定、模型报告状态、角色卡周围字段与冲突原因。
8. Prompt 规则要求：发生拥抱、亲吻、牵手、贴近等现实身体接触时必须输出 together；不能一边 remote/独处一边直接触碰用户。

## 关键产品规则
- 用户手动指定 > 明确直接身体接触 > 明确用户在场 > 结构化状态 > 角色卡“独处”弱信号 > 上一轮状态。
- `周围=独处` 在部分社区卡里可能表示“无第三人在场”，不能单凭它否定用户就在角色身边。
- 角色卡原始 UI 仍用于展示/兼容和调试；ConversationState 代表系统解析后的持续世界状态。
- together：动作使用中文括号并与对白合并剧情气泡。
- remote：角色另一边的动作才显示成独立 Scene Action；文本一完整句子一气泡。
- 任何 `<scene_action ...>` 标签都不允许作为普通正文泄漏。

## 社区兼容基线（继续保留）
- Character Card V2/V3、角色卡内嵌 Lorebook / Regex / {{user}} Persona。
- 世界中心：世界书 / 世界状态 / 预设 / 正则 / 资源库。
- 原始社区资源无损归档。
- 世界书、Preset、Regex 支持 global / character 基础作用域。
- Regex Runtime + SafeRichHtml 基础能力。
- Persona 图片头像、消息已读布局已完成。

## 下一版建议：V0.4.3.4
继续社区兼容核心，不急着扩 App：
1. WorldBook Engine V2：secondary keys、selectiveLogic、recursive、sticky/cooldown/delay、预算与 depth 精确执行。
2. Preset Prompt Manager：Prompt Order、marker、启停、角色/全局绑定与调试视图。
3. Regex 编辑器：placement、depth、display-only/prompt-only、排序、测试台。
4. Theme Runtime V1：社区主题 JSON、聊天 CSS、背景/气泡/字体等安全映射。
5. 资源兼容报告：完整支持 / 部分兼容 / 保留未运行 / 安全阻止。
6. 继续用真实 Tavo / SillyTavern 社区卡、世界书、预设、正则、美化组合做测试。

## 新对话继续开发提示
上传最新版 ZIP + 本文件后可说：
“请先阅读交接说明，再检查最新项目 ZIP。不要只做规划，直接按文档中的产品方向继续开发；保留旧数据兼容，完成代码、测试、版本文档和干净 ZIP，并更新交接说明。”
