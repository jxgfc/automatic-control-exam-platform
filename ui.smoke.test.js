"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { screenshotPath } = require("./ui-test-artifacts");

let browser;

(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const pageUrl = pathToFileURL(path.join(__dirname, "index.html")).href;
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(pageUrl);
  await page.waitForSelector("#coverage-table-body tr");
  assert.match(await page.locator("h1").innerText(), /自动控制原理考研计算平台/);
  assert.equal(await page.locator("#coverage-table-body tr").count(), 37);
  assert.equal((await page.locator("#coverage-table-body").innerText()).includes("待接入"), false);
  const coverageAudit = await page.evaluate(() => {
    const missing = [];
    for (const item of window.ControlSyllabus) {
      if (!item.tool || !document.querySelector(`[data-tool="${item.tool}"]`) || !document.querySelector(`#tool-${item.tool}`)) {
        missing.push(item.topic);
      }
    }
    return {
      total: window.ControlSyllabus.length,
      theoryQuestions: window.ControlTheoryQuestions.length,
      bankQuestions: window.ControlPracticeQuestions.length + window.ControlTheoryQuestions.length,
      missing,
      statuses: [...new Set(window.ControlSyllabus.map((item) => item.status))].sort()
    };
  });
  assert.equal(coverageAudit.total, 37);
  assert.equal(coverageAudit.theoryQuestions, 38);
  assert.deepEqual(coverageAudit.missing, []);
  assert.deepEqual(coverageAudit.statuses, ["available", "theory"]);

  await page.locator("#school-profile").selectOption("828");
  assert.equal(await page.locator('[data-tool="root-locus"]').isHidden(), true);
  assert.match(await page.locator("#active-profile-badge").innerText(), /828/);
  await page.locator("#school-profile").selectOption("861");
  assert.equal(await page.locator('[data-tool="root-locus"]').isVisible(), true);

  await page.locator('[data-tool="routh"]').click();
  await page.waitForSelector("#routh-result .routh-table");
  assert.match(await page.locator("#routh-result .result-summary-band").innerText(), /右半平面有 2 个根/);
  await page.locator("#routh-example").selectOption("(s+1)(s+2)(s+3)");
  assert.match(await page.locator("#routh-result .result-summary-band").innerText(), /稳定/);
  await page.locator("#routh-example").selectOption("s^4+2s^2+1");
  assert.match(await page.locator("#routh-result .calculation-notes").innerText(), /全零/);

  await page.locator('[data-tool="steady-error"]').click();
  await page.waitForSelector("#steady-error-result .result-summary-band");
  assert.match(await page.locator("#steady-error-result").innerText(), /ess = 0.2/);
  assert.match(await page.locator("#steady-error-result").innerText(), /1 型/);
  await page.locator("#error-input-type").selectOption("2");
  await page.locator("#steady-error-calculate").click();
  assert.match(await page.locator("#steady-error-result").innerText(), /ess = ∞/);

  await page.locator('[data-tool="second-order"]').click();
  await page.waitForSelector("#second-order-result .response-plot svg");
  assert.match(await page.locator("#second-order-result").innerText(), /16.3034%/);
  assert.match(await page.locator("#second-order-result").innerText(), /0.9069/);
  assert.ok((await page.locator("#second-order-result path").getAttribute("d")).length > 500);
  await page.locator("#time-mode").selectOption("first");
  await page.locator("#second-order-calculate").click();
  assert.match(await page.locator("#second-order-result").innerText(), /一阶系统/);
  assert.match(await page.locator("#second-order-result").innerText(), /3\.912/);
  await page.locator("#time-mode").selectOption("higher");
  await page.locator("#second-order-calculate").click();
  assert.match(await page.locator("#second-order-result").innerText(), /高阶系统稳定性/);
  await page.locator("#time-mode").selectOption("second");

  await page.locator('[data-tool="frequency"]').click();
  await page.waitForSelector("#frequency-result .bode-plot svg");
  assert.equal(await page.locator("#frequency-numerator + .transfer-keypad-trigger").count(), 1);
  await page.locator("#frequency-numerator + .transfer-keypad-trigger").click();
  await page.waitForFunction(() => {
    const keypad = document.querySelector(".transfer-keypad-popover");
    return keypad && !keypad.hidden;
  });
  assert.equal(await page.locator(".transfer-keypad-popover").isVisible(), true);
  await page.locator(".transfer-keypad-grid [data-tkp-value='7']").click();
  assert.match(await page.locator("#frequency-numerator").inputValue(), /17/);
  await page.locator(".transfer-keypad-head [data-tkp-action='close']").click();
  assert.match(await page.locator("#frequency-result").innerText(), /51\.827/);
  assert.match(await page.locator("#frequency-result").innerText(), /0\.7861/);
  assert.equal(await page.locator("#frequency-result .bode-plot path").count(), 2);
  await page.screenshot({ path: screenshotPath("calculator-frequency-desktop.png"), fullPage: true });

  await page.locator('[data-tool="modeling"]').click();
  await page.waitForSelector("#modeling-result .result-summary-band");
  assert.equal(await page.locator("#partial-numerator + .transfer-keypad-trigger").count(), 1);
  assert.match(await page.locator("#modeling-result").innerText(), /3 个极点项/);
  assert.match(await page.locator("#modeling-result").innerText(), /拉氏反变换/);
  await page.locator("#modeling-mode").selectOption("mason");
  await page.locator("#modeling-calculate").click();
  assert.match(await page.locator("#modeling-result").innerText(), /前向通路/);
  assert.match(await page.locator("#modeling-result").innerText(), /独立回路/);
  await page.locator("#modeling-mode").selectOption("blocks");
  await page.locator("#modeling-calculate").click();
  assert.match(await page.locator("#modeling-result").innerText(), /结构图等效传递函数/);
  await page.locator("#modeling-mode").selectOption("laplace");
  await page.locator("#modeling-calculate").click();
  assert.match(await page.locator("#modeling-result").innerText(), /拉氏变换/);

  await page.locator('[data-tool="nyquist"]').click();
  await page.waitForSelector("#nyquist-result .nyquist-plot svg");
  assert.match(await page.locator("#nyquist-result").innerText(), /稳定：Z = 0/);
  assert.match(await page.locator("#nyquist-result").innerText(), /闭环带宽/);

  await page.locator('[data-tool="compensation"]').click();
  assert.match(await page.locator("#compensation-result").innerText(), /超前校正网络/);
  await page.locator("#compensation-mode").selectOption("pid");
  await page.locator("#compensation-calculate").click();
  assert.match(await page.locator("#compensation-result").innerText(), /PID 控制器/);
  assert.match(await page.locator("#compensation-result").innerText(), /Kp\s*6/);
  await page.locator("#compensation-mode").selectOption("laglead");
  await page.locator("#compensation-calculate").click();
  assert.match(await page.locator("#compensation-result").innerText(), /滞后-超前组合网络/);
  await page.locator("#compensation-mode").selectOption("lag");
  await page.locator("#compensation-calculate").click();
  assert.match(await page.locator("#compensation-result").innerText(), /滞后校正网络/);

  await page.locator('[data-tool="discrete"]').click();
  assert.match(await page.locator("#discrete-result").innerText(), /稳定：全部根在单位圆内/);
  await page.locator("#discrete-mode").selectOption("difference");
  await page.locator("#discrete-calculate").click();
  assert.match(await page.locator("#discrete-result").innerText(), /y\[末\]\s*2/);
  assert.equal(await page.locator("#discrete-result .response-plot svg").count(), 1);
  await page.locator("#discrete-mode").selectOption("zoh");
  await page.locator("#discrete-calculate").click();
  assert.match(await page.locator("#discrete-result").innerText(), /零阶保持离散化/);
  await page.locator("#discrete-mode").selectOption("zinverse");
  await page.locator("#discrete-calculate").click();
  assert.match(await page.locator("#discrete-result").innerText(), /1, 0\.5, 0\.25/);
  await page.locator("#discrete-mode").selectOption("ztransform");
  await page.locator("#discrete-calculate").click();
  assert.match(await page.locator("#discrete-result").innerText(), /单边Z变换/);

  await page.locator('[data-tool="nonlinear"]').click();
  assert.match(await page.locator("#nonlinear-result").innerText(), /N\(A\)/);
  assert.match(await page.locator("#nonlinear-result").innerText(), /数值收敛\s*是/);
  for (const type of ["hysteresis", "saturation", "deadzone"]) {
    await page.locator("#nonlinear-type").selectOption(type);
    await page.locator("#nonlinear-calculate").click();
    assert.match(await page.locator("#nonlinear-result").innerText(), /N\(A\)/);
    assert.equal(await page.locator("#nonlinear-error").isHidden(), true);
  }

  await page.locator('[data-tool="state-space"]').click();
  assert.match(await page.locator("#state-result").innerText(), /完全能控；完全能观/);
  await page.locator("#state-mode").selectOption("feedback");
  await page.locator("#state-calculate").click();
  assert.match(await page.locator("#state-result").innerText(), /状态反馈/);
  assert.match(await page.locator("#state-result").innerText(), /6\s+5/);
  await page.locator("#state-mode").selectOption("transfer");
  await page.locator("#state-calculate").click();
  assert.match(await page.locator("#state-result").innerText(), /能控标准型/);
  await page.locator("#state-mode").selectOption("observer");
  await page.locator("#state-calculate").click();
  assert.match(await page.locator("#state-result").innerText(), /全维状态观测器/);
  await page.locator("#state-mode").selectOption("lyapunov");
  await page.locator("#state-calculate").click();
  assert.match(await page.locator("#state-result").innerText(), /P正定/);
  await page.locator("#state-mode").selectOption("feedback");
  await page.locator("#state-calculate").click();
  await page.screenshot({ path: screenshotPath("calculator-state-space-desktop.png"), fullPage: true });

  await page.locator('[data-tool="theory"]').click();
  const visibleTheoryCount = await page.evaluate(() => {
    const profile = document.querySelector("#school-profile").value;
    return window.ControlTheoryQuestions.filter((item) => profile === "all" || item.schools.includes(profile)).length;
  });
  assert.match(await page.locator("#theory-progress").innerText(), new RegExp("1 \/ " + visibleTheoryCount));
  await page.locator("#theory-reveal").click();
  assert.match(await page.locator("#theory-card").innerText(), /参考答案/);
  assert.ok(await page.locator("#theory-card .keyword-list b").count() >= 3);

  await page.locator('[data-tool="question-bank"]').click();
  assert.match(await page.locator("#bank-stat-strip").innerText(), new RegExp(coverageAudit.bankQuestions + "\\s*总题库"));
  await page.locator("#bank-start").click();
  assert.match(await page.locator("#practice-question-card").innerText(), /1 \/ 10/);
  await page.locator("#bank-reveal").click();
  assert.match(await page.locator("#practice-question-card").innerText(), /参考答案/);
  await page.locator("#bank-source").selectOption("ai");
  assert.match(await page.locator("#ai-server-status").innerText(), /start-ai\.cmd/);

  await page.locator('[data-tool="steady-error"]').click();
  await page.locator("#steady-mode").selectOption("disturbance");
  await page.locator("#steady-error-calculate").click();
  assert.match(await page.locator("#steady-error-result").innerText(), /扰动引起的稳态误差/);

  await page.locator('[data-tool="root-locus"]').click();
  await page.waitForSelector("#tool-root-locus .answer-row");
  assert.match(await page.locator("#tool-root-locus .answer-value strong").first().innerText(), /-0\.845299/);
  assert.equal(await page.locator("#tool-root-locus .root-locus-block path").count(), 3);
  assert.match(await page.locator("#tool-root-locus .root-geometry-grid").innerText(), /-2/);
  await page.locator("#example-select").selectOption("complex-poles");
  assert.match(await page.locator("#tool-root-locus .answer-value strong").first().innerText(), /-2\.82601/);
  assert.match(await page.locator("#tool-root-locus .root-geometry-grid").innerText(), /复极点出射角/);
  await page.screenshot({ path: screenshotPath("calculator-root-locus-desktop.png"), fullPage: true });

  await page.locator('[data-tool="overview"]').click();
  await page.locator("#school-profile").selectOption("all");
  await page.screenshot({ path: screenshotPath("calculator-preview-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, "mobile viewport must not overflow horizontally");
  await page.screenshot({ path: screenshotPath("calculator-preview-mobile.png"), fullPage: true });
  await page.locator('[data-tool="routh"]').click();
  const routhOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(routhOverflow, false, "mobile Routh calculator must not overflow horizontally");
  await page.screenshot({ path: screenshotPath("calculator-routh-mobile.png"), fullPage: true });
  await page.locator('[data-tool="frequency"]').click();
  const frequencyOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(frequencyOverflow, false, "mobile frequency calculator must not overflow horizontally");

  for (const tool of ["modeling", "steady-error", "second-order", "root-locus", "nyquist", "compensation", "discrete", "nonlinear", "state-space", "theory", "question-bank"]) {
    await page.locator(`[data-tool="${tool}"]`).click();
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(hasOverflow, false, `mobile ${tool} tool must not overflow horizontally`);
  }
  await page.screenshot({ path: screenshotPath("calculator-theory-mobile.png"), fullPage: true });

  assert.deepEqual(consoleErrors, []);
  await browser.close();
  console.log("UI smoke test passed");
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
