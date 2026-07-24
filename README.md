# 虚拟手机 · AI 陪伴世界

V0 工程骨架：Vue 3 + TypeScript + Vite + Pinia + Vue Router + Dexie + PWA。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址。手机测试时，电脑和 iPhone 连接同一 Wi-Fi，并用 `npm run dev -- --host 0.0.0.0`。

## 已完成

- 粉色可爱风手机外壳、锁屏、桌面、状态栏和返回逻辑
- PWA manifest 与 service worker
- IndexedDB 数据库与初始演示数据
- 消息列表、单聊、本地模拟 AI 回复
- 通讯录多分组展示
- 快速创建角色，刷新后数据保留
- 设置、关于和其他 App 占位页
- AI Provider Adapter 接口，未绑定具体模型供应商

## 下一开发阶段

1. 完成 V0 视觉和 iPhone PWA 安装测试
2. 加入高级创建角色、角色档案详情与外观设置
3. 加入 OpenAI 风格接口适配器和模型设置
4. 扩展完整 Dexie schema、备份导入导出
5. 实现四层记忆、权限隔离与世界补算
