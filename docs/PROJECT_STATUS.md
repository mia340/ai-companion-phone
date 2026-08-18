# AI Companion Phone 项目状态

## 当前版本

```text
应用：V0.4.4.7.2
IndexedDB：V14
Backup：V9
```

V0.4.4.7.2 是 **docs-only 整理版**：不修改运行逻辑、数据库结构或备份格式。运行功能沿用 V0.4.4.7；V0.4.4.7.1 修复 Windows Build 暴露的两个 TypeScript 错误。

## 当前阶段

项目重点：

> **通用 Character Card / WorldBook / Preset / Regex / Community UI Runtime + 多会话剧情状态管理。**

生产逻辑禁止按测试角色名、作者名、卡 ID 或文件名特判。

## 已完成

### Phone / PWA

- 手机外壳、锁屏、桌面、Dock、设置；
- PWA / generateSW；
- 白色 + 极淡蓝应用主题；
- 本地持久化与备份恢复。

### Character / Persona

- 原生角色；
- 常见 SillyTavern / Tavo V2/V3 JSON；
- PNG metadata；
- 原卡阅读器；
- Persona 导入/导出；
- 角色专属 Persona；
- 同源角色卡重复导入提示。

### Conversation

- 同一角色多聊天；
- 自由开局；
- 多开场；
- 候选回复；
- Branch V2；
- 分支状态/记忆/resource session 快照；
- 基础消息编辑与删除。

### Prompt / AI

- 统一 Provider；
- streaming；
- Token usage；
- context/max token/quota 硬停止；
- Prompt Debug；
- card-first；
- 默认第二人称 user；
- 图片理解入口。

### Memory / World State

- 六层记忆；
- 提取、合并、冲突；
- 相关记忆评分；
- ConversationState / StateHistory；
- Presence；
- pre-generation scene transition；
- 主动消息基础能力。

### Community Runtime

- Shared Resource + ResourceBinding；
- WorldBook；
- Regex；
- Prompt Preset；
- Resource Intent Router；
- 大型按需模块休眠；
- Active Resource Session；
- Safe Rich HTML；
- User Message Ownership；
- Author Text Status Header；
- Action Parser V2；
- Dialogue Parser V2；
- Community UI Compiler V2 第一阶段。

## 当前限制

### WorldBook

仍需 WorldBook Engine V2 收口：

- recursive scanning；
- sticky/cooldown/delay 完整生命周期；
- group scoring；
- 生成前 token budget；
- depth/position 完整精确语义。

### Community UI

- 未知第三方 JavaScript 不执行；
- 复杂 JS UI 仍可能安全降级；
- UI Compiler V2 尚未覆盖全部 HTML/DOM 模式。

### Memory / Data

- 核心检索仍是关键词/评分，不是完整向量数据库；
- 图片 Data URL 会增加 IndexedDB 占用；
- 无跨设备实时同步；
- 长消息列表仍需分页/虚拟化。

### Code

`ChatRoom.vue` 仍然过大，需要继续拆 generation pipeline、branch runtime、presentation projection。

## 下一里程碑

1. 先稳定 V0.4.4.7.x 的多会话 / 场景 / 呈现 / Community UI；
2. WorldBook Engine V2；
3. Community UI Compiler V2 扩展；
4. ChatRoom runtime 拆分；
5. 社区卡兼容回归矩阵；
6. 再进入群聊、朋友圈、日记、钱包、论坛/购物等上层 Phone OS 功能。

## 测试原则

底层更新至少覆盖：

- 简单纯文字卡；
- 多 WorldBook；
- Regex；
- Regex → HTML；
- 作者强制状态 UI；
- 大型按需资源；
- V3 / Depth Prompt；
- Persona / `{{user}}`；
- 多会话 / Branch；
- 三种呈现方式。

测试角色只能用于测试，不得进入生产条件分支。
