# AI Companion Phone 文档中心

当前开发线：**V0.5.0-alpha.5.6.0**

```text
应用：0.5.0-alpha.5.6.0
IndexedDB：V18
Backup：V12
测试定义：67 个测试文件 / 580 个 it/test 声明
当前 UI 主线：Launcher Grid V13 / HomeLayout revision 13（4×6 网格 / insert+reflow / App 文件夹 / Inspector V4）+ 原生 App「时光」「心跳飞行棋」
```

这里是项目 Markdown 文档的**唯一保管入口**。项目根目录不再散放逐版本说明；版本交付文档统一在 `docs/releases/`，同类项目研究统一在 `docs/research/`。

## 先看什么

### 第一次运行 / 更新

1. `START_HERE_小白启动指南.md`：第一次启动、Build、常见问题。
2. `部署与更新.md`：长期通用的 Windows / Git / Build 流程。
3. `releases/V0.5.0-alpha.5.6.0_部署与更新.md`：当前版本的专项验收步骤。

### 当前开发单一事实源

1. `PROJECT_STATUS.md`：**现在做到哪里、当前边界、下一步优先级**。
2. `ARCHITECTURE.md`：核心架构、数据归属与 Runtime 边界。
3. `ENGINEERING_AUDIT.md`：技术债、风险、测试缺口和重构方向。
4. `COMMUNITY_RUNTIME.md`：Character Card / WorldBook / Preset / Regex / Community UI 语义。
5. `SOCIAL_RUNTIME_V2.md`：朋友圈候选、权限、持久活动队列和通知。
6. `知间产品原则.md`：知间当前信息架构、视觉与数据原则。
7. `COUPLE_BOARD_V1.md`：心跳飞行棋 V1.1 规则、自定义题库、真实回忆出题、事件卡与成人模式边界。
8. `DEVELOPMENT_LOG.md`：最近实际开发记录与决策。

### 研究 / 参考项目

- `research/REFERENCE_PROJECTS.md`：长期参考项目索引和学习原则。
- `research/SULLYOS_DEEP_STUDY_2026-09-18.md`：SullyOS·糯米机 Launcher / Character Card / WorldBook / Memory / 主动消息深度研究与吸收记录。
- `research/REFERENCE_STUDY_2026-09-13.md`：早一轮工程研究。
- `research/REFERENCE_STUDY_SMALL_PHONES_2026-09-17.md`：本轮 20+ 小手机/辅助工具案例研究与可吸收机制。
- `research/HOME_WIDGET_CUSTOMIZATION_STUDY_2026-09-18.md`：Apple / Widgetsmith / Color Widgets / ScreenKit 主屏与 Widget 自定义研究。
- `research/HOME_LAUNCHER_GRID_STUDY_2026-09-18.md`：Apple / Android 官方桌面分页、边缘换页与 Widget 网格语义研究。
- `COMMUNITY_PERSONA_COMPATIBILITY_AUDIT_2026-09-13.md`：社区 Persona 兼容专项审计。

### 历史与发布

- `CHANGELOG.md`：精简版本变化。
- `RELEASE_HISTORY.md`：较早版本长篇发布说明归档。
- `DEVELOPMENT_HISTORY.md`：早期开发日志归档。
- `COMMUNITY_RUNTIME_HISTORY.md`：早期社区兼容历史。
- `releases/`：逐版本 `RELEASE_MANIFEST` 与部署/更新说明，**只归档，不作为当前状态源**。

### 毕业设计

- `毕业设计与论文素材.md`：论文题目、研究问题、创新点、实验与案例素材。
- 当前论文引用具体版本号、数据库号、测试数量时，应优先以 `PROJECT_STATUS.md` + 源码为准，不要复制旧 Release 文档里的历史数字。

## 当前 docs 结构

```text
docs/
├─ README.md
├─ PROJECT_STATUS.md
├─ ARCHITECTURE.md
├─ ENGINEERING_AUDIT.md
├─ COMMUNITY_RUNTIME.md
├─ SOCIAL_RUNTIME_V1.md
├─ SOCIAL_RUNTIME_V2.md
├─ 知间产品原则.md
├─ START_HERE_小白启动指南.md
├─ 部署与更新.md
├─ DEVELOPMENT_LOG.md
├─ CHANGELOG.md
├─ RELEASE_HISTORY.md
├─ DEVELOPMENT_HISTORY.md
├─ COMMUNITY_RUNTIME_HISTORY.md
├─ 毕业设计与论文素材.md
├─ research/
│  ├─ REFERENCE_PROJECTS.md
│  ├─ REFERENCE_STUDY_2026-09-13.md
│  ├─ REFERENCE_STUDY_SMALL_PHONES_2026-09-17.md
│  └─ HOME_WIDGET_CUSTOMIZATION_STUDY_2026-09-18.md
└─ releases/
   ├─ V..._RELEASE_MANIFEST.md
   └─ V..._部署与更新.md
```

## 文档维护规则

每次代码交付至少维护：

- `package.json` / `package-lock.json` 版本；
- `PROJECT_STATUS.md`；
- `CHANGELOG.md`；
- `DEVELOPMENT_LOG.md`；
- `releases/<当前版本>_RELEASE_MANIFEST.md`；
- `releases/<当前版本>_部署与更新.md`。

发生架构边界变化时更新 `ARCHITECTURE.md`；Character Card / WorldBook / Preset / Regex / Community UI 语义变化时更新 `COMMUNITY_RUNTIME.md`；Social Runtime 语义变化时更新 `SOCIAL_RUNTIME_V2.md`。

**不要再把旧版本流水账塞回 `PROJECT_STATUS.md`。** 当前状态只写现在；历史去 `CHANGELOG / RELEASE_HISTORY / releases/`。


## 2026-09-18 · alpha.5.1.12
Launcher Grid V7 已在二维布局 Item 基础上加入插入式流动重排与实时拖拽预览，并推进 Character Card Import Report、WorldBook/Context Inspector、AgentAction capability boundary、Backup Zod preflight 与 HomeLayout Schema。
