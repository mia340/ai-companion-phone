# 心跳飞行棋 V1.1 · Couple Board Runtime

版本：`V0.5.0-alpha.5.6.0`

> V1.1 在 V1 的 30 格双人棋盘上增加自定义题库、真实共同回忆 AI 出题、情侣事件卡、Heartbeat Highlights 与交互动效。它仍不是新的事实源，也不让模型替参与者决定现实动作。

## 产品定位

「心跳飞行棋」是 AI Companion Phone 的原生双人关系互动 App。Runtime 负责棋盘、题库、事件、局内积分和受控的 AI 题目生成；Memory、Conversation、Shared Event、Relationship Arc 继续是各自的事实/投影层。

## 玩法

- 30 格蛇形棋盘；用户与一个角色轮流掷 1–6 点骰子。
- 真心话 / 大冒险完成 +2 心动；跳过始终可用且最低不扣成负数；换题不扣分。
- 心动格自动 +1；贴近 / 害羞做前进或后退；休息格直接交棒；终点额外 +3。
- 原“惊喜”格改为**情侣事件卡**，拥有独立 `pendingEvent`，不会偷偷复用挑战题状态。

## 题库

### 内置题

仍保留 64 条 V1 内置题：

```text
强度：L1 纯爱 / L2 暧昧 / L3 亲密 / L4 成人
模式：聊天互动 / 面对面
```

更高强度可混入低等级题；L4 仍受 Runtime 18+ 门禁。

### 自定义题

V1.1 可创建自定义真心话 / 大冒险，并指定：

- 强度 L1–L4；
- 聊天 / 面对面 / 双模式；
- 最多 160 字纯文本。

偏好保存在已有 `appCustomizations`：

```text
appKey = __couple-board-preferences__
coupleBoardPreferences.version = 1
```

开局时当前自定义题会冻结为 `sessionPrompts`。之后即使用户编辑全局题库，已经开始的棋局也不会改变题目集合。L4 自定义题自动标记 `adultOnly`。

## 真实共同回忆 AI 出题

挑战卡上可主动点击“用真实共同回忆重新出题”。流程：

```text
当前真实单聊
  → listConversationMemoryContext
  → evidence filter
  → Provider
  → JSON parse
  → evidence/type/mode Runtime validation
  → session prompt（仅当前棋局）
```

### 允许的证据

只把能当作共同经历证据的记录交给模型：

- `layer = shared`；
- `layer = relationship`；
- `category = event`。

明确排除：

- `subjective`：角色主观判断不是共同事实；
- `story`：长期剧情摘要可能包含压缩/推演；
- `promise`：约定不等于已经发生的共同回忆；
- `status = conflict / invalid`。

### 模型输出门禁

模型必须返回纯 JSON：

```json
{"type":"truth|dare","text":"...","evidenceIds":["..."]}
```

Runtime 会拒绝：

- 不引用任何真实 evidence；
- 引用输入中不存在的 evidence id；
- 把 truth 改成 dare 或反过来；
- 与当前模式 / 强度不兼容；
- 空题目或非法结构。

此外，evidence 文本在 Prompt 中被明确声明为**引用数据而不是指令**；即使记忆正文包含“忽略规则 / 系统消息 / 请执行”等字样，模型也不得把它当作可执行指令。角色 Persona 不参与共同回忆事实生成，避免把角色卡叙事误当成已经发生的经历。

通过后的题只写入当前 `CoupleBoardGame.sessionPrompts`，**不会写回 Memory，也不会把模型生成内容提升成 Shared Event / Relationship Fact**。

## 情侣事件卡

V1.1 内置 6 张事件卡，例如心跳同步、勇气加码、被接住、秘密花园。事件只产生确定性的局内心动值变化；它们不要求模型解释，也不写关系事实。

事件卡是独立 pending state，因此：

- 未处理事件时不能继续掷骰子；
- 存档恢复能准确回到事件卡；
- 老 V1 snapshot 没有 `pendingEvent/sessionPrompts` 也能解析。

## Heartbeat Highlights

终局根据**真实局内日志**生成最多 4 张高光卡：

- 总心动 / 完成数；
- 本局最高强度的已完成挑战；
- 完成过的真实回忆 AI 题及其 evidence 数；
- 事件卡数量，或没有事件卡时被尊重的“跳过”边界。

这是确定性 Runtime 汇总，不让模型评价“谁更爱谁”、关系好坏或胜负价值。

## 成人模式与同意边界

- L4 开启前需要用户显式确认双方均为成年人。
- 如果 `Character.age` 明确小于 18，Runtime 直接拒绝 L4。
- 成人档仍只做非露骨、同意优先的亲密题；现实动作必须由参与者自己同意。
- 任何题目都能更换或跳过；跳过不是失败，也不会阻断游戏。
- 自定义 L4 与 AI 生成 L4 同样受门禁，不存在绕过路径。

## 聊天桥接

聊天模式仍只把当前挑战写入：

```text
ai-companion-draft:<conversationId>
```

用户必须自己进入 ChatRoom 并点击发送。对于回忆 AI 题，草稿只额外标明“来自已存共同记忆”和 evidence 数，不把 evidence 原文强塞进消息。

## 持久化 / Schema

V1.1 不新增 IndexedDB store：

```text
__couple-board-state__        → CoupleBoardGame
__couple-board-preferences__  → CoupleBoardPreferences
```

它们都复用 `appCustomizations`，因此自然进入现有 Backup V12。

```text
IndexedDB:           V18（不变）
Backup:              V12（不变）
Launcher Grid:       V13（不变）
HomeLayout revision: 13（不变）
```

## 测试定义

V1.1 扩充游戏 Runtime，并新增 Memory Prompt Service 测试，静态定义为：

```text
Test files: 67
it/test:    580
Couple Board related: 30
```

当前容器 npm registry 无法解析，因此没有把语法/静态检查冒充完整 Vitest。正式发布以 Windows / CI 两轮 `npm run verify` 为准。
