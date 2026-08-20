# 个人站部署指南

当前项目已经可以作为个人站运行。它不是纯静态网页，因为 AI 题库需要 Node.js 后端代理；因此个人站应同时部署前端和 `server.js`。

## 推荐架构

```text
手机 / 平板 / 电脑
          ↓ HTTPS
你的域名 → Caddy（自动证书） → Node.js 应用 → AI 中转站或模型服务
```

## 准备工作

1. 一台能安装 Docker 的云服务器，建议至少 1 核 2 GB 内存。
2. 一个域名，例如 `study.example.com`。
3. 把域名的 DNS `A` 记录指向云服务器公网 IPv4。
4. 云服务器防火墙放行 TCP `80` 和 `443`。

## 部署步骤

把整个项目上传到服务器，然后在项目目录执行：

```bash
cp Caddyfile Caddyfile.backup
sed -i 's/study.example.com/study.你的域名.com/' Caddyfile
docker compose up -d --build
```

将 `study.你的域名.com` 替换为真实域名。Caddy 会自动申请 HTTPS 证书，成功后直接访问：

```text
https://study.你的域名.com
```

查看运行状态：

```bash
docker compose ps
docker compose logs -f app
```

更新代码后重新构建：

```bash
docker compose up -d --build
```

停止个人站：

```bash
docker compose down
```

## 不使用 Docker 的运行方式

服务器安装 Node.js 18 或更高版本后，在项目目录执行：

```bash
npm install
HOST=0.0.0.0 PORT=4173 npm start
```

生产环境建议使用 Docker 或 systemd，避免 SSH 断开后进程退出。

## 安全注意事项

- 不要把 API Key 写进代码、GitHub 仓库、Dockerfile 或 `.env` 并提交到公开仓库。
- 页面输入的 API Key 只用于当前请求，项目不会保存它。
- 公网部署后任何拿到网址的人都能访问页面；如果只想自己使用，建议在 Caddy 前增加 Cloudflare Access 或 Basic Auth。
- 服务器只需要开放 `80/443`，不要把 `4173` 暴露到公网。
- 定期更新 Docker、Node.js 和云服务器系统。

## 个人主页配置

网站现在默认先打开个人主页，再进入自动控制学习平台。主页的站点名、简介、头像和链接集中放在 `site-profile.js`，修改这里即可更新首页，不需要改 HTML 结构：

```js
window.ControlSiteProfile = {
  name: "你的站点名称",
  shortName: "导航栏短名称",
  role: "一句话介绍",
  bio: "个人简介",
  location: "所在地或学习方向",
  avatar: "头像图片地址",
  links: [
    { label: "GitHub", href: "https://github.com/你的账号" }
  ]
};
```

首页使用现有计算器截图作为 Banner 中的产品预览，并提供根轨迹、知识树、题库、频域分析四个入口。所有学习数据仍保存在浏览器本地；部署到公网时，建议在 Caddy 或 Cloudflare Access 后增加登录保护。
