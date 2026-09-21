# 时光 / 共同回忆 V1.2 · 共同事件

## 目标

V1.2 不再把每条证据都当成一件独立的“回忆”。同一次经历产生的聊天记忆、状态变化、图片、音乐与朋友圈动态可以被整理为一个 **Shared Event**，同时保留每一条 evidence 的原始来源。

## 事件模型

```text
真实 evidence
  ├─ CharacterMemory
  ├─ ConversationStateHistory
  ├─ Chat image / music message
  └─ Moment post
        ↓
SharedTimelineEvent Runtime
  ├─ 同 sourceMessageId：直接归并
  ├─ 同角色 + 同会话 + 短时间窗口：谨慎归并
  ├─ 同角色 + 文本重叠 + 6 小时内：谨慎归并
  └─ 用户人工合并：优先于自动归并
        ↓
共同事件详情
  ├─ 事件标题 / 时间范围
  ├─ 图片证据画廊
  ├─ evidence chain
  └─ 每条证据都可回到真实来源
```

## 人工合并

用户可切换到“证据”视图，选择至少两条同角色 evidence 合并为一个事件。持久化层只保存：

- event group id；
- evidence id 列表；
- 用户自定义标题；
- 创建时间。

不复制事实正文，也不创建新的 AI 记忆。拆分事件只删除人工分组关系，原 evidence 不受影响。

## 自动归并安全边界

自动归并只在以下条件之一满足时发生：

1. 两条 evidence 引用同一个 `sourceMessageId`；
2. 同角色、同会话、90 分钟内，且来源类型不同或包含媒体证据；
3. 同角色、6 小时内，并有足够文本重叠。

自动事件最大跨度为 8 小时，避免链式聚类把整天或多天内容误并成一件事。不同角色永不自动合并。

## 主动旧事

主动消息的旧事桥接从“单条 evidence”升级为“事件”。Runtime 会选择至少 7 天前的事件，并把：

- event id；
- evidence ids；
- 日期；
- 事件摘要；
- 来源标签；

一起放入 guarded prompt。角色如果提起旧事，只能依据这些 evidence，不能补写未发生的细节。

## 数据兼容

- IndexedDB V18 不变；
- Backup V12 不变；
- `appCustomizations.sharedTimelineState` 仅新增非索引 `eventGroups` 字段；
- 老数据无需迁移；
- 删除/隐藏/收藏仍针对原 evidence id，事件只是投影与分组层。
