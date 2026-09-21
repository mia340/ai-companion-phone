# 时光 V1.3 · Event Intelligence

V1.3 在 V1.2 的 Shared Event Runtime 之上增加“事件级整理”能力。事实来源仍然只有已有 evidence；AI、备注和排序都不能创建新的事实记录。

## 事件 AI 摘要

事件详情可以请求 AI 生成标题候选与事件摘要。Runtime 会把当前事件的 `event id` 与完整 `evidence ids` 一起交给 Provider，并要求模型原样返回全部 evidence id。只要 event id 不匹配、漏掉任意 evidence、补造未知 evidence 或 JSON 不合法，本次摘要就直接作废。

AI 摘要不会自动保存。只有用户点击“采用摘要”后，才把摘要文本、完整 evidence id 集合和确认时间写入 `appCustomizations.sharedTimelineState.eventSummaries`。摘要以稳定 evidence fingerprint 为 key；事件证据变化或被隐藏导致可见 evidence 集合变化时，旧摘要自动失效，不会泄露被隐藏内容。

## 我的备注

用户可以给共同事件写备注。备注保存于 `sharedTimelineState.eventNotes`，同样使用稳定 evidence fingerprint，不修改消息、记忆、朋友圈或状态历史，也不会自动进入角色 Prompt。

## 聊天上下文窗口

事件详情对带 `sourceMessageId` 的 evidence 显示真实来源消息前后各一条聊天。上下文只做读取，不写回 Memory；其它会话不会混入，撤回消息不会作为上下文展示。

## 证据排序

人工事件保留 `eventGroups.itemIds` 的用户顺序。事件详情支持上移/下移 evidence；对自动事件第一次排序时会把当前 evidence 集合转换为人工事件，只保存 evidence id 顺序，不复制正文。事件日期范围仍按真实时间计算。

## 事件级主动回忆

主动旧事继续使用 event id + evidence ids guard；如果用户已经确认过且仍与完整 evidence 集合一致的事件摘要，主动消息只使用该确认摘要。隐藏 evidence 会先从事件投影中移除，因此过期摘要不会被继续引用。

## Persistence

- IndexedDB V18 不变。
- Backup V12 不变。
- Launcher Grid V13 / HomeLayout revision 12 不变。
- 新字段仍位于 `appCustomizations.sharedTimelineState` 的非索引 JSON 中，无需数据库迁移。
