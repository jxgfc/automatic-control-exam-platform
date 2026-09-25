# GitHub 与 Render 部署说明

本文记录本项目部署到 GitHub 和 Render 的可复现步骤。项目是一个 Node.js Web 服务，前端静态文件与 AI 代理由同一个 `server.js` 提供。

## 部署前检查

- Node.js 18 或更高版本。
- Git 已安装，并已准备一个 GitHub 仓库地址。
- 不要将 API Key、`.env`、浏览器导出的题库数据提交到仓库。
- `package-lock.json` 必须与 `package.json` 一起提交。Render 的构建命令使用 `npm ci --omit=dev`。
- `vendor/katex/node_modules/katex/dist/` 是运行时需要的本地数学渲染资源，不要从 Git 提交中删除。

在项目根目录运行本地检查：

```powershell
npm ci
npm test
npm run check:production
```

`npm run check:production` 会启动临时生产服务并检查健康接口、首页、CSS、KaTeX 资源和无密钥 API 错误响应，不会调用真实 AI 服务。

## 推送到 GitHub

在项目根目录执行。将示例远程地址替换成实际仓库地址：

```powershell
git remote add origin https://github.com/<owner>/<repository>.git
git branch -M main
git add .
git commit -m "Prepare deployment"
git push -u origin main
```

如果本地仓库已经有 `origin`，先检查：

```powershell
git remote -v
git status
```

本次检查不会访问 GitHub，也不会执行上述推送命令；这些命令仅供部署者在确认仓库地址和提交内容后手动执行。

不要在公开仓库中设置或提交 API Key。AI 页面中的密钥只随当前请求发送给上游服务，不写入项目文件或浏览器 `localStorage`。

## Render 配置

推荐使用 Render 的 **New → Blueprint**，选择刚刚推送的仓库。仓库根目录中的 `render.yaml` 已包含以下配置：

| 配置项 | 值 |
|---|---|
| 服务类型 | Web Service |
| 运行时 | Node |
| 构建命令 | `npm ci --omit=dev` |
| 启动命令 | `npm start` |
| 健康检查路径 | `/api/health` |
| 环境变量 | `NODE_ENV=production`、`DATABASE_URL`、`QUESTION_BANK_ADMIN_TOKEN`、`ACTIVATION_ADMIN_TOKEN`、`ADMIN_USERNAME`、`REQUIRE_ACTIVATION=true` |

也可以在 Render 控制台手动创建 Web Service，并填写相同配置。不要把端口固定为 `4173` 或 `10000`：Render 会通过 `PORT` 环境变量注入端口，服务已经监听 `0.0.0.0` 并读取该变量。

部署完成后，Render 会提供类似下面的公共地址：

```text
https://<service-name>.onrender.com
```

免费实例长时间无访问时可能休眠，首次访问会等待实例唤醒。该等待不代表局域网依赖。

## 部署后验证

将 `<service-url>` 替换为 Render 控制台显示的完整 HTTPS 地址：

```powershell
Invoke-RestMethod https://<service-url>/api/health
Invoke-WebRequest https://<service-url>/ -UseBasicParsing
Invoke-WebRequest https://<service-url>/styles.css -UseBasicParsing
```

预期结果：

- `/api/health` 返回 `ok: true` 和 `aiProxy: true`。
- `/` 返回包含“自动控制原理考研计算平台”的 HTML。
- `/styles.css` 返回 HTTP 200。
- 浏览器可以直接打开 Render 公共 URL，页面功能不再依赖 `127.0.0.1` 或同一 Wi-Fi。

AI 题库的真实生成仍需要用户在页面中填写可用的上游 API 地址、模型和令牌。不要把个人令牌设置为 Render 服务环境变量，也不要将其写入 `render.yaml`。登录后生成的题目会在本次请求中写入 PostgreSQL 并返回同步结果；数据库不可用时页面仍会保留本地 AI 历史并明确提示云端同步状态。

## 故障排查

1. `npm ci` 报缺少 lockfile：确认仓库包含根目录 `package-lock.json`，并重新推送。
2. 服务启动后健康检查失败：检查 Render 日志中是否执行了 `npm start`，以及是否有代码自行覆盖 `PORT`。本项目不应固定 Render 端口。
3. 首页能打开但公式不显示：确认 `vendor/katex/node_modules/katex/dist/` 已提交，且 KaTeX 资源请求返回 200。
4. AI 请求失败：先用 `/api/health` 判断服务本身正常，再检查上游地址、模型权限、令牌和额度。Render 不需要也不应保存页面 API Key。
5. Render 部署成功但首次打开较慢：免费实例的休眠唤醒属于平台行为，可通过升级实例或定期访问降低影响。
