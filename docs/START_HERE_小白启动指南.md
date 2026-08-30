# 从这里开始

## 环境

Node.js 20+，VS Code 打开完整项目目录。

## 第一次运行

```bash
npm install
npm run dev
```

## 更新源码

完整流程见 `部署与更新.md`：

```text
解压
→ robocopy
→ 检查版本
→ npm run build
→ 测试
→ git commit
→ git push
```

## Build

```bash
npm run build
```

看到 `built in` 与 `dist/sw.js` 表示构建完成；出现 `error TSxxxx` 时先停止提交。

## 手机测试

```bash
npm run dev -- --host 0.0.0.0
```

手机与电脑同一 Wi‑Fi，打开终端给出的局域网地址。

## 图片理解

```text
设置 → API 与模型 → 图片理解
```

## 记忆管理

```text
聊天页 → 右上角 ··· → 记忆 → 打开完整记忆管理
```

## 当前版本

```text
V0.4.7.1
IndexedDB V14
Backup V9
```

本版本重点是稳定 Community UI、纯手机/动作分离呈现，以及用户消息编辑后的重新回复；Character Card / WorldBook / Regex 底层继续沿用 V0.4.7.0。继续开发前建议阅读：

1. `PROJECT_STATUS.md`
2. `ARCHITECTURE.md`
3. `COMMUNITY_RUNTIME.md`


## 测试分工说明

普通使用者不需要手工创建 Selective Logic / Recursion / Sticky / Cooldown / @D / Outlet 测试数据。
这些属于协议级开发测试，由项目测试代码与开发回归负责。

你更新后只需要做真实使用验收：

1. 打开带作者状态栏/旧 Rich 开场的真实卡：开场应有稳定承载背景，后续 `【状态栏】` 数据应能恢复成作者 HTML；
2. 切纯手机模式连续聊两轮：模型可返回一条或多条 text，但多条必须共同承接最新用户消息，不应是应用按句号机械切；
3. 切动作/台词分开：有自然动作时应看到独立动作；远程动作只能写角色自己一端，Presence 不应因此变同场；
4. 编辑一条用户消息，选择/确认“从这条消息重新回复”：旧后续应移除，并从编辑后的消息重新生成；
5. 再快速检查论坛/微信 Resource Session、资源库移动端宽度和多聊天。

## 角色卡兼容问题怎么反馈

遇到角色卡不按作者设定、开场、世界书或 UI 工作时，不需要手工造 Selective Logic 测试。请提供：

1. 角色卡本身（可分享时）；
2. 实际操作步骤；
3. 截图；
4. Prompt Debug。

V0.4.7.0 起 Prompt Debug 的 `Character Card Runtime` 会显示卡版本、`{{char}}` 宏名、system prompt 模式、creator_notes 是否进 Prompt；协议级组合由开发回归负责。
