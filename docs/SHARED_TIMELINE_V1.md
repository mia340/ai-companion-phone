# 时光 / 共同回忆 V1

## 目标

「时光」不是第二套 Memory 数据库，而是对已有事实源的可追溯投影。用户看到的每张卡都必须来自现有 Memory、朋友圈 Moment 或 Conversation State History，并保留 source id。

## 事实边界

- Memory / Moment / State History 继续拥有事实正文。
- `appCustomizations.sharedTimelineState` 只保存 `starredIds / hiddenIds / customTitles`，不复制事实内容。
- 有 `sourceMessageId` 的 Memory / State 卡跳回 `/chat/:id?message=:messageId`；Moment 卡跳回 `/app/朋友圈?moment=:momentId`。
- 删除或失效的源记录不会被 Timeline 重新创造。

## AI 整理边界

AI 只接收最多 40 条候选证据的 id、日期、角色名、类型与摘要，并最多返回 5 个既有 evidence id。Runtime 会：

1. 只接受候选集合中真实存在的 id；
2. 丢弃未知 id、重复 id、非法 JSON 与空标题；
3. 默认只展示“AI 候选”，不修改 Memory / Moment / State；
4. 只有用户点“采用标题并收藏”后，才把建议标题与收藏状态写入用户偏好。

因此模型可以整理，但不能成为事实源。
