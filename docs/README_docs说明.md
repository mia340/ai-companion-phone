# docs 文档说明

## 当前文档

- `开发日志.md`：按照版本记录每天完成的功能和踩坑。
- `PROJECT_STATUS.md`：记录当前版本、已完成内容、限制和下一阶段。
- `ARCHITECTURE.md`：记录系统总体架构与技术原则。
- `CHANGELOG.md`：记录各版本新增与修复。
- `毕业设计与论文素材.md`：记录可用于毕业设计和论文的问题、思路、方案与实验素材。

## 更新规则

每次开发结束至少更新：

1. `开发日志.md`
2. `PROJECT_STATUS.md`
3. `毕业设计与论文素材.md`

发生系统结构变化时更新：

4. `ARCHITECTURE.md`

发布新版本时更新：

5. `CHANGELOG.md`

## 新聊天恢复上下文

平时版本更新**不再**生成 `AI续开发交接说明_Vx.x.x.md` 和 `新对话请先阅读_Vx.x.x.md`。

只有用户明确准备开启新对话时，才按当时最新代码重新生成一次：

- `AI续开发交接说明.md`
- `新对话请先阅读.md`

日常续开发以这些持续维护文档为准：

- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ARCHITECTURE.md`
- `开发日志.md`

这样避免每个补丁版本都复制一套高度重复的交接文件。

## 当前文档基线

截至 V0.4.4.7，持续维护文档已同步记录：

- 角色卡 / WorldBook / Preset / Regex / Community UI 通用兼容运行时
- 同一角色多 Conversation、自由开局与 Branch 状态快照
- 六层记忆、Presence 场景状态机与 Prompt Debug
- Shared Resource + ResourceBinding
- 数据备份、恢复与跨浏览器迁移
- TypeScript、Vue、IndexedDB、PWA 与部署问题的持续定位记录

后续每完成一个稳定模块，先运行 `npm run build`，确认无错误后再更新文档与提交 Git。
## Markdown 归档规则（V0.4.3.7.4 起）

项目内所有 `.md` 文档统一直接放在 `docs/` 文件夹，不再散落在 ZIP / 仓库根目录。架构文档、项目状态、开发日志、更新记录和历史说明都遵守这一规则。交接说明与新对话说明改为“需要开启新对话时才生成”。

