# CHANGELOG

> 精简版本变化。完整逐版本说明见 `RELEASE_HISTORY.md`。

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
