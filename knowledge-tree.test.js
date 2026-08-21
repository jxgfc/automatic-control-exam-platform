"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { createAppServer } = require("./server.js");

let browser;
let server;

(async () => {
  server = createAppServer({ fetch: async () => new Response(JSON.stringify({}), { status: 500 }) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true, user: { id: "1", username: "tester" }, isAdmin: false })
  }));
  await page.goto(`http://127.0.0.1:${port}/`);

  assert.equal(await page.locator("#coverage-search").getAttribute("autocomplete"), "off");
  await page.locator("#coverage-search").fill("tester");
  await page.evaluate(() => window.ControlAccount.refresh());
  assert.equal(await page.locator("#coverage-search").inputValue(), "");

  assert.equal(await page.locator('[data-tool="knowledge-tree"]').count(), 1);
  await page.locator('[data-tool="knowledge-tree"]').click();
  await page.waitForSelector("#knowledge-tree-list");
  assert.equal(await page.locator("#tool-knowledge-tree").isVisible(), true);
  assert.equal(await page.evaluate(() => window.ControlKnowledgeTree.chapters.flatMap((chapter) => chapter.nodes).length), 37);
  assert.match(await page.locator("#knowledge-progress-summary").innerText(), /0%/);
  assert.ok(await page.locator(".knowledge-node").count() >= 1);
  assert.match(await page.locator("#knowledge-lesson").innerText(), /学习目标/);
  assert.match(await page.locator("#knowledge-lesson").innerText(), /原创例题/);
  assert.ok(await page.locator("#knowledge-lesson .katex").count() >= 2);
  assert.deepEqual(await page.locator("#knowledge-lesson .katex-error").allTextContents(), []);
  assert.ok(await page.locator(".knowledge-resource-list a").count() >= 2);

  await page.locator('[data-knowledge-status="learning"]').click();
  assert.match(await page.locator("#knowledge-progress-summary").innerText(), /已开始 1/);
  assert.match(await page.locator(".knowledge-status").innerText(), /学习中/);
  await page.locator('[data-knowledge-status="mastered"]').click();
  assert.match(await page.locator("#knowledge-progress-summary").innerText(), /100%|1 \/ 37/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("control-knowledge-progress-v1"))["fundamentals-feedback"].status), "mastered");

  await page.locator("#knowledge-search").fill("劳斯");
  assert.ok(await page.locator(".knowledge-node").count() >= 1);
  assert.match(await page.locator("#knowledge-tree-list").innerText(), /劳斯/);
  await page.locator("#knowledge-search").fill("");
  await page.locator('[data-knowledge-action="practice"]').click();
  assert.equal(await page.locator('[data-tool="question-bank"]').evaluate((button) => button.classList.contains("active")), true);
  assert.equal(await page.locator("#bank-search").inputValue(), "反馈 开环 闭环");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-tool="knowledge-tree"]').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  await page.screenshot({ path: "knowledge-tree-mobile.png", fullPage: true });
  assert.deepEqual(consoleErrors, []);

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log("Knowledge tree tests passed");
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  process.exitCode = 1;
});
