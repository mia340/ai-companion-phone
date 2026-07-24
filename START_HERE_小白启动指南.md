# 从这里开始

## 1. 安装 Node.js
安装 Node.js 20 或更高版本。

## 2. 用 VS Code 打开项目文件夹
打开 `ai-companion-phone` 文件夹，而不是只打开某一个文件。

## 3. 打开 VS Code 终端
菜单：终端 → 新建终端。

## 4. 第一次运行
依次输入：

```bash
npm install
npm run dev
```

终端会显示类似 `http://localhost:5173` 的地址，按住 Ctrl 点击打开。

## 5. 在 iPhone 上测试
电脑与 iPhone 连接同一个 Wi-Fi，然后运行：

```bash
npm run dev -- --host 0.0.0.0
```

用 iPhone Safari 打开终端显示的局域网地址。正式部署到 HTTPS 后，才建议测试“添加到主屏幕”。

## 当前版本说明
这是 V0 工程骨架，AI 回复暂时使用本地模拟器，不消耗 API。下一阶段再添加真实模型配置。
