# Companion Avatar / 穿搭 V1

版本：`0.5.0-alpha.5.9.0`
状态：V1 Alpha

## 1. 目标

穿搭不再是心跳飞行棋内部的一次性皮肤，而是独立 App 和共享角色视觉基础设施。用户自己与每一个角色都拥有独立的 Avatar Appearance Profile；同一套形象可以被心跳飞行棋和后续支持小人的小游戏直接复用。

## 2. 独立「穿搭」App

桌面新增「穿搭」入口 `/app/穿搭`。进入后可以横向选择「我」或任意角色，每个目标分别保存自己的形象和多套穿搭。当前版本提供女生 / 男生两套 Q 版像素骨架，并按版型切换可选发型、上装和下装。

可编辑内容包括：肤色、发型、发色、上装、上装颜色、下装、下装颜色、配饰、穿搭分类和套装名称。每个角色可以保存多套造型，并指定当前激活套装。

## 3. 数据边界

穿搭数据复用 `appCustomizations` 的非索引 `wardrobeState` 字段，因此 IndexedDB 仍保持 V18，不新增表。状态按 `worldId:__wardrobe__` 独立保存。

`wardrobeState.version = 1`，内部以 target id 保存 profile：

- `self`：用户自己。
- `<characterId>`：具体角色。

换装只影响视觉表现，不改变角色卡、人格、关系阶段、Memory 或 Shared Timeline。

## 4. Shared Avatar Runtime

公共组件位于 `src/components/avatar/CompanionPixelAvatar.vue`，不属于 Couple Board 私有目录。`avatarWardrobeService.ts` 负责 profile、套装、男女版型和最终视觉 look 的统一解析。

心跳飞行棋只读取当前激活 profile，并把它交给共享 Avatar Runtime；后续房间、散步、约会、双人养成等小游戏可以复用同一接口。

## 5. 心跳飞行棋 V2.3 接入

Couple Board V2.3 的像素小人已经改为共享 Avatar Runtime：

- 用户棋子读取 `self` 的当前穿搭。
- 角色棋子读取该角色 id 的当前穿搭。
- 地图中的小人不再显示重复姓名标签。
- 开局页增加「设计我和 TA 的小人穿搭」入口。
- 地图继续遵守 Board Stop 只是游戏舞台、不是现实地点或 Memory 事实的规则。

## 6. 地图与一屏布局

V2.3 进一步压缩顶部 HUD，地图区域扩大，Board Stop 大黑条改为小型悬浮信息牌。题目出现后仍然保持上半地图、下半互动的固定连续布局，页面本身不反复展开/收起；长对话只在互动区内部滚动。

地图视觉增加夜空、河流、城市/公园分区、路线和地点层级，小人尺寸也提升，以便穿搭真正可见。

## 7. 后续扩展

V1 的数据结构已经预留多套 Outfit 和共享 Avatar Runtime。后续可以继续增加更多服饰资源、季节套装、房间动作、双人动作与其他小游戏接入，而无需复制每个游戏自己的角色外观数据。
