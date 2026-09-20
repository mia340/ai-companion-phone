# Social Runtime V1（alpha.5.0）

## 目标

把朋友圈从“页面内 setTimeout 触发的临时互动”升级为 App 级持久社交调度：

- 用户发动态后，多个角色按回复热度错峰评论；
- 用户回复角色评论后，被回复角色继续接话；
- 角色可以回复其他角色的评论，形成多人评论串；
- 离开朋友圈页面后，计划不会被取消；
- App 被挂起/关闭时不强行后台调用 API，待下一次恢复/打开 App 后补执行已到期任务；
- 通过线程深度上限、幂等键、失败重试限制避免无限互聊和重复请求。

## 数据模型

IndexedDB V17 新增 `socialActivities`，记录 Social Runtime 的运行时队列：

- `channel`: 当前为 `moments`；后续群聊可扩展为新的社交 channel；
- `kind`: `moment-comment / moment-reply / moment-like`；
- `actorCharacterId`: 谁执行；
- `momentId / targetCommentId`: 在哪里、回复谁；
- `threadDepth`: 评论串深度；
- `dueAt`: 什么时候可执行；
- `status / attempts / lastError`: 可靠调度和重试。

该队列是可重建的运行时元数据，因此 Backup V11 暂不导出它；恢复备份时会清空旧队列，避免引用已经被替换的动态/评论。

## 运行模型

1. 页面只负责创建真实用户动作（发动态、发评论）。
2. Social Runtime 把后续 AI 行为写入持久队列。
3. `main.ts` 全局启动 Social Runtime，每 2.5 秒在 App 可见且在线时消费少量到期任务。
4. 页面关闭不会清队列；重新打开朋友圈时 Dexie liveQuery 自动显示已经发生的互动。
5. 浏览器/系统完全挂起页面时不会偷偷请求模型；恢复后按 `dueAt` 补执行。

## 评论线程规则

- 用户回复角色评论：被回复角色保证排队继续回复。
- 角色初始评论后：按“回复热度”有概率由另一角色接话。
- 角色之间最多递归到固定线程深度，避免 A/B 无限互聊。
- 角色评论其他角色时不默认假设亲密关系；Prompt 明确要求信息不足时采用轻量、自然的熟人回应。

## 为群聊预留

V1 不实现群聊 UI，但队列已经使用 `channel + actor + target + dueAt` 的社交事件结构，而不是把逻辑绑死在 `MomentsView.vue`。后续群聊建议复用：

- 同一全局活动调度器；
- 参与者选择 / 冷却 / 幂等；
- 角色对角色回复 Prompt；
- 统一失败重试；

再新增 `group-chat` channel 与对应消息目标即可。
