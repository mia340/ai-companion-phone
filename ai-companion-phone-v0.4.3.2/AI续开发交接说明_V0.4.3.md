# AI 续开发交接说明 V0.4.3

## 当前基线

- 应用：AI Companion Phone / 草莓云世界
- 当前版本：0.4.3
- IndexedDB：V9
- 备份格式：V8
- 技术栈：Vue 3 + TypeScript + Vite + Vue Router + Dexie / IndexedDB + PWA

## 产品方向

这是一个“AI 角色 + 虚拟手机 + 长期关系 + 可导入社区角色资源”的本地优先陪伴应用。核心目标不是普通 AI 助手，而是让角色在长期聊天、剧情现场、远程手机聊天和未来各类 Companion OS App 中保持角色一致性、记忆连续性和真实生活感。

用户明确希望兼容 Tavo / SillyTavern 社区生态：角色卡、世界书、用户 Persona、Prompt 预设、正则和 UI，尽量保留原作者玩法，但不能为了兼容而执行不可信第三方 JavaScript。

## V0.4.3 新增架构

### 世界与资源中心

桌面 `✨ 世界` → `/world`，包含：世界书 / 世界状态 / 预设 / 正则 / 资源库。

核心页面：`src/views/WorldCenterView.vue`

### 数据库资源表

V9 新增：

- `lorebooks`
- `promptPresets`
- `regexScripts`
- `resourceBindings`

`lorebookEntries` 新增 `lorebookId` 索引。旧散装条目没有 `lorebookId`，继续按旧逻辑生效。

### 关键服务

- `resourceImportService.ts`：识别/解析社区世界书、Preset、Regex，支持正则 ZIP。
- `communityResourceService.ts`：资源入库、删除和绑定。
- `resourceBindingService.ts`：角色资源组合。
- `lorebookService.ts`：Lorebook 运行时与旧数据兼容。
- `presetRuntime.ts`：基础 Prompt Order 运行时。
- `regexRuntime.ts`：User Input / AI Response / World Info / Prompt 正则管线。
- `SafeRichHtml.vue`：隔离 HTML/CSS UI，阻止脚本和事件属性。

### 角色卡导入

`characterCardImportService.ts` 继续支持 V2/V3，并新增：

- 内嵌 character_book 高保真字段保留。
- 内嵌 regex_scripts 导入。
- cardVersion 记录 V2/V3。
- 卡内 {{user}} → 角色专属 Persona。

`CharacterCreate.vue` 创建角色时会建立角色专属 Lorebook / Regex 资源和绑定，并让首条消息先经过内嵌 AI Response 正则。

### Rich UI

Message 新增：

- `type: rich`
- `rawContent`
- `richHtml`
- `richSource`

Rich UI 使用 `SafeRichHtml.vue` 渲染。聊天历史进入 Prompt 时优先使用 `rawContent`，不要把 HTML 渲染结果当剧情原始记录。

### 场景 UI

`roleCardUiService.ts`：

- 原 `{日期}{时间}{地点}{内心}{周围}{待办}` 继续支持。
- `extractRoleCardUiHints()` 支持常见 `时间 | ... / 地点 | ... / 心声 | ...` 状态头，并且不从正文移除，保证社区正则仍能匹配。
- 直接身体接触等强信号可辅助推断 `together`。

## 已验证样本

开发过程中使用用户提供的社区样本做兼容验证：

- 炫饭鼠小手机 V2：内嵌世界书 28 条，可识别 HTML/CSS/details UI。
- 言执叙 V3：内嵌世界书 39 条、内嵌正则 4 条；第一条状态正则可把原始状态块转换成 Rich HTML。
- 用户提供资源合集：可识别 31 张角色卡、10 个世界书、7 个预设；独立正则 ZIP 可提取正则 JSON。

## 安全原则

第三方 UI：允许安全 HTML/CSS、图片、details/summary；禁止 script、iframe、event handlers、javascript: 等主动代码。未来增加更多交互时，应通过本 App 的 Action API，而不是开放任意脚本权限。

## 当前限制

1. 当前执行环境没有成功完成 npm 依赖安装，所以最终 `vue-tsc -b && vite build` 必须在用户 Windows 仓库验证。
2. Preset 运行时目前是基础兼容，不等价于 SillyTavern 所有 in-chat depth / marker / provider 参数。
3. Lorebook sticky/cooldown/delay/递归为保留字段或近似实现，后续可继续完善。
4. PNG 角色卡嵌入 metadata 和资产包自动导入尚未实现。
5. 不支持执行第三方 JavaScript，这是安全边界而非 bug。

## 建议下一步

先让用户实机验证 V0.4.3：

1. 打开“世界”确认五个页签。
2. 导入独立世界书并绑定角色。
3. 导入一个 Tavo Preset 并绑定。
4. 导入正则 JSON/ZIP。
5. 新建“言执叙”一类内嵌正则角色卡，确认首条 UI 渲染。
6. 给普通角色绑定“炫饭鼠的小手机”世界书，测试红包/音乐/位置等 HTML/CSS 输出。
7. 测试禁用某个角色专属世界书/正则后是否真正停止生效。
8. 导出 V8 备份并恢复。

稳定后建议 V0.4.3.1：完善 Preset Prompt Manager、Regex 编辑/排序/作用范围 UI、Lorebook sticky/cooldown 状态机、资源依赖与兼容报告细化。
