# Docker 部署优化技术方案与分析文档

## 1. 应用现状与容器化适配性分析摘要

这是一套**零 npm 依赖的纯 Node.js HTTP 服务器**——全部用 `node:http`、`node:fs`、`node:path` 硬撸了一个 557 行的单文件后端，连 `express` 都没装。前端靠 `vendor/katex/` 目录下的本地 KaTeX 资源撑场。这个架构天然适合容器化，Dockerfile 只要能跑 `node server.js` 就完事，但当前配置把这个"轻"字的优势挥霍得差不多了。

### 1.1 当前文件状态

| 文件 | 行数 | 现状 |
|------|------|------|
| `Dockerfile` | 12 | 单阶段构建，`npm install --omit=dev`（虽然无依赖），以 root 运行，无 HEALTHCHECK |
| `compose.yaml` | 27 | 双服务（app + caddy），有 restart 策略，无健康检查、无资源限制、无日志轮转、无网络隔离 |
| `Caddyfile` | 5 | 硬编码占位域名 `study.example.com`，仅 gzip + 反向代理，无安全头部 |
| `.dockerignore` | — | **不存在** |
| `package.json` | 14 | 零 dependencies 字段，test 脚本串行跑 5 个测试文件 |
| `server.js` | 557 | 纯 Node.js，`/api/health` 端点已就绪（第 512 行），监听 `process.env.PORT`，默认 4173 |

### 1.2 容器化适配性判定

| 维度 | 评估 | 说明 |
|------|------|------|
| **镜像构建** | ⚠️ 需优化 | 无 `.dockerignore`，16 个 PNG 截图（~5MB）和 9 个测试文件全部进入 build context |
| **运行时安全** | ⚠️ 需加固 | 全程 root 运行，无用户隔离 |
| **编排稳定性** | ⚠️ 需补充 | 无 healthcheck，Caddy 等不到 app 就绪就开干，可能返回 502 |
| **可观测性** | ⚠️ 需增强 | 无日志轮转，无资源限制，磁盘和内存出问题只能祈祷 |
| **网络隔离** | ⚠️ 需改善 | 默认 bridge 网络，app 端口未显式隔离 |

---

## 2. 具体优化措施清单及实施说明

### 2.1 创建 `.dockerignore`（P0 — 立即执行，零风险）

**问题**：项目有 16 个 PNG 截图（`*.png`）、9 个测试文件（`*.test.js`）、`Caddyfile`、`render.yaml` 等，全部随 `COPY . .` 进入镜像。vendor/katex 内含完整 `node_modules` 目录（约 4.5MB），虽然运行时需要，但测试文件和截图纯粹是浪费。

**创建 `.dockerignore`**：

```dockerignore
# 测试文件（运行时不需要）
*.test.js

# README 截图（仅文档展示用，共 16 个 PNG）
*.png

# 部署/开发配置（容器内不使用）
Caddyfile
render.yaml
.dockerignore
README*.md
LICENSE

# 版本控制
.git
```

**预期效果**：build context 减小约 5-6MB，构建速度提升，镜像体积同步缩小。

> **注意**：`vendor/katex/` 目录必须保留在镜像中——前端 `index.html` 直接引用了 `vendor/katex/node_modules/katex/dist/katex.min.js` 和 `katex.min.css`。不要在 `.dockerignore` 中排除 `vendor/`。

---

### 2.2 Dockerfile 多阶段构建 + 非 root 用户 + HEALTHCHECK（P0）

**问题**：
1. 当前 12 行 Dockerfile 以 root 身份运行进程，违反最小权限原则
2. 无 HEALTHCHECK 指令，Docker 和 Compose 无法判断应用是否真正就绪
3. `COPY . .` 在 `npm install` 之后（虽然本项目无依赖，但作为模板应规范层缓存顺序）

**优化后的 Dockerfile**：

```dockerfile
# ---- 运行阶段 ----
FROM node:20-alpine

# 安全加固：创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# 层缓存优化：先复制 package.json（本项目无依赖，但保持最佳实践）
COPY package.json ./
RUN npm install --omit=dev

# 复制应用代码（.dockerignore 已排除测试文件和截图）
COPY server.js index.html styles.css ./
COPY vendor/ vendor/

# 切换到非 root 用户
USER appuser

EXPOSE 4173

# 健康检查：利用已有的 /api/health 端点
# Alpine 自带 busybox wget，--spider 模式不下载内容
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4173/api/health || exit 1

CMD ["npm", "start"]
```

**关键改进点**：
| 改进项 | 说明 |
|--------|------|
| **非 root 用户** | `adduser -S appuser` 创建系统用户，容器逃逸时无法直接获得 root 权限 |
| **HEALTHCHECK** | 利用 `/api/health` 端点（返回 `{ ok: true, aiProxy: true }`），Compose 可据此判断服务就绪 |
| **COPY 精确化** | 显式列出 `server.js`、`index.html`、`styles.css` 和 `vendor/`，避免意外文件进入镜像 |
| **busybox wget** | Alpine 自带，无需额外安装 curl，healthcheck 命令轻量 |

---

### 2.3 compose.yaml 增强编排配置（P1）

**问题**：
1. Caddy `depends_on: app` 仅等容器启动，不等应用就绪——可能转发请求到尚未监听端口的 app
2. 无资源限制——单个容器可能耗尽宿主机内存
3. 无日志轮转——长时间运行后磁盘可能被撑满
4. 无网络隔离——app 端口通过 bridge 网络暴露

**优化后的 compose.yaml**：

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 4173
    expose:
      - "4173"
    # 健康检查（与 Dockerfile HEALTHCHECK 互补）
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:4173/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
    # 日志轮转
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - web

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - web

volumes:
  caddy_data:
  caddy_config:

networks:
  web:
    driver: bridge
```

**改进清单**：

| 维度 | 改进项 | 效果 |
|------|--------|------|
| **启动顺序** | `depends_on: condition: service_healthy` | Caddy 等 app 健康后再启动，避免 502 |
| **资源控制** | `deploy.resources.limits` | 防止单容器 OOM 影响宿主机 |
| **日志管理** | `logging: json-file` + 轮转 | 每容器最多 30MB 日志，不会撑爆磁盘 |
| **网络隔离** | `networks: web` | app 不暴露端口到宿主机，仅 caddy 可达 |
| **Caddy 只读** | `Caddyfile:ro` 挂载 | 防止容器内意外修改配置 |

---

### 2.4 Caddyfile 安全加固（P1）

**问题**：当前 Caddyfile 仅 5 行，硬编码占位域名，无安全头部，无超时配置。

**优化后的 Caddyfile**：

```caddyfile
# 支持环境变量覆盖域名，部署时设置 DOMAIN 环境变量即可
{$DOMAIN:study.example.com} {
    # 压缩
    encode gzip zstd

    # 安全头部
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }

    # HSTS（仅在启用 HTTPS 后生效）
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"

    # 反向代理到应用
    reverse_proxy app:4173 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {header.X-Forwarded-For}
    }

    # 日志
    log {
        output file /data/access.log {
            roll_size 10MB
            roll_keep 3
        }
    }
}
```

compose.yaml 中对应添加：
```yaml
environment:
  DOMAIN: ${DOMAIN:-study.example.com}
```

部署时只需：`DOMAIN=mysite.com docker compose up -d`

---

### 2.5 显式指定镜像版本（P2）

**当前状态**：`FROM node:20-alpine` 会随时间拉取不同的 `20.x.y` 补丁版本，构建不可复现。

**建议**：锁定到具体补丁版本，例如 `FROM node:20.18.3-alpine3.20`，定期更新。这是锦上添花，优先级低于上述 4 项。

---

## 3. 预期的收益评估

| 指标 | 优化前 | 优化后（预期） | 改善幅度 |
|------|--------|---------------|----------|
| **构建上下文大小** | ~15-20MB（含 16 个 PNG + 9 个测试文件） | ~8-10MB（仅运行时文件） | 减小 40-50% |
| **镜像体积** | 较大（含测试文件、截图、root 进程） | 较小（精确 COPY + 非 root） | 减小 20-30% |
| **构建速度** | 较慢（传输无用文件） | 较快（上下文精简） | 提升 30-60% |
| **启动可靠性** | 依赖 Caddy 健康检查（未配置） | Compose 等待 app healthy 后再启动 Caddy | 502 概率趋近于零 |
| **安全评分** | root 运行，无安全头部 | 非 root + 安全头部 + 网络隔离 | 显著提升 |
| **运维可观测性** | 日志无限增长，无资源限制 | 日志轮转 + 资源上限 | 磁盘和内存可控 |
| **CI/CD 就绪度** | 无 `.dockerignore`，构建不可复现 | 可复现构建 + 轻量 context | 可直接接入流水线 |

---

## 4. 推荐的验证与测试方法

### 4.1 基线测量（优化前）

```bash
# 1. 记录当前镜像体积
docker build -t app:baseline .
docker images app:baseline --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# 2. 记录构建耗时
time docker build -t app:baseline .

# 3. 运行全部测试套件（确认基线功能正常）
docker run --rm app:baseline npm test
```

### 4.2 优化后验证

```bash
# 1. 构建优化后镜像
docker build -t app:optimized .

# 2. 对比镜像体积
docker images app:optimized --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# 3. 验证非 root 用户
docker run --rm app:optimized whoami
# 预期输出：appuser

# 4. 验证健康检查
docker compose up -d
sleep 15
docker compose ps
# 预期：app 状态为 healthy

# 5. 验证健康端点
docker compose exec app wget -qO- http://localhost:4173/api/health
# 预期返回：{"ok":true,"aiProxy":true}

# 6. 运行完整回归测试
docker run --rm app:optimized npm test

# 7. 验证资源限制
docker stats --no-stream <app_container_id>
# 预期：内存 < 128MB，CPU < 10%
```

### 4.3 功能验收检查清单

| 验收项 | 验证方法 | 通过标准 |
|--------|----------|----------|
| 首页加载 | `curl -s http://localhost/ \| grep "自动控制"` | 返回 HTML 内容 |
| 健康端点 | `curl http://localhost/api/health` | 返回 `{"ok":true,"aiProxy":true}` |
| 静态资源 | `curl -s -o /dev/null -w "%{http_code}" http://localhost/styles.css` | 返回 200 |
| KaTeX 资源 | `curl -s -o /dev/null -w "%{http_code}" http://localhost/vendor/katex/node_modules/katex/dist/katex.min.js` | 返回 200 |
| AI API 代理 | 构造 POST 请求到 `/api/ai/questions` | 返回 JSON 响应（可能因无 API key 返回错误，但不应 500） |
| Caddy 代理 | `curl -H "Host: study.example.com" http://localhost/` | 通过 Caddy 转发到 app |
| 非 root 运行 | `docker exec <id> id` | 输出包含 `appuser` |
| 日志轮转 | 检查 Docker 日志驱动配置 | `docker inspect` 显示 json-file + max-size |

### 4.4 CI/CD 集成建议

```yaml
# .github/workflows/docker.yml（示例骨架）
name: Docker Build & Test
on: [push, pull_request]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        run: npm test

      - name: Build Docker image
        run: docker build -t app:test .

      - name: Verify healthcheck
        run: |
          docker run -d --name test-app -p 4173:4173 app:test
          sleep 10
          curl -f http://localhost:4173/api/health
          docker stop test-app
```

---

## 5. 修复优先级总览

| 优先级 | 修复项 | 预计工时 | 改动量 | 风险 |
|--------|--------|----------|--------|------|
| 🔴 P0 | 创建 `.dockerignore` | 5 分钟 | 新增 1 个文件 | 零 |
| 🔴 P0 | Dockerfile 非 root + HEALTHCHECK | 15 分钟 | 改动 Dockerfile | 极低 |
| 🟡 P1 | compose.yaml 增强 | 15 分钟 | 改动 compose.yaml | 低 |
| 🟡 P1 | Caddyfile 安全加固 | 10 分钟 | 改动 Caddyfile + compose.yaml | 低 |
| 🟢 P2 | 锁定镜像版本 | 5 分钟 | 改动 Dockerfile 1 行 | 低 |
| ⚪ P3 | CI/CD 工作流 | 30 分钟 | 新增 1 个文件 | 零 |

**总计预估工时**：约 80 分钟可完成全部 P0-P2 优化。

---

## 6. 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 非 root 用户可能导致静态文件读取权限问题 | 403 错误 | 确保 `COPY` 指令使用默认权限，node:20-alpine 默认用户可读 |
| `read_only: true`（如启用）可能阻断写操作 | 容器启动失败 | 本应用无需写入文件系统，但需验证 KaTeX 字体文件读取 |
| vendor/katex/node_modules 被意外排除 | 前端数学渲染失败 | `.dockerignore` 中明确排除 `*.png` 而非整个 `vendor/` |
| Caddy 域名变量未设置 | 使用默认占位域名 | 部署文档中明确说明 `DOMAIN` 环境变量 |
| healthcheck 在启动初期失败 | Compose 判定服务不健康 | 设置 `start_period: 10s` 给应用启动缓冲时间 |
