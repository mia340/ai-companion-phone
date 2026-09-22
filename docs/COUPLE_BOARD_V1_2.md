# 心跳飞行棋 V1.2 · 内容中心、回忆册与 Evidence V2

版本：`V0.5.0-alpha.5.7.0`

## 1. 这一版解决什么

V1.2 把心跳飞行棋从“单局小游戏”推进成可长期积累的情侣空间，但继续保持 local-first 与 evidence-first：用户可以经营自己的题库/事件牌组，完成的游戏留下本地回忆册；AI 可以利用真实 Memory 与 Shared Timeline 出题，但不能把模型生成内容反向提升成事实。

## 2. 情侣内容中心

路由：`/app/心跳飞行棋/library`。

题库支持：新增、编辑、删除、搜索、题型/强度筛选、系统题逐条启停、JSON 导入导出。事件卡支持：当前玩家/对方心动变化、交换棋子、再掷一次，以及系统卡逐条启停。

偏好结构升级到 V2；V1 偏好读取时自动迁移，已有自定义题不会丢失。开局会冻结自定义题、事件牌组和禁用题 id，因此内容中心在局中修改不会改变已经存在的游戏快照。

当某一类系统题被全部禁用且没有自定义替代，落到该挑战格时安全交棒；所有事件卡被禁用时事件格同样安全通过，不因空池崩溃。

## 3. 本地情侣回忆册

完成棋局自动保存到 `__couple-board-archive__`，最多保留最近 24 局。每条记录包含角色、模式/强度、双方累计心动、完成/跳过、事件数、真实证据题数量、回合节点和确定性 Heartbeat Highlights，并保留该局快照用于未来查看。

归档按 game id 幂等；刷新完成页不会重复产生多条记录。用户可以从内容中心删除某局。回忆册是游戏历史，不是角色事实：不会自动写 Memory、Shared Event 或 Relationship Arc。

## 4. AI 出题 V2

证据池由两部分组成：

1. Memory：仅 active 的 shared / relationship / event 类证据；排除 subjective、story、promise、conflict、invalid。
2. Shared Timeline：仅当前角色、未隐藏、来源为 memory 或 relationshipSignal=shared-event 的事实投影；显式排除 promise / goal / story。

Timeline evidence 使用 `timeline:<id>`，Memory 继续使用 memory id。模型必须返回输入集合里的 evidenceIds；Runtime 会丢弃伪造 id，并要求题型与当前 truth/dare 格一致。`memoryEvidenceIds` 仅作为旧兼容字段保存真正的 Memory id。

Evidence 文本永远按“被引用的数据”处理而不是指令，避免记忆内容里的提示词注入改变系统规则。

## 5. 聊天桥接

挑战和结算都只写 `ai-companion-draft:<conversationId>` 草稿。结算草稿来自真实局内统计和高光，明确要求聊天侧不要补写未发生经历。是否发送由用户决定。

## 6. 数据与版本

```text
App:                 0.5.0-alpha.5.7.0
IndexedDB:           V18 (unchanged)
Backup:              V12 (unchanged)
Launcher Grid:       V13 (unchanged)
HomeLayout revision: 13 (unchanged)
Preferences:         CoupleBoardPreferences V2
Archive:             CoupleBoardArchive V1
```

新增数据仍是 `appCustomizations` 的 passthrough 字段，因此不新增 object store、不提高 Backup schema。

## 7. 性能与 UI

内容中心独立路由懒加载；角色编辑、设置、备份、Memory 等次级页面也改为 route chunk，继续降低主入口 bundle 压力。原有骰子/棋子/任务卡动画继续保留，并遵守 `prefers-reduced-motion`。

## 8. 测试定义

```text
Test files: 67
Tests:      597
Couple Board direct tests: 46
```

覆盖 V1 偏好迁移、自定义事件、全禁用安全通过、事件效果、题库导入导出、归档、结算草稿、Shared Timeline evidence、去重与 legacy memoryEvidenceIds 兼容。完整运行结果以 Windows/CI 双 `npm run verify` 为准。
