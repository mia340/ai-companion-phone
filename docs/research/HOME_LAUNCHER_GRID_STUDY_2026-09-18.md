# Home Launcher Grid Study · 2026-09-18

本轮重点不是“像某个 UI”，而是学习真实移动系统如何定义桌面布局语义。

## Apple Home Screen

Apple 官方文档的关键行为：

- App / Widget 可以移动到同页任意位置或其他主屏页；
- 拖到屏幕右边缘并短暂停留后出现下一页；
- 页面圆点表示页数与当前页；
- 空页面在内容被移走后删除；
- 多页可拥有不同布局。

参考：
- https://support.apple.com/zh-cn/guide/iphone/iphd2fc8ce30/27/ios/27
- https://support.apple.com/en-gb/108307

## Android Home Screen

Android 官方帮助强调：

- App / Shortcut / Widget 都属于 Home Screen item；
- Widget 可以调整尺寸；
- 把 App 拖到右侧可以创建新 Home Screen；
- 页面最后一个项目移走后该页被删除；
- Widget 的尺寸变化会改变它能显示的内容。

参考：
- https://support.google.com/android/answer/9450271
- https://support.google.com/android/answer/15154881

## 对知间 Launcher 的落地

因此 Launcher V5 使用统一 Grid Schema：

```text
Home page = 4 columns × 6 rows
App        = 1×1
Small widget = 2×2
Wide widget  = 4×2
```

每个页面保存内容及 `(x, y, w, h)`，而不是只保存 App 数组顺序。这样可以支持：

- 留白；
- 单 App 独占一页；
- 同页自由排列；
- Widget 与 App 混排；
- 后续 Widget resize / folder / Smart Stack；
- 新页由边缘拖拽自然产生，空页自然回收。

本项目仍保持 local-first：布局是 Presentation State，不改变 Character、Conversation、Memory、WorldBook 等剧情事实。
