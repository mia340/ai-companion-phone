# 心跳飞行棋 V1 · Couple Board Runtime

版本：`V0.5.0-alpha.5.5.2`

> 5.5.2 发布热修修正 5.5.1 测试夹具中的重复 `homeLayoutRevision` 键；游戏 Runtime、Launcher migration 与玩法均不变。

## 产品定位

「心跳飞行棋」是 AI Companion Phone 的原生双人关系互动 App。它不是新的事实源，也不是让模型自由决定现实动作的 Agent。游戏只负责：棋盘、题目、局内积分和用户主动的聊天草稿桥接。

## V1 玩法

- 30 格蛇形棋盘；用户与一个角色各自一枚棋子。
- 轮流掷 1–6 点骰子；终点前超出的点数直接收敛到终点。
- 格子包含：真心话、大冒险、心动、盲盒、贴近（前进）、害羞（后退）、休息和终点。
- 真心话 / 大冒险会弹出挑战卡。完成 +2 心动值；跳过允许继续游戏且最低不会扣成负数；换题不扣分。
- 心动格自动 +1，抵达终点额外 +3。

## 题库与强度

内置 64 条题目，按两种维度筛选：

```text
强度：L1 纯爱 / L2 暧昧 / L3 亲密 / L4 成人
模式：聊天互动 / 面对面
```

更高强度会混入低等级题目，避免每一格都落在最高刺激等级。L4 题目全部带 `adultOnly` 标记；Runtime 不会在 L1–L3 候选池中返回它们。

## 成人模式边界

- L4 开启前必须由用户显式确认双方均为成年人，并同意成人向题目。
- 如果所选角色 `Character.age` 明确小于 18，L4 直接阻断。
- 题目围绕成年人之间的亲密偏好、边界和暧昧互动，不把任何现实动作视为默认同意。
- 每一题都能“换一题”或“跳过”。跳过不是异常状态，也不会阻断后续回合。
- 游戏完成/跳过记录仅属于局内状态，不写入 Memory、Conversation State、Shared Event 或 Relationship Arc。

## 聊天联动

聊天互动模式会查找当前角色最近的真实单聊，然后把当前挑战写入：

```text
ai-companion-draft:<conversationId>
```

草稿携带 `game:<id>; challenge:<promptId>` reference，并明确告诉角色不要替用户回答或决定现实动作。用户仍需进入 ChatRoom 后自行点击发送。

**不会自动：**

- 调 Provider；
- 发送消息；
- 标记挑战完成；
- 修改记忆；
- 修改关系状态。

## 持久化

V1 不新增 IndexedDB store。游戏快照使用已有 `appCustomizations`：

```text
appKey = __couple-board-state__
coupleBoardState = CoupleBoardGame
```

该 object store 已经进入 Backup V12，因此续局状态自然跟随备份导出/恢复。

## Launcher 迁移

新增 `HomeAppKey = couple-board`，HomeLayout revision 从 12 升到 13。

迁移只做一件事：旧布局里没有心跳飞行棋时，把它放入第一个可用 1×1 槽位，满页时再开新页。旧版 V12 Widget 尺寸迁移现在只对 `storedRevision < 12` 执行，避免 revision bump 后再次覆盖用户自己调过的 Widget 尺寸。

## 测试定义

V1 新增 14 条 Couple Board service tests，并在 HomeLayout backup/migration 测试中增加 2 条：

```text
Test files declarations: 66
it/test declarations:   563
```

当前交付环境没有完整 npm 依赖，因此这些数字是源码测试定义，不冒充已经跑过的 Vitest 结果。Windows 与 CI 的 `npm run verify` 仍是最终发布门禁。
