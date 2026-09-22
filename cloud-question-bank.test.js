"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

// A developer's shell may contain production settings; this test never uses them.
process.env.DATABASE_URL = "";
const { createAppServer } = require("./server.js");
let browser;
let server;

function question(index) {
  return {
    id: "cloud-" + index,
    question: "云端题目 " + index,
    answer: "答案 " + index,
    analysis: "本地分页测试解析",
    type: "计算",
    difficulty: "中等",
    chapter: "根轨迹",
    schools: ["828", "861"],
    keywords: ["分页测试"],
    source: "云端测试"
  };
}

(async () => {
  server = createAppServer({ requireActivation: false, authUseMemory: true, questionBankUseMemory: true,
    fetch: async () => { throw new Error("Test must not call an external service"); } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
  const rows = Array.from({ length: 250 }, (_, index) => question(index));
  rows[150] = { ...rows[0], id: "cloud-duplicate" };
  const cases = [
    { name: "完整分页并跨页去重", payload: (offset) => ({ items: rows.slice(offset, offset + 100), total: rows.length }), label: /已读取 250\/250 条，可练习 249 题/, offsets: [0, 100, 200], count: 249 },
    { name: "第二页失败仍可练习成功页，明确提示部分加载", payload: () => ({ items: rows.slice(0, 100), total: rows.length }), status: (offset) => offset ? 500 : 200, label: /已读取 100\/250 条，可练习 100 题；部分加载：云端题库暂时不可用/, offsets: [0, 100], count: 100 },
    { name: "后续页鉴权失效不能继续显示已读云端题", payload: () => ({ items: rows.slice(0, 100), total: rows.length }), status: (offset) => offset ? 401 : 200, label: /登录后才能读取云端题库/, offsets: [0, 100], count: 0 },
    { name: "无total仍读取后续页", payload: (offset) => ({ items: rows.slice(0, 120).slice(offset, offset + 100) }), label: /^云端AI题库（120题）$/, offsets: [0, 100], count: 120 },
    { name: "错误响应结构不能显示成空题库成功", payload: () => ({ total: 10 }), label: /云端题库数据格式异常/, offsets: [0], count: 0 },
    { name: "单次加载上限明确标出数据库总量", payload: (offset) => ({ items: Array.from({ length: 100 }, (_, index) => question(offset + index)), total: 2010 }), label: /已读取 2000\/2010 条，可练习 2000 题/, offsets: Array.from({ length: 20 }, (_, index) => index * 100), count: 2000 },
    { name: "合法空题库", payload: () => ({ items: [], total: 0 }), label: /^云端AI题库（0题）$/, offsets: [0], count: 0 }
  ];

  for (const scenario of cases) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const requests = [];
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/auth/me") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, user: { id: "1", username: "cloud-tester" }, isAdmin: false }) });
      if (url.pathname !== "/api/question-bank") return route.continue();
      const offset = Number(url.searchParams.get("offset") || 0);
      assert.equal(url.searchParams.get("limit"), "100");
      requests.push(offset);
      return route.fulfill({ status: scenario.status ? scenario.status(offset) : 200, contentType: "application/json", body: JSON.stringify(scenario.payload(offset)) });
    });
    await page.goto(origin + "/");
    await page.waitForFunction(() => {
      const label = document.querySelector("#bank-source-cloud")?.textContent || "";
      return label.startsWith("云端AI题库（") && !label.includes("正在读取");
    });
    assert.match(await page.locator("#bank-source-cloud").textContent(), scenario.label, scenario.name);
    assert.deepEqual(requests, scenario.offsets, scenario.name + "：分页应顺序读取且不重复");
    await page.locator('[data-tool="question-bank"]').click();
    await page.locator("#bank-source").selectOption("cloud", { force: true });
    assert.equal(await page.locator("#bank-stat-strip strong").first().textContent(), String(scenario.count), scenario.name);
    if (scenario.count) {
      await page.locator("#bank-start").click();
      assert.match(await page.locator("#practice-question-card .exam-question-body").innerText(), /云端题目/);
    }
    assert.deepEqual(pageErrors, [], scenario.name);
    await page.close();
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log("Cloud question bank tests passed (7 scenarios)");
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  process.exitCode = 1;
});
