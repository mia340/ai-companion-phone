# AI 续开发交接说明 · V0.4.3.6.1

当前基线：应用 V0.4.3.6.1 / IndexedDB V10 / backup V9。

## 本版性质

这是 V0.4.3.6 的纯构建修复版，不新增产品功能。

用户在 Windows 完整构建时发现：

```text
src/views/ChatRoom.vue:1557:83 - error TS2304: Cannot find name 'lorebookPrompt'.
```

V0.4.3.6 在 `sendMessage` 运行链路中已经将世界书 Prompt 命名为 `runtimeLorebookPrompt`，但用户事实支持文本数组里残留了旧变量名 `lorebookPrompt`。V0.4.3.6.1 已改为 `runtimeLorebookPrompt`。

## 必须保留的 V0.4.3.6 设计原则

社区 JSON 自带 UI / 固定输出协议时，社区 UI 优先；不要再用小手机自己的动作/对白排版规则覆盖原作者格式。普通角色没有 UI 约束时，才走小手机默认场景动作协议。

第三方任意 JavaScript 仍不得直接执行；HTML/CSS/安全交互可由 Safe Rich UI Runtime 承载。

## 数据版本

- IndexedDB V10
- backup V9
- 不需要迁移

## 下一步

V0.4.3.6.1 Windows 完整构建通过并实机验证社区 UI 后，再继续 WorldBook Engine V2 / Preset Prompt Manager / Regex Editor / Theme Runtime 主线。
