# 虚拟手机 · AI 陪伴世界

V0.1.0 可交互原型：Vue 3 + TypeScript + Vite + Pinia + Vue Router + Dexie + PWA。

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
- 本地 Mock、DeepSeek 与 OpenAI 兼容 Provider
- API 设置、模型列表拉取、模型下拉选择和连接测试

## 下一开发阶段

1. 增加流式回复与停止生成
2. 控制最近上下文长度
3. 建立基础短期记忆
4. 增加 API 调用日志和消耗统计
5. 继续扩展关系、情绪和世界系统
