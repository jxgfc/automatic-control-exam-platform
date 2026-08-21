"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(ROOT, "server.js");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = address && typeof address === "object" ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, child) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("生产服务提前退出，退出码：" + child.exitCode);
    }
    try {
      const response = await fetch(baseUrl + "/api/health", { cache: "no-store" });
      if (response.ok) return;
      lastError = new Error("健康接口返回HTTP " + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("等待生产服务就绪超时：" + (lastError ? lastError.message : "未知错误"));
}

async function fetchText(baseUrl, pathname, options) {
  const response = await fetch(baseUrl + pathname, options);
  return { response, text: await response.text() };
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, 3000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function main() {
  const port = Number(process.env.SMOKE_PORT) || await getFreePort();
  const child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    const baseUrl = "http://127.0.0.1:" + port;
    await waitForHealth(baseUrl, child);

    const health = await fetchText(baseUrl, "/api/health", { cache: "no-store" });
    assert.equal(health.response.status, 200);
    assert.deepEqual(JSON.parse(health.text), { ok: true, aiProxy: true, version: "activation-codes-v1", auth: false, questionBank: false, adminConfigured: false, requireActivation: false });

    const homepage = await fetchText(baseUrl, "/");
    assert.equal(homepage.response.status, 200);
    assert.match(homepage.response.headers.get("content-type") || "", /text\/html/);
    assert.match(homepage.text, /自动控制原理考研计算平台/);

    const stylesheet = await fetchText(baseUrl, "/styles.css");
    assert.equal(stylesheet.response.status, 200);
    assert.match(stylesheet.response.headers.get("content-type") || "", /text\/css/);

    const katex = await fetchText(baseUrl, "/vendor/katex/node_modules/katex/dist/katex.min.js");
    assert.equal(katex.response.status, 200);
    assert.match(katex.response.headers.get("content-type") || "", /javascript/);

    const apiError = await fetchText(baseUrl, "/api/ai/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocol: "chat", baseUrl: "https://api.example.com/v1", model: "smoke-test", criteria: { count: 1 } })
    });
    assert.equal(apiError.response.status, 400);
    assert.match(JSON.parse(apiError.text).error, /API密钥/);

    console.log("Production smoke test passed");
  } catch (error) {
    if (output.trim()) console.error(output.trim());
    throw error;
  } finally {
    await stopChild(child);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
