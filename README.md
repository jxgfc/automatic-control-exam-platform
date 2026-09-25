# 自动控制原理考研计算平台

直接双击 `index.html` 即可使用，无需安装软件或联网。平台依据浙江工业大学 828、杭州电子科技大学 861 的 2026 年考试大纲建立，共映射 37 条知识点。

## 功能模块

- 建模与变换：结构图串联、并联、正负反馈化简，常用拉氏变换，含复数和重极点的部分分式/反变换，信号流图与梅逊公式
- 时域分析：劳斯判据，一阶/二阶动态指标，高阶系统主导极点近似，给定输入与扰动稳态误差
- 根轨迹：完整复平面分支、渐近线、重心、出射/入射角、分离/汇合点及对应增益
- 频域分析：Bode图、交叉频率、稳定裕度、Nyquist判据、闭环谐振峰值与带宽
- 系统校正：超前、滞后、滞后-超前自动设计，Ziegler-Nichols P/PI/PID 整定
- 离散系统：Jury判据、差分方程响应、常用Z变换、有理式Z反变换、零阶保持状态空间离散化
- 非线性系统：继电、滞环、饱和、死区描述函数与自激振荡数值搜索
- 状态空间：传递函数互转、状态转移矩阵、能控/能观判据、状态反馈、观测器、Lyapunov方程
- 理论自测：30道简述与证明题，按院校和章节筛选，含参考答案与得分关键词
- 智能题库：60道内置题与AI生成题自动并入总题库，可按学校、章节、题型、难度和关键词筛选
- 错题本：保存题目快照、错误/复习次数、错因笔记及待攻克/复习中/已掌握状态，清理AI历史题后仍保留错题
- 掌握分析：通过不会/模糊/掌握自评，按章节、知识点、题型和难度统计掌握率、覆盖率与近期趋势
- 知识树学习：覆盖 828/861 大纲的 37 个知识点，每个节点包含学习目标、核心辨析、公式、标准解题流程、易错点、原创例题和对应工具；学习状态保存在当前浏览器，可从前置知识跳转、进入题库专项练习或打开计算器

## 知识树公开资源

知识树中的外部延伸链接优先使用可公开访问的课程、开放教材和官方技术文档，内容由本项目按考研大纲重新归纳，例题为原创编写：

- [MIT OpenCourseWare · Feedback Systems](https://ocw.mit.edu/courses/6-302-feedback-systems-spring-2007/)
- [LibreTexts · Introduction to Control Systems](https://eng.libretexts.org/Bookshelves/Industrial_and_Systems_Engineering/Introduction_to_Control_Systems_(Iqbal))
- [Python Control Systems Library](https://python-control.readthedocs.io/en/stable/)
- [SciPy Signal 官方文档](https://docs.scipy.org/doc/scipy/reference/signal.html)

顶部可切换 `828`、`861` 或双校全部范围。大纲覆盖页可搜索37条知识点，并直接进入对应计算器或理论题。

## AI出题

离线题库仍可直接双击 `index.html` 使用。需要AI现场出题时，双击：

```text
start-ai.cmd
```

浏览器会打开 `http://127.0.0.1:4173`。在“AI智能题库”中选择 OpenAI、DeepSeek、本机兼容模型或自定义接口，再填写自己的API密钥。

停止服务时直接双击：

```text
stop-ai.cmd
```

它只会停止本机 `4173` 端口上的题库服务；如果服务已经停止，会提示“没有正在监听的服务”并正常退出。

- API密钥仅存在于当前页面输入框和本次代理请求，不会写入项目文件或 `localStorage`
- AI生成题会保存到当前浏览器的“AI历史题库”，最多保留500题
- 登录后生成的 AI 题还会在已配置的 PostgreSQL 云端题库中去重保存，方便多设备查询；错题、掌握度和知识树进度仍保存在当前浏览器。
- 内置题是按考研常见题型编写的原创变式，不复制付费题库原文
- 本机模型默认采用 OpenAI 兼容地址 `http://127.0.0.1:11434/v1`，可按实际软件修改

## 手机、平板与公网访问

如果希望长期运营个人站，而不是依赖自己的电脑开机，参见 [PERSONAL-SITE.md](PERSONAL-SITE.md)。项目已提供 `Dockerfile`、`compose.yaml` 和 `Caddyfile`，可用自己的域名部署并自动启用 HTTPS。

### 同一 Wi-Fi 临时访问

电脑和手机连接同一个 Wi-Fi 后，双击 `start-ai.cmd`。在电脑 PowerShell 执行：

```powershell
ipconfig
```

找到电脑当前网卡的 `IPv4 地址`，例如 `192.168.1.23`，然后在手机或平板浏览器访问：

```text
http://192.168.1.23:4173
```

如果无法访问，需要允许 Node.js 通过 Windows 防火墙的“专用网络”，并确认电脑和移动设备没有连接到不同的 Wi-Fi 隔离网络。临时访问结束后可双击 `stop-ai.cmd`。

### 部署成公网网站

项目已经包含 `package.json` 和 `render.yaml`，可部署到支持 Node.js 的云平台。以 Render 为例：

1. 将整个项目上传到自己的 GitHub 仓库，不要上传 API Key、`.env` 或浏览器导出的题库数据。
2. 登录 Render，选择 **New → Blueprint**，连接该 GitHub 仓库。
3. Render 会读取 `render.yaml`，使用 `npm ci --omit=dev` 构建、使用 `npm start` 启动，并用 `/api/health` 做健康检查。
4. 部署成功后，Render 会提供一个 `https://xxx.onrender.com` 地址，手机、平板和电脑都访问这个地址即可。

云平台必须允许外部端口通过环境变量 `PORT` 注入；本项目已经默认监听 `0.0.0.0`，不再绑定电脑本机回环地址。免费实例可能在一段时间无访问后休眠，第一次打开需要等待几秒唤醒。

公网部署后请注意：这是一个公开网站，任何拿到网址的人都可能调用 AI 出题接口。不要把自己的官方 API Key 写进代码或环境变量，也不要在公共电脑上保存 Key；建议只在页面当前会话中填写中转站令牌，并在使用后清空。

使用中转站时选择“OpenAI兼容中转站”，按中转站控制台填写：

- API地址：通常是中转站提供的 API Base，例如 `https://域名/v1`；也支持完整的 `/chat/completions` 地址
- API密钥：必须使用中转站签发的令牌，不是OpenAI官方密钥
- 模型：必须与中转站模型列表中的名称完全一致
- 接口协议：多数中转站选择 `Chat Completions`
- 鉴权方式：多数选择 `Authorization: Bearer`，少数平台使用 `x-api-key` 或 `api-key`

## 输入格式

传递函数支持因式、括号、整数幂和复数，无需手工展开或通分。例如：

```text
分子：1
分母：s(s+4)(s+1-2j)(s+1+2j)
```

复数可使用 `j` 或 `i`。实系数传递函数中的非实零极点必须共轭成对，程序会自动校验。

矩阵按行用分号或换行分隔，元素用逗号或空格分隔。例如：

```text
0,1;-2,-3
```

信号流图每行输入一条支路：

```text
起点,终点,增益
R,A,1
A,Y,1/(s+1)
Y,A,-2
```

## 测试

安装 Node.js 后可运行：

```powershell
npm ci
node solver.test.js
node control-core.test.js
node advanced-core.test.js
node server.test.js
node formula-render.test.js
npm run check:production
npm run test:browser
```

浏览器自动化测试由开发依赖 Playwright 提供；`ui.smoke.test.js` 检查全平台，`ai-ui.test.js` 使用模拟模型响应验证AI题库，不会消耗真实API额度。当前测试使用本机 Edge，并同时检查桌面与 390px 手机布局。

## GitHub 与 Render 部署

部署维护步骤见 [doc/RENDER-DEPLOYMENT.md](doc/RENDER-DEPLOYMENT.md)。项目根目录已包含 `render.yaml` 和 `package-lock.json`，Render 可使用 `npm ci --omit=dev` 构建、使用 `npm start` 启动，并通过 `/api/health` 检查服务状态。

### 运行配置记录

- 本地默认服务端口：`4173`；可通过 `PORT` 覆盖。
- Render 服务端口：由 Render 注入 `PORT`，程序监听 `0.0.0.0`，不要在平台上固定端口。
- 前端与后端：同一个 Node.js Web 服务，前端静态资源和 `/api/*` 接口均由 `server.js` 提供；不存在独立前端服务端口。
- 数据库：生产环境使用 PostgreSQL 保存账号、会话、激活码和 AI 生成题；内置题、错题、掌握度和知识树进度继续保存在浏览器 `localStorage`，不会自动迁移旧设备记录。
- 环境变量：`NODE_ENV=production` 由 `render.yaml` 设置；Render 还需要配置 `DATABASE_URL`、`QUESTION_BANK_ADMIN_TOKEN`、`ACTIVATION_ADMIN_TOKEN`、`ADMIN_USERNAME` 和 `REQUIRE_ACTIVATION=true`。页面中的 AI API Key 不写入仓库或 Render 环境变量。

学习记录可在首页“学习记录”区域导出为 JSON 备份，也可在新设备导入；备份只包含白名单学习数据，不包含 AI API Key、账号密码或会话令牌。

部署成功后可通过 Render 提供的 `https://<service-name>.onrender.com` 公共地址访问，不依赖同一局域网。
