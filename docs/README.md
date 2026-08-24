# AI Companion Phone Docs

当前文档版本：**V0.4.6.0**

```text
应用：V0.4.6.0
IndexedDB：V14
Backup：V9
```

V0.4.6.0 是 **Character Card Compatibility Alignment**：底层读取尽量向 Character Card V2/V3 与成熟社区前端对齐，同时保留小手机的多会话、场景呈现、Prompt Debug、资源会话与 Safe Community UI。数据库版本保持不变。

## 文档怎么读

运行 / 更新：

1. `START_HERE_小白启动指南.md`
2. `部署与更新.md`

继续开发：

1. `PROJECT_STATUS.md`
2. `ARCHITECTURE.md`
3. `COMMUNITY_RUNTIME.md`
4. `DEVELOPMENT_LOG.md`

历史：

- `CHANGELOG.md`：精简版本变化；
- `RELEASE_HISTORY.md`：旧逐版本说明完整合并。

论文：

- `毕业设计与论文素材.md`

## docs 结构

```text
docs/
├─ README.md
├─ START_HERE_小白启动指南.md
├─ PROJECT_STATUS.md
├─ ARCHITECTURE.md
├─ COMMUNITY_RUNTIME.md
├─ CHANGELOG.md
├─ RELEASE_HISTORY.md
├─ DEVELOPMENT_LOG.md
├─ 部署与更新.md
└─ 毕业设计与论文素材.md
```

## 维护规则

普通代码更新至少维护：

- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

架构变化再维护：

- `ARCHITECTURE.md`
- `COMMUNITY_RUNTIME.md`（社区协议变化时）

以后不再为每个小版本创建独立 `Vx.x.x_*.md`。需要长篇发布说明时，直接追加到 `RELEASE_HISTORY.md` 最上方。
