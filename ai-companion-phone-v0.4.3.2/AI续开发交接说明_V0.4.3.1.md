# AI Companion Phone 续开发交接说明 · V0.4.3.1

## 当前产品目标

这是一个 AI Companion OS，而不仅是聊天页面。核心方向是：角色长期记忆、Persona、世界状态、线上/线下双模式，以及尽可能兼容 Tavo / SillyTavern 社区的角色卡、世界书、Preset、Regex、UI / 美化资源。

## 当前版本

- 应用版本：0.4.3.1
- IndexedDB：V10
- 完整备份：V9

## V0.4.3.1 已完成

1. `communityResourceArchives`：无损保存社区原始 JSON / TXT / MD、来源文件名和兼容报告。
2. 世界资源库可以查看归档并复制 / 导出原始资源。
3. Character Card 创建时同步归档完整原卡 JSON，避免未知 `extensions` 被标准化映射丢失。
4. 资源作用域新增 global / character，后端类型也预留 conversation / persona。
5. 运行时合并全局与当前角色的世界书 / Regex / Preset；角色级 Preset 优先。
6. 旧 ResourceBinding 自动迁移为显式 scope。
7. Universal Inspector 识别 Character Card、Persona、Theme、Lorebook、Preset、Regex、Unknown JSON。Theme / Unknown 暂时只归档不执行。
8. 完整备份包含社区资源归档。

## 已有重要能力

- Character Card V2/V3、内嵌 `character_book`、`regex_scripts`、`{{user}}` Persona。
- 世界中心：世界书 / 世界状态 / 预设 / 正则 / 资源库。
- Safe Rich HTML/CSS Renderer；禁止第三方 `<script>`、iframe、on* handler、javascript: URL。
- 角色卡 UI 状态解析，剧情时间 / 地点 / 周围 / presence 连续。
- 同场景：括号动作与对白同气泡；远程：独立 Action + 一句一气泡。
- 多层长期记忆与用户事实边界。

## 下一步优先级

建议 V0.4.3.2：

1. Lorebook 高级触发状态机：sticky / cooldown / delay / recursion / group scoring。
2. Preset Prompt Manager：可视化 Prompt Order、marker、启停、in-chat depth。
3. Regex 编辑器：作用范围、深度、执行前后预览、调试记录。
4. Theme / 美化 Runtime V1：社区主题字段映射、CSS sandbox、挂载到全局/角色/聊天。
5. 资源依赖与兼容报告：显示缺失的世界书 / Regex / Theme / Preset。
6. PNG Character Card metadata 导入。
7. conversation / persona 资源作用域 UI。

## 重要产品约束

- 不允许角色凭空编造用户习惯、过去经历和偏好；只能来自 Persona、真实聊天或可信长期记忆。
- 同场景动作直接以 `（动作）` 融入剧情气泡；远程动作可用独立 Action 呈现。
- 社区资源优先“原格式无损保存 + 兼容运行”，不要为了转换成自己的格式而静默丢字段。
- 不直接运行未知社区 JavaScript。
- 不要把所有新功能继续堆进 `ChatRoom.vue`；优先独立 service / runtime / component。

## 新对话继续开发时

先检查用户上传的最新 ZIP 与本交接说明，再直接修改代码、运行可执行的检查、更新版本文档，并生成干净 ZIP。不要只输出规划。
