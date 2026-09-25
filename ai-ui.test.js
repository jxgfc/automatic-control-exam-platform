"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { createAppServer } = require("./server.js");
const { screenshotPath } = require("./ui-test-artifacts");

let browser;
let server;

(async () => {
  const mockFetch = async (url) => {
    if (String(url).endsWith("/v1/models")) {
      return new Response(JSON.stringify({ data: [{ id: "glm-5.2-fast" }, { id: "kimi-k2.7-code" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ questions: [
      {
        chapter: "根轨迹",
        type: "计算",
        difficulty: "中等",
        question: "AI测试题：已知开环传递函数 $G(s)H(s)=\\frac{K}{s(s+2)(s+4)}$，求根轨迹渐近线重心 $\\sigma_a$。",
        answer: "$\\sigma_a=\\frac{0-2-4}{3}=-2$。",
        analysis: "由 $\\sigma_a=\\frac{\\sum p_i-\\sum z_j}{n-m}$，代入三个开环极点得 $\\sigma_a=-2$。\n$$\n\\sigma_a=\\frac{0-2-4}{3}=-2\n$$\n状态矩阵可写为：\n$$\nA=\\begin{bmatrix}0&1\\\\-2&-3\\end{bmatrix}\n$$\n方程组为：\n$$\n\\begin{cases}4p-8=0\\nK-4p-8=0\\end{cases}\n$$",
        keywords: ["渐近线", "重心"]
      }
    ] }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  server = createAppServer({ fetch: mockFetch });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`);

  await page.locator('[data-tool="question-bank"]').click();
  await page.waitForSelector("#bank-stat-strip");
  assert.equal(await page.locator("#bank-source").inputValue(), "all");
  const builtInCount = await page.evaluate(() => window.ControlPracticeQuestions.length + window.ControlTheoryQuestions.length);
  assert.match(await page.locator("#bank-stat-strip").innerText(), new RegExp(builtInCount + "\\s*总题库"));
  assert.equal(await page.locator("#wrong-book-filters").isVisible(), false);
  await page.locator("#bank-chapter").selectOption("系统建模");
  await page.locator("#bank-type").selectOption("计算");
  await page.locator("#bank-start").click();
  await page.waitForSelector("#bank-user-answer");
  assert.match(await page.locator("#practice-question-card").innerText(), /1 \/ 5/);
  assert.ok(await page.locator(".exam-question-body .katex .mfrac").count() >= 1);
  await page.locator("#bank-user-answer").fill("我的计算步骤");
  await page.locator("#bank-reveal").click();
  assert.match(await page.locator("#practice-question-card").innerText(), /参考答案/);
  assert.equal(await page.locator("#bank-user-answer").inputValue(), "我的计算步骤");
  await page.locator("#bank-favorite").click();
  await page.locator('[data-bank-rating="wrong"]').click();
  assert.match(await page.locator("#bank-source-favorite").innerText(), /1题/);
  assert.match(await page.locator("#bank-stat-strip").innerText(), /1\s*待复习错题/);
  assert.match(await page.locator("#bank-stat-strip").innerText(), /0%\s*综合掌握率/);
  await page.locator("[data-bank-wrong-note]").fill("忽略了闭环特征方程");
  await page.locator('[data-bank-workspace-view="analysis"]').click();
  assert.equal(await page.locator("#mastery-dashboard").isVisible(), true);
  assert.match(await page.locator("#mastery-dashboard").innerText(), /知识掌握分析/);
  assert.match(await page.locator("#mastery-dashboard").innerText(), /系统建模/);
  assert.match(await page.locator("#mastery-dashboard").innerText(), /进入错题本/);
  await page.locator('[data-bank-workspace-view="practice"]').click();
  await page.locator("#bank-source").selectOption("wrong");
  assert.equal(await page.locator("#wrong-book-filters").isVisible(), true);
  await page.locator("#bank-start").click();
  assert.match(await page.locator(".wrong-book-meta").innerText(), /错误 1 次/);
  await page.locator("#bank-reveal").click();
  assert.equal(await page.locator("[data-bank-wrong-note]").inputValue(), "忽略了闭环特征方程");
  await page.locator('[data-bank-rating="mastered"]').click();
  assert.match(await page.locator(".wrong-book-meta").innerText(), /复习中/);
  await page.locator('[data-bank-rating="mastered"]').click();
  assert.match(await page.locator(".wrong-book-meta").innerText(), /已掌握/);
  assert.match(await page.locator("#bank-stat-strip").innerText(), /0\s*待复习错题/);

  await page.locator("#bank-source").selectOption("ai");
  await page.waitForFunction(() => document.querySelector("#ai-server-status").textContent.includes("已连接"));
  await page.locator("#ai-provider").selectOption("micu");
  assert.equal(await page.locator("#ai-base-url").inputValue(), "https://www.micuapi.ai");
  assert.equal(await page.locator("#ai-micu-model").inputValue(), "");
  assert.equal(await page.locator("#ai-protocol").inputValue(), "anthropic");
  assert.equal(await page.locator("#ai-auth-mode").inputValue(), "bearer");
  assert.equal(await page.locator("#ai-preset-note").isVisible(), true);
  assert.equal(await page.locator('[data-ai-advanced]:visible').count(), 0);
  assert.equal(await page.locator("#ai-api-key").isVisible(), true);
  assert.equal(await page.locator("#ai-model").isVisible(), false);
  assert.equal(await page.locator("#ai-micu-model").isVisible(), true);
  assert.match(await page.locator("#ai-model-label").innerText(), /按Key读取/);
  await page.locator("#ai-api-key").fill("MICU-TEST-KEY");
  await page.locator("#ai-fetch-models").click();
  await page.waitForFunction(() => document.querySelector("#ai-model-status").textContent.includes("2 个可用模型"));
  assert.equal(await page.locator("#ai-micu-model").inputValue(), "glm-5.2-fast");
  assert.equal(await page.locator("#ai-micu-model option").count(), 2);
  assert.deepEqual(await page.locator("#ai-micu-model option").allTextContents(), ["glm-5.2-fast（实测约2-3分钟）", "kimi-k2.7-code（可能超过3分钟）"]);
  await page.locator("#ai-micu-model").selectOption("kimi-k2.7-code");
  assert.equal(await page.locator("#ai-micu-model").inputValue(), "kimi-k2.7-code");
  assert.equal(await page.locator("#ai-count").inputValue(), "1");
  await page.locator("#ai-count").selectOption("3");
  assert.match(await page.locator("#ai-model-status").innerText(), /容易触发上游500/);
  await page.locator("#ai-count").selectOption("1");
  await page.screenshot({ path: screenshotPath("calculator-ai-micu-key-only-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  await page.screenshot({ path: screenshotPath("calculator-ai-micu-key-only-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator("#ai-provider").selectOption("relay");
  assert.equal(await page.locator("#ai-preset-note").isVisible(), false);
  assert.equal(await page.locator('[data-ai-advanced]:visible').count(), 3);
  assert.equal(await page.locator("#ai-protocol").inputValue(), "chat");
  assert.equal(await page.locator("#ai-auth-mode").inputValue(), "bearer");
  await page.locator("#ai-provider").selectOption("local");
  await page.locator("#ai-api-key").fill("SECRET-DO-NOT-STORE");
  await page.locator("#ai-count").selectOption("1");
  await page.locator("#ai-chapter").selectOption("根轨迹");
  await page.locator("#ai-generate").click();
  await page.waitForFunction(() => document.querySelector("#practice-question-card").textContent.includes("AI测试题"));
  assert.match(await page.locator("#ai-generation-status").innerText(), /生成完成，用时/);
  assert.match(await page.locator("#practice-question-card").innerText(), /AI原创生成/);
  assert.match(await page.locator("#bank-source-all").innerText(), new RegExp((builtInCount + 1) + "题"));
  assert.match(await page.locator("#bank-source-history").innerText(), /1题/);
  await page.locator("#bank-source").selectOption("all");
  await page.locator("#bank-search").fill("AI测试题");
  await page.locator("#bank-chapter").selectOption("all");
  await page.locator("#bank-type").selectOption("all");
  await page.locator("#bank-difficulty").selectOption("all");
  await page.locator("#bank-start").click();
  assert.match(await page.locator("#practice-question-card").innerText(), /AI测试题/);
  assert.equal(await page.locator(".exam-paper-heading").count(), 1);
  assert.ok(await page.locator(".exam-question-body .katex").count() >= 2);
  assert.match(await page.locator(".exam-question-body").innerText(), /G\(s\)H\(s\)/);
  await page.locator("#bank-reveal").click();
  assert.ok(await page.locator(".solution-answer .katex").count() >= 1);
  assert.ok(await page.locator(".solution-analysis .katex").count() >= 2);
  // Long solutions remain readable beside a complete stem. The document stays
  // the only vertical scroller so formulas are never clipped inside a nested
  // pane; the question context summary still identifies the stem in the rail.
  assert.equal(await page.locator(".question-reading-layout").count(), 1);
  assert.equal(await page.locator(".question-stem-pane").count(), 1);
  assert.equal(await page.locator(".question-answer-pane").count(), 1);
  assert.equal(await page.locator(".question-context-summary").count(), 1);
  assert.match(await page.locator(".question-context-summary").innerText(), /题干回顾/);
  const stemLayout = await page.locator(".question-stem-pane").evaluate((node) => ({
    position: getComputedStyle(node).position,
    maxHeight: getComputedStyle(node).maxHeight,
    overflowY: getComputedStyle(node).overflowY
  }));
  assert.equal(stemLayout.position, "relative");
  assert.equal(stemLayout.maxHeight, "none");
  assert.equal(stemLayout.overflowY, "visible");
  await page.setViewportSize({ width: 1024, height: 900 });
  const tabletColumns = await page.locator(".question-reading-layout").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  assert.equal(tabletColumns.split(" ").length, 1, "tablet layout should use one reading column");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator("[data-question-jump='stem']").click();
  assert.equal(await page.locator(".question-visual").count(), 1);
  assert.ok(await page.locator(".question-plot-point").count() >= 1);
  await page.locator(".question-plot-point").first().click({ force: true });
  assert.notEqual(await page.locator("[data-question-plot-info]").innerText(), "将鼠标悬停或点击图中点查看具体信息");
  assert.ok(await page.locator("[data-bank-open-tool]").count() >= 1);
  await page.locator("[data-bank-open-tool]").first().click();
  await page.waitForSelector("#tool-root-locus .question-context-banner");
  assert.match(await page.locator("#tool-root-locus .question-context-banner").innerText(), /AI测试题/);
  assert.equal(await page.locator("#formula-numerator-input").inputValue(), "1");
  assert.equal(await page.locator("#formula-denominator-input").inputValue(), "s(s+2)(s+4)");
  assert.equal(await page.locator("#tool-root-locus .interactive-plot").count(), 2);
  const rootPlot = page.locator("#tool-root-locus .root-locus-block .interactive-plot");
  const beforeTransform = await rootPlot.locator("[data-plot-viewport]").getAttribute("transform");
  await rootPlot.hover();
  await page.mouse.wheel(0, -450);
  const afterTransform = await rootPlot.locator("[data-plot-viewport]").getAttribute("transform");
  assert.notEqual(afterTransform, beforeTransform);
  await rootPlot.locator(".plot-hit-point[data-plot-hit='true']").first().hover({ force: true });
  await page.waitForSelector(".plot-tooltip:not([hidden])");
  assert.match(await page.locator(".plot-tooltip").innerText(), /数据点/);
  await page.locator('[data-tool="question-bank"]').click();
  assert.ok(await page.locator(".solution-analysis .katex-display").count() >= 3);
  const renderedAnalysis = await page.locator(".solution-analysis").innerText();
  assert.equal(renderedAnalysis.includes("$$"), false);
  assert.equal(renderedAnalysis.includes("\\sigma_a"), false);
  assert.equal(renderedAnalysis.includes("\\n"), false, JSON.stringify(renderedAnalysis));
  assert.deepEqual(await page.locator(".solution-analysis .katex-error").allTextContents(), []);
  const stored = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem("control-ai-question-history-v1")),
    wrongBook: JSON.parse(localStorage.getItem("control-question-wrong-book-v2")),
    attempts: JSON.parse(localStorage.getItem("control-question-attempts-v2")),
    allValues: Object.values(localStorage)
  }));
  assert.equal(stored.history.length, 1);
  assert.equal(stored.wrongBook.length, 1);
  assert.equal(stored.wrongBook[0].status, "mastered");
  assert.equal(stored.wrongBook[0].note, "忽略了闭环特征方程");
  assert.equal(stored.attempts.length, 3);
  assert.equal(stored.allValues.some((value) => String(value).includes("SECRET-DO-NOT-STORE")), false);

  await page.reload();
  await page.locator('[data-tool="question-bank"]').click();
  assert.match(await page.locator("#bank-source-all").innerText(), new RegExp((builtInCount + 1) + "题"));
  await page.locator("#bank-source").selectOption("wrong");
  await page.locator("#bank-wrong-status").selectOption("mastered");
  await page.locator("#bank-chapter").selectOption("all");
  await page.locator("#bank-type").selectOption("all");
  await page.locator("#bank-difficulty").selectOption("all");
  await page.locator("#bank-start").click();
  assert.match(await page.locator(".wrong-book-meta").innerText(), /已掌握/);
  await page.locator("#bank-reveal").click();
  assert.equal(await page.locator("[data-bank-wrong-note]").inputValue(), "忽略了闭环特征方程");

  await page.screenshot({ path: screenshotPath("calculator-ai-question-bank-desktop.png"), fullPage: true });
  await page.locator('[data-bank-workspace-view="analysis"]').click();
  await page.screenshot({ path: screenshotPath("calculator-mastery-analysis-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false);
  await page.screenshot({ path: screenshotPath("calculator-mastery-analysis-mobile.png"), fullPage: true });
  assert.deepEqual(consoleErrors, []);

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log("AI question bank UI tests passed");
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  process.exitCode = 1;
});
