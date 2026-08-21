"use strict";

const assert = require("node:assert/strict");
const { createAppServer } = require("./server.js");

(async () => {
  const server = createAppServer({ authUseMemory: true, questionBankUseMemory: true, questionBankAdminToken: "admin-test-token" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const json = (value) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });

  const missingActivation = await fetch(base + "/api/auth/register", { method: "POST", ...json({ username: "tester", password: "password-123" }) });
  assert.equal(missingActivation.status, 403);
  assert.equal((await missingActivation.json()).code, "ACTIVATION_REQUIRED");
  const generated = await fetch(base + "/api/admin/activation-codes", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer admin-test-token" }, body: JSON.stringify({ count: 2, expiresInDays: 7, label: "测试批次" }) });
  assert.equal(generated.status, 201);
  const generatedPayload = await generated.json();
  assert.equal(generatedPayload.codes.length, 2);
  assert.match(generatedPayload.codes[0].code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const register = await fetch(base + "/api/auth/register", { method: "POST", ...json({ username: "tester", password: "password-123", activationCode: generatedPayload.codes[0].code }) });
  assert.equal(register.status, 201);
  const cookie = register.headers.get("set-cookie");
  assert.match(cookie, /control_session=/);
  const me = await fetch(base + "/api/auth/me", { headers: { Cookie: cookie } }).then((response) => response.json());
  assert.equal(me.authenticated, true);
  assert.equal(me.user.username, "tester");
  const reused = await fetch(base + "/api/auth/register", { method: "POST", ...json({ username: "tester2", password: "password-123", activationCode: generatedPayload.codes[0].code }) });
  assert.equal(reused.status, 403);
  assert.equal((await reused.json()).code, "ACTIVATION_CODE_USED");
  const listed = await fetch(base + "/api/admin/activation-codes", { headers: { Authorization: "Bearer admin-test-token" } }).then((response) => response.json());
  assert.equal(listed.codes.length, 2);
  assert.equal(listed.codes.some((code) => code.code), false);

  const unauthorized = await fetch(base + "/api/question-bank", { method: "POST", ...json({ question: "q", answer: "a", analysis: "x" }) });
  assert.equal(unauthorized.status, 401);
  const created = await fetch(base + "/api/question-bank", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer admin-test-token" }, body: JSON.stringify({ question: "云端题目", options: ["A"], answer: "A", analysis: "解析", chapter: "根轨迹", keywords: ["分离点"] }) });
  assert.equal(created.status, 201);
  const list = await fetch(base + "/api/question-bank?search=分离点").then((response) => response.json());
  assert.equal(list.total, 1);
  assert.equal(list.items[0].options[0], "A");

  await new Promise((resolve) => server.close(resolve));
  console.log("Auth and question-bank tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
