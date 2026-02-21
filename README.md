[README.md](https://github.com/user-attachments/files/25455013/README.md)
# ShanY 手柄控制工具

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v16+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/Socket.io-v4+-black.svg" alt="Socket.io">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
</p>

<p align="center">
  <b>Web端 Xbox 手柄本地/远程震动控制终端</b>
</p>

<p align="center">
  <a href="https://shany.cc/" target="_blank">作者官网</a> •
  <a href="https://blog.shany.cc/archives/shany-control" target="_blank">使用教程</a>
</p>

---

## 📖 项目介绍

ShanY 手柄控制工具是一个基于 Web 的 Xbox 手柄震动控制平台，支持本地控制和远程控制两种模式。

### ✨ 主要功能

- **本地控制**：直接连接 Xbox 手柄，通过网页控制手柄震动
- **远程控制**：创建/加入房间，远程控制其他用户的手柄
- **弹性模式**：松开滑块自动回弹停止，适合脉冲式按摩
- **非弹性模式**：保持当前强度持续震动
- **左右马达独立控制**：可分别控制左右马达的震动强度
- **一键最大/停止**：快速切换最大震动或完全停止

### 🎮 适用场景

- 手柄按摩放松
- 远程互动体验
- 手柄功能测试
- 游戏外设控制

---

## 🚀 快速开始

### 环境要求

- Node.js v16 或更高版本
- 支持 Web Gamepad API 的浏览器（Chrome、Edge、Firefox 等）
- **注意**：手机浏览器无法使蓝牙连接的手柄震动，请使用电脑浏览器

### 本地运行

```bash
# 克隆项目
git clone https://github.com/yourusername/shany-controller.git
cd shany-controller

# 安装依赖
npm install

# 启动服务
npm start
```

访问 `http://localhost:3000` 即可使用。

---

## 🖥️ 宝塔面板部署教程

### 第一步：准备环境

1. 登录宝塔面板
2. 进入 **软件商店** → 搜索 **Node.js** → 安装 **Node.js版本管理器**
3. 打开 Node.js 版本管理器，安装一个稳定版本（推荐 v16 或 v18），并设为默认

### 第二步：上传文件

1. 进入 **文件**，在 `/www/wwwroot` 下新建文件夹 `shany-controller`
2. 进入该文件夹，将项目文件上传：
   - `package.json`
   - `server.js`
3. 新建文件夹 `public`，进入 `public`，上传：
   - `index.html`
   - `style.css`
   - `script.js`

### 第三步：安装依赖与启动

1. 在宝塔文件界面，点击 `shany-controller` 文件夹上的 **终端** 按钮（或通过 SSH 进入该目录）
2. 输入以下命令安装依赖：

```bash
npm install
```

3. 测试运行（可选）：

```bash
node server.js
```

如果没有报错，按 `Ctrl+C` 停止。

### 第四步：添加 Node 项目

1. 进入 **网站** → **Node项目** → **添加Node项目**
2. 配置项目：
   - **项目目录**：选择 `/www/wwwroot/shany-controller`
   - **启动选项**：`start`（对应 package.json 中的启动命令）
   - **项目端口**：`3000`（如果 server.js 里修改了就填修改后的端口）
   - **绑定域名**：填写你的域名（例如 `gamepad.yourdomain.com`）。如果没有域名，暂时先不填，后面用 IP+端口访问
3. 点击提交

### 第五步：开启 SSL（⚠️ 至关重要！）

**注意**：Web Gamepad API 出于安全策略，必须在 HTTPS 下才能连接手柄（除了 localhost）。

1. 在 Node 项目列表中，找到刚才创建的项目，点击 **设置**
2. 点击 **SSL** 菜单 → **Let's Encrypt**
3. 申请并开启 SSL 证书
4. 开启 **强制 HTTPS**

---

## 📁 项目结构

```
shany-controller/
├── public/
│   ├── index.html      # 前端页面
│   ├── style.css       # 样式文件
│   └── script.js       # 前端逻辑
├── server.js           # 服务端入口
├── package.json        # 项目配置
└── README.md           # 项目说明
```

---

## 🔧 技术栈

- **后端**：Node.js + Express + Socket.io
- **前端**：HTML5 + CSS3 + JavaScript
- **API**：Web Gamepad API
- **实时通信**：Socket.io

---

## 📝 使用说明

### 本地控制

1. 使用 USB 或蓝牙连接 Xbox 手柄到电脑
2. 按下手柄任意按键激活连接
3. 拖动滑块控制左右马达震动强度
4. 开启弹性模式后，松开滑块自动停止

### 远程控制

1. 创建房间或加入已有房间
2. 房间支持密码保护和公开/私密设置
3. 房主可以控制访客的手柄
4. 房间在只剩1人时10分钟后自动关闭

---

## ⚠️ 注意事项

1. **浏览器兼容性**：请使用 Chrome、Edge 或 Firefox 等现代浏览器
2. **HTTPS 要求**：除 localhost 外，必须使用 HTTPS 才能连接手柄
3. **手机限制**：手机浏览器无法使蓝牙连接的手柄震动
4. **索尼手柄**：可通过软件转换为 Xbox 手柄实现震动控制

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

---

## 📄 开源协议

本项目基于 [MIT](LICENSE) 协议开源。

---

## 👤 作者

- **ShanY** - [个人网站](https://shany.cc/)
- 博客：[https://blog.shany.cc](https://blog.shany.cc)

---

<p align="center">
  如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！
</p>
