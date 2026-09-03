# AI Companion Phone Docs

当前开发线：**V0.5.0-alpha.3（Conversation Runtime 第二刀）**

```text
应用：0.5.0-alpha.3
IndexedDB：V14
Backup：V9
原始审查基线：用户上传 V0.4.7.1
当前升级基线：V0.5.0-alpha.2.1
```

> 重要：alpha.3 以 `0.5.0-alpha.2.1` 为直接基线。alpha.2.1 的最终 149/149 Windows 日志尚未回传，因此 alpha.3 仍按“先 npm test，再 Build，再人工回归”的门禁验收；不要在红灯状态 commit。

## 文档入口

### 第一次运行 / 更新

1. `START_HERE_小白启动指南.md`：第一次启动、Build、反馈问题。
2. `部署与更新.md`：Windows PowerShell 覆盖、Build、Git 提交的标准流程。

### 当前开发

1. `PROJECT_STATUS.md`：唯一的“现在做到哪里 / 下一步做什么”。
2. `ENGINEERING_AUDIT.md`：目录级代码审查、技术债、潜在 Bug、测试缺口和 V0.5 路线图。
3. `ARCHITECTURE.md`：当前架构与 V0.5 Runtime 目标边界。
4. `COMMUNITY_RUNTIME.md`：Character Card / WorldBook / Regex / Community UI 当前语义。
5. `DEVELOPMENT_LOG.md`：最近开发决策和本轮实际修改。
6. `REFERENCE_PROJECTS.md`：公开“小手机”与工具样本、学习原则。

### 历史归档

- `CHANGELOG.md`：每个版本/预发布版的精简变化。
- `RELEASE_HISTORY.md`：旧版本长篇发布说明。
- `DEVELOPMENT_HISTORY.md`：较早开发日志。
- `COMMUNITY_RUNTIME_HISTORY.md`：早期社区兼容审计。

### 毕业设计

- `毕业设计与论文素材.md`：论文题目、研究问题、创新点、实验方案和开发案例。

## docs 结构

```text
docs/
├─ README.md                         # 文档总入口
├─ START_HERE_小白启动指南.md         # 第一次运行
├─ 部署与更新.md                     # 更新 / Build / Git
├─ PROJECT_STATUS.md                 # 当前状态（只写现在）
├─ ENGINEERING_AUDIT.md              # 工程审查 + V0.5 路线图
├─ ARCHITECTURE.md                   # 架构单一事实源
├─ COMMUNITY_RUNTIME.md              # 当前社区 Runtime 语义
├─ REFERENCE_PROJECTS.md             # 参考项目学习库
├─ DEVELOPMENT_LOG.md                # 最近开发记录
├─ CHANGELOG.md                      # 精简版本变化
├─ RELEASE_HISTORY.md                # 发布历史归档
├─ DEVELOPMENT_HISTORY.md            # 旧开发日志归档
├─ COMMUNITY_RUNTIME_HISTORY.md       # 旧社区兼容审计归档
└─ 毕业设计与论文素材.md              # 论文 / 答辩素材
```

## 维护规则

每次代码交付至少维护：

- `package.json` / `package-lock.json` 版本；
- `PROJECT_STATUS.md`；
- `CHANGELOG.md`；
- `DEVELOPMENT_LOG.md`。

发生架构边界变化时再维护 `ARCHITECTURE.md`；Character Card / WorldBook / Regex / Community UI 语义变化时再维护 `COMMUNITY_RUNTIME.md`。代码审查结论或重构优先级发生实质变化时更新 `ENGINEERING_AUDIT.md`。

历史内容不要继续堆进 `PROJECT_STATUS.md`。旧说明进入对应 `*_HISTORY.md` 或 `RELEASE_HISTORY.md`。通过 `npm run cleanup` 清理已经完成归档的旧 Markdown；不要手工删除当前 14 份长期文档。
