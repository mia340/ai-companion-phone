# 朋友圈 UI 与封面（alpha.5.1.1）

- `/app/朋友圈`：动态流与横幅；右上角铃铛进 `/app/朋友圈/notifications`，省略号进 `/app/朋友圈/settings`。
- `/app/朋友圈/settings`：整体活跃开关、互动热度、好友列表；选择好友进 `/app/朋友圈/settings/character/:id` 管理权限。
- 通知页链接使用路由 query `moment`，朋友圈页面在对应动态就绪后滚动定位，不把用户评论转存一份。
- 封面文件只接受 JPG/PNG/WebP；经 imageService 的图片处理，写入前严格校验 data URL 的 MIME 与 2 MB 上限；不用远端 URL 或 SVG；失败时展示错误，不覆盖旧封面。
- 自定义封面存于 `appCustomizations` 的独立键 `worldId:__moments-cover__`，与主屏幕壁纸、App 图标隔离；沿用 Backup V12。初版为每个世界一张封面，不宣称每个 Persona 都有独立封面。
- Web/PWA 仍遵守系统挂起限制，未修改后台执行语义。
