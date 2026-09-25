"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

let browser;
(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname, "index.html")).href);
  await page.waitForSelector("#personal-home .personal-tool-card");
  assert.equal(await page.locator("#personal-home .personal-tool-card").count(), 4);
  assert.match(await page.locator("#personal-home [data-profile-name]").first().innerText(), /自动控制学习空间/);
  assert.equal(await page.locator('[data-stat="syllabus"]').first().innerText(), "37");
  assert.equal(await page.locator("[data-backup-export]").count(), 1);
  assert.equal(await page.locator("[data-backup-import]").count(), 1);
  await page.locator('[data-home-tool="root-locus"]').click();
  assert.equal(await page.locator("#tool-root-locus").isVisible(), true);
  const platformPosition = await page.locator("#learning-platform").evaluate((element) => element.offsetTop);
  const afterHomeEntry = await page.evaluate(() => window.scrollY);
  assert.ok(afterHomeEntry >= platformPosition - 20, "entering a tool should scroll to the platform, not the homepage");
  await page.locator('[data-tool="overview"]').click();
  const afterPlatformNavigation = await page.evaluate(() => window.scrollY);
  assert.ok(afterPlatformNavigation >= platformPosition - 20, "platform navigation should stay inside the platform");
  const beforeInternalNavigation = await page.evaluate(() => window.scrollY);
  await page.locator('[data-tool="frequency"]').click();
  const afterInternalNavigation = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(afterInternalNavigation - beforeInternalNavigation) < 20, "switching tools inside the platform must preserve scroll position");
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, "personal home must not overflow horizontally on mobile");
  await page.locator("[data-nav-toggle]").click();
  assert.equal(await page.locator("#personal-nav-menu").isVisible(), true);
  await page.locator("#personal-nav-menu a").first().click();
  assert.equal(await page.locator("#personal-nav-menu").isVisible(), false, "mobile menu should close after navigation");
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Personal home test passed");
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
