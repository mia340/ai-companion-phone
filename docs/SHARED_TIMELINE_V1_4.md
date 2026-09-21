# 时光 V1.4：周年回顾、带回聊天与关系图

V0.5.0-alpha.5.3.5 在 Shared Event Runtime 之上增加三项能力：

- 周年回顾：只从真实事件 startedAt 计算未来 30 天周年，不生成新的事实或日期。
- 带回聊天：用户主动点击后，把事件标题、已确认摘要/事件摘要与 event/evidence provenance 写入目标会话草稿；不会自动发送。
- 相关时光：只基于同角色、时间距离和来源类型建立派生关系；不同角色永不关联，关系本身不写入 Memory。

这些能力都不新增 IndexedDB store。事件事实仍由原始 evidence 决定。
