# AI 续开发交接说明 V0.4.2.11

## 项目目标
这是一个移动端虚拟手机式 AI 陪伴 PWA。核心目标不是通用问答，而是接近 SillyTavern / Tavo / FLAI / 小手机类产品的长期角色扮演体验：角色卡、Persona、世界书、记忆、关系、状态、图片、语音、主动消息与真实手机互动统一在一个持续世界中。

## 当前版本
- 应用版本：0.4.2.11
- IndexedDB：V8
- 备份格式：V7
- Git 仓库通常位于：`D:\ai\ai-companion-phone-git-clean`

## 关键兼容原则
1. 不破坏旧角色、聊天、图片、Persona、世界书、记忆和关系数据。
2. Tavo / SillyTavern Character Card V2/V3 可在创建角色页直接导入。
3. 角色卡内嵌 `character_book` 导入为角色专属世界书。
4. 角色卡内嵌 `{{user}}` 可创建角色专属 Persona，只对绑定角色生效，不污染全局 Persona。
5. 用户 Persona 未明确填写的习惯、偏好、经历必须视为未知；模型不能自行补设定。

## V0.4.2.11 新增
- Persona 头像支持本地图片，不再只能输入 emoji。
- 用户消息的“已读/已发送/失败”显示在自己气泡正下方。
- 新增角色卡自带 UI 协议解析：支持 `{日期|时间}{地点}{内心}{周围}{待办}`。
- UI 字段从聊天正文剥离，渲染为独立状态卡，不再显示代码围栏和花括号。
- UI 状态同步到持续世界状态：地点、剧情时间、内心、待办、presence。
- 同场景自动识别增强：角色与用户存在直接现实动作接触时优先判定 together；部分社区卡中的“周围:独处”不再覆盖明确的面对面动作。
- 同场景：scene_action 以中文括号并入同一个剧情气泡；远程：scene_action 独立 Action。
- 旧聊天若已有原始 UI 代码块，会在打开聊天时自动解析并回写，不要求重建角色。
- 角色卡存在独立剧情 UI 时间线时，剧情日期按原卡推进，不被设备当前年份强行覆盖。

## 核心文件
- `src/views/ChatRoom.vue`：聊天主流程、生成、流式、消息落库、旧 UI 自动迁移。
- `src/components/chat/ChatMessageItem.vue`：气泡、已读位置、角色卡 UI 状态卡、Action。
- `src/services/interactionProtocol.ts`：多气泡 / scene_action / 状态协议解析。
- `src/services/roleCardUiService.ts`：角色卡 UI 解析、同场景判断与状态映射。
- `src/services/promptComposer.ts`：角色扮演 Prompt 与角色卡 UI 输出约束。
- `src/views/PersonaManagerView.vue`：Persona JSON/TXT 导入、编辑、本地图片头像。
- `src/views/CharacterCreate.vue`：角色卡直接导入、内嵌 user Persona、首条消息 UI 解析。

## 用户明确想要的表现
### 在身边
动作直接以括号显示在剧情气泡里，多句对白和动作可以同一个气泡：
`（他翻过身，把你搂进怀里）我也没睡着。想我了？`

### 不在身边
角色动作仍可被玩家看到，但使用独立 Action；对白才是一句一个手机气泡。

### 角色卡自带 UI
若角色卡要求每次回复附带：
`{日期:|时间:}`、`{地点:}`、`{内心:}`、`{周围:}`、`{待办:}`，必须尊重原卡协议并解析为 UI，不能把原始代码直接塞进气泡。

## 下一步建议
先实测 V0.4.2.11：Persona 图片头像、旧消息 UI 迁移、同场景识别、每轮 UI 解析。稳定后可进入 V0.5.0 Companion OS 底座：应用注册、跨应用事件、工具调用、虚拟钱包/订单、通知与游戏入口。

## 新对话执行指令
先阅读本文件，再检查最新项目 ZIP。不要只规划；直接在最新代码上继续开发，保留旧数据兼容，完成代码、检查、版本文档、干净 ZIP 和新版交接说明。最终生产构建以用户 Windows 上的 `npm run build` 为准；如果用户贴出构建错误，优先修到构建通过。
