# V0.4.3.6 · 社区 UI 输出接管

## 目标

社区角色卡、世界书、Preset 或 Regex 已经定义 UI / 状态栏 / 固定输出格式时，小手机不再用自己的“动作与对白分开/合并”规则覆盖作者格式。

优先级改为：

```text
社区 JSON 自带 UI / 输出协议
↓
角色卡 / Persona / WorldBook / Preset / Memory 等内容约束
↓
普通小手机场景与动作协议（仅无社区 UI 时兜底）
```

## 识别来源

运行时会综合检查：

- 本轮实际激活的 WorldBook Prompt；
- 当前绑定的 Prompt Preset；
- 当前角色绑定的 assistant-output Regex；
- 角色卡 system prompt / post-history instructions / depth prompt / creator notes / first message / raw extensions。

强特征包括：

- “每次回复必须 / 严格遵守 / 最高优先级 / 输出格式 / 状态栏格式 UI”；
- `<日期>...</日期>`、`<状态栏>...</状态栏>`、角色状态/心声/计划等固定 XML 标签；
- `<div> / <style> / <details> / <!DOCTYPE html>` 等 UI 模板；
- assistant-output Regex 把状态标签转换成 HTML/CSS。

## UI 接管时的行为

检测到社区 UI 后：

1. 不注入小手机 `scene_action / companion_packet` 输出协议；
2. 不执行默认“远程分开、同场合并”的气泡整形；
3. 不把社区标签改成中文括号动作；
4. assistant-output Regex 直接作用于模型原始输出，避免模型标签在正则执行前被解析器吃掉；
5. Regex 生成 HTML 时直接进入 Safe Rich HTML Runtime；
6. Regex 未生成 HTML 时也保留社区结构化文本，只移除小手机自己的私有协议残片；
7. 流式生成期间隐藏原始标签预览，完成后一次性按 UI 渲染，避免 HTML/XML 碎片闪现。

## 普通角色

没有检测到社区 UI 时保持自动规则：

- remote：动作独立、对白按手机消息显示；
- together：动作与对白自然合并；
- 不再提供“始终分开 / 始终合并”的手动选择。

旧数据库里已有 `actionTextLayout=separate/merged` 不删除，以保证备份兼容，但运行时不再让它覆盖自动场景规则。

## Full HTML Regex 兼容

社区 Regex 常返回完整：

```html
<!DOCTYPE html>
<html>
<head><style>...</style></head>
<body>...</body>
</html>
```

V0.4.3.6 会提取 `<head>` 中的 `<style>` 和 `<body>` 内容，再挂载到 Shadow DOM；完整 document 不再直接塞进聊天 div。CSS 中 `body/html { ... }` 会安全映射到 Shadow Host。

安全边界不变：`script / iframe / object / embed`、事件属性和 `javascript:` URL 不执行。常见 `data-target` Tab 会由小手机自己的安全交互绑定恢复切换效果，不执行原卡脚本。

## 真实资源验证

### Tavo_墨清尘_20251008T2000.json

世界书“状态栏”条目明确要求每次回复开头携带状态栏 UI，并包含 `<div>/<details>` HTML 模板。检测结果：

```text
active = true
mode = html-contract
reason = 世界书定义了每轮 UI / 状态栏输出格式
```

### cb118ca09fa1bd50.json（离婚的诱惑）

世界书明确要求每次回复末尾输出 `<日期>/<时间>/<地点>/...` 固定 XML 状态栏，同时内嵌“状态栏” Regex 将其转换为完整 HTML。检测结果：

```text
active = true
mode = regex-html
reason = 输出正则生成 UI + 世界书定义每轮状态栏
```

## 数据版本

```text
应用：V0.4.3.6
IndexedDB：V10
Backup：V9
```

无数据库迁移。
