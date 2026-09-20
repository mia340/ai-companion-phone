# 主屏 / Widget 自定义研究 · 2026-09-18

## 研究目的

本轮不是继续堆 App，而是纠正 alpha.5.1.6 把主屏做成“六入口功能面板”的偏差。目标是让空间桌面更像真实手机，同时保留 AI Companion 项目的本地优先与玩家可设计能力。

研究对象：

1. Apple iPhone Home Screen customization
   - https://support.apple.com/en-my/guide/iphone/iph385473442/27/ios/27
2. Widgetsmith
   - https://widgetsmith.app/
   - https://apps.apple.com/us/app/widgetsmith/id1523682319
3. Color Widgets
   - https://apps.apple.com/us/app/color-widgets/id1531594277
4. ScreenKit
   - https://apps.apple.com/us/app/screenkit-app-icons-widget/id1533393982

## 可确认的共同处理方式

### 1. 主屏首先是 Launcher，不是设置页

真实手机的稳定骨架是：

- App 网格；
- 可选 Widget；
- 底部 Dock；
- 壁纸；
- 长按进入编辑态。

因此主屏不应常驻“长按这里可以设置”一类教学文案。操作发现由编辑态和设置入口承担。

### 2. Widget 与主题应允许玩家组合

Widgetsmith 支持多种 Widget 类型，并允许调整颜色、字体、背景、边框、主题，以及将主题应用到多个 Widget；其 2026 版本还加入 clear / frosted 外观和照片背景。

Color Widgets 强调模板 + 自定义：照片、时间日期、电量、倒计时、天气、音乐、日历等 Widget 都可以继续调整图片、字体和配色。

ScreenKit 则把 App Icon、Widget、Theme、Wallpaper 放进同一套 Home Screen makeover 流程，并允许从模板继续编辑。

可吸收结论：知间不应该只提供一套固定 Widget，而要把 Widget 看成可组合的桌面模块；本轮先建立 catalog + persisted selection + material style，后续再扩展内容类型。

### 3. 编辑态比“跳设置页”更符合手机心智

Apple 的 Home Screen 通过长按背景进入编辑 / 自定义状态；图标进入可编辑反馈，用户再添加/移动 Widget、改变外观或页面。

本轮对应实现：

```text
长按桌面空白
  ↓
Home Edit Mode
  ├─ 添加小组件
  ├─ 自定义
  ├─ 编辑墙纸
  ├─ 编辑页面
  └─ 完成
```

App / Dock 在编辑态出现轻微 jiggle 和减号入口。当前不实现自由拖拽排序，先保证持久布局、安全移除与恢复；未来可在同一数据模型上加入 drag-and-drop。

## 本项目采用的设计

### 默认主屏

- 4 列 App 网格；
- 恢复音乐、海龟汤；
- 默认 Widget：今天；
- 4 格 Dock：知间 / 新建角色 / 世界 / 设置；
- Dock 不显示文字标签。

### Widget Catalog V1

1. `greeting` / 今天：日期、时间、问候、世界状态；
2. `companion` / 最近的人：最近角色快捷入口；
3. `world` / 世界状态：世界名、事件状态；
4. `music` / 一起听：音乐 App 快捷入口。

材质：

- `clear`：通透；
- `frosted`：毛玻璃；
- `solid`：实色。

### 数据边界

布局继续放在 `appCustomizations` 的 `__home-appearance__` 记录中：

```text
homeAppKeys[]
dockAppKeys[]
homeWidgetKeys[]
widgetStyle
```

这些字段不参与索引，所以不升级 IndexedDB。Backup V12 已备份 `appCustomizations`，因此布局会随备份保存。

隐藏 App / Widget 只影响 Launcher，不删除真实功能和用户数据。

## 后续可扩展

- 拖拽排序、跨页布局；
- 照片 Widget；
- 纪念日 / 倒计时；
- 角色状态 Widget；
- 当前音乐封面 / 播放控制；
- 日历 / 日程；
- Widget 主题从壁纸自动取色；
- 玩家保存 / 导入桌面主题包。

这些能力应继续归属 Presentation / Launcher 层，不直接改变 Character / Conversation / Memory Runtime。
