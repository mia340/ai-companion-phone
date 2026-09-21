# Relationship Arc V1 · 关系脉络

版本：V0.5.0-alpha.5.4.2（5.4.0 功能 + 发布热修）

## 目标

Shared Timeline 已经回答“发生过什么”。Relationship Arc 继续回答“这些有证据的事件按时间串起来是什么样”，但不把 Runtime 变成关系裁判，也不让本地规则猜测角色心理、感情程度、冲突或和解。

## Evidence 编译

关系脉络节点只来自已有 Shared Event。每条 timeline evidence 可携带非持久化语义标记：

- `promise`：来源本身是 promise memory；
- `relationship-change`：来源本身是 relationship memory / relationship state history；
- `goal`：来源本身是 goal state history；
- `story`：来源本身是 story memory；
- `shared-event`：其它已有共同事件、动态、图片、音乐等。

其中只有真实 `ConversationStateHistory(field=relationship)` 会提供 `relationshipPreviousValue / relationshipNextValue`。普通聊天语气、图片、朋友圈文案不会被 Runtime 解释成“更亲近”“吵架”“和好”等关系结论。

## Phase

节点按真实发生时间升序排列。出现带明确 `relationshipNextValue` 的关系状态节点时，Runtime 才开启一个新的关系阶段。没有明确 relationship state 时，阶段只显示“有证据的共同经历”，不会推断当前关系。

## AI 关系摘要

AI 不是事实源。Runtime 先编译一个确定的 insight scope：保留首尾节点、关系变化、约定、收藏/高重要度节点，再限制最大节点数。

模型返回必须原样包含：

```text
characterId
arcFingerprint
nodeIds
完整 evidenceIds
summary
turningPoints[].nodeId
```

任一 node/evidence 缺失、增加、伪造或 fingerprint 不匹配都会被拒绝。转折点只能引用 scope 中已有 node id。候选结果默认不落库，只有用户点击采用后才保存。

确认后的摘要保存到现有 `appCustomizations.sharedTimelineState.relationshipArcSummaries`。key 是完整 arc fingerprint；节点或 evidence 改变后旧摘要自动失效。IndexedDB schema 不变。

## 带回聊天

用户可以主动把关系脉络带回真实会话。操作只写入本地聊天草稿，不自动发送。

如果存在仍有效的用户确认摘要，草稿引用该摘要对应的准确 node/evidence scope；否则只列已有节点标题，不生成新的关系结论。草稿带 provenance：

```text
[关系脉络引用 arc:<fingerprint>; nodes:<...>; evidence:<...>]
```

## 隐私与边界

- 隐藏 evidence 不进入 Relationship Arc；
- 不新增 Memory；
- 不自动修改 relationship state；
- 不自动进入角色 Prompt；
- 不做关系评分、好感度或“谁对谁错”判断；
- 所有节点仍可回到原 Shared Event，再逐条回到真实来源。
