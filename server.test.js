"use strict";

const assert = require("node:assert/strict");
const { buildPrompt, parseGeneratedQuestions, requestAiQuestions, requestAiModels, modelsEndpointUrl, questionTimeoutMs, isMicuChatModel, createAppServer } = require("./server.js");

(async () => {
  const prompt = buildPrompt({ school: "828", chapter: "根轨迹", type: "计算", difficulty: "中等", count: 3, extra: "含复数极点" });
  assert.match(prompt, /3道原创/);
  assert.match(prompt, /根轨迹/);
  assert.match(prompt, /不得照抄/);
  assert.equal(questionTimeoutMs(1), 180000);
  assert.equal(questionTimeoutMs(3), 300000);
  assert.equal(questionTimeoutMs(5), 300000);
  assert.equal(isMicuChatModel("micu", "glm-5.2-fast"), true);
  assert.equal(isMicuChatModel("micu", "kimi-k2.7-code"), true);
  assert.equal(isMicuChatModel("micu", "claude-sonnet"), false);

  const parsed = parseGeneratedQuestions('```json\n{"questions":[{"chapter":"时域分析","type":"计算","difficulty":"基础","question":"题目","answer":"答案","analysis":"解析","keywords":["劳斯"]}]}\n```', 1);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].question, "题目");
  assert.equal(parsed[0].source, "AI原创生成");

  const nestedJson = parseGeneratedQuestions('先说明一个对象 {"note":"不是题目"}\n最终结果：```json\n{"questions":[{"question":"求 $G(s)=\\frac{1}{s+1}$","answer":"$G(s)=\\frac{1}{s+1}$","analysis":"直接读取","keywords":[],}],}\n```', 1);
  assert.equal(nestedJson.length, 1);
  assert.match(nestedJson[0].question, /\\frac/);

  const validAnalysis = "先写矩阵：\n$$\nA=\\begin{bmatrix}0&1\\\\-2&-3\\end{bmatrix}\n$$\n再写特征方程：\n$$\ns^2+3s+2=0\n$$";
  const validNewlines = parseGeneratedQuestions(JSON.stringify({ questions: [{
    question: "测试合法JSON换行",
    answer: "$s=-1,-2$",
    analysis: validAnalysis,
    keywords: []
  }] }), 1);
  assert.equal(validNewlines[0].analysis, validAnalysis);

  const malformedCases = "$$\\begin{cases}4p-8=0\\nK-4p-8=0\\end{cases}$$";
  const repairedCases = parseGeneratedQuestions(JSON.stringify({ questions: [{
    question: "测试方程组换行",
    answer: "$p=2$",
    analysis: malformedCases,
    keywords: []
  }] }), 1);
  assert.equal(repairedCases[0].analysis, "$$\\begin{cases}4p-8=0\\\\K-4p-8=0\\end{cases}$$");
  const doubleEscapedCases = "$$\\\\begin{cases}4p-8=0\\\\\\\\nK-4p-8=0\\\\end{cases}$$";
  const repairedDoubleEscapedCases = parseGeneratedQuestions(JSON.stringify({ questions: [{
    question: "双反斜杠换行",
    answer: "$p=2$",
    analysis: doubleEscapedCases,
    keywords: []
  }] }), 1);
  assert.equal(repairedDoubleEscapedCases[0].analysis, "$$\\\\begin{cases}4p-8=0\\\\\\\\K-4p-8=0\\\\end{cases}$$");

  const markdownQuestion = parseGeneratedQuestions('## 题目\n求单位负反馈闭环传递函数。\n\n## 参考答案\n$\\Phi(s)=1/(s+1)$。\n\n## 解析\n使用闭环公式计算。', 1);
  assert.equal(markdownQuestion[0].question, "求单位负反馈闭环传递函数。");
  assert.match(markdownQuestion[0].answer, /Phi/);

  let capturedUrl;
  let capturedRequest;
  let capturedHeaders;
  const mockFetch = async (url, options) => {
    capturedUrl = String(url);
    capturedRequest = JSON.parse(options.body);
    capturedHeaders = options.headers;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ questions: [
        { chapter: "离散系统", type: "计算", difficulty: "中等", question: "判断z^2-0.5z是否稳定", answer: "稳定", analysis: "根为0与0.5", keywords: ["单位圆"] }
      ] }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const generated = await requestAiQuestions({
    protocol: "chat",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "local-test",
    apiKey: "",
    criteria: { count: 1, chapter: "离散系统" }
  }, mockFetch);
  assert.match(capturedUrl, /chat\/completions$/);
  assert.equal(capturedRequest.model, "local-test");
  assert.equal(generated[0].answer, "稳定");

  await requestAiQuestions({
    protocol: "responses",
    baseUrl: "https://relay.example/v1/chat/completions",
    model: "relay-model",
    apiKey: "relay-secret",
    authMode: "x-api-key",
    criteria: { count: 1 }
  }, mockFetch);
  assert.equal(capturedUrl, "https://relay.example/v1/chat/completions");
  assert.equal(capturedRequest.model, "relay-model");
  assert.equal(capturedHeaders["x-api-key"], "relay-secret");
  assert.equal(capturedHeaders.Authorization, undefined);

  const anthropicFetch = async (url, options) => {
    capturedUrl = String(url);
    capturedRequest = JSON.parse(options.body);
    capturedHeaders = options.headers;
    return new Response(JSON.stringify({
      content: [{ type: "text", text: JSON.stringify({ questions: [
        { chapter: "根轨迹", type: "计算", difficulty: "中等", question: "Micu题目", answer: "Micu答案", analysis: "Micu解析", keywords: ["中转站"] }
      ] }) }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const micuQuestions = await requestAiQuestions({
    provider: "micu",
    protocol: "anthropic",
    baseUrl: "https://www.micuapi.ai",
    model: "gpt-5.6-sol",
    apiKey: "micu-secret",
    authMode: "bearer",
    criteria: { count: 1, chapter: "根轨迹" }
  }, anthropicFetch);
  assert.equal(capturedUrl, "https://www.micuapi.ai/v1/messages");
  assert.equal(capturedRequest.model, "gpt-5.6-sol");
  assert.equal(capturedRequest.max_tokens, 3000);
  assert.equal(capturedRequest.messages[0].role, "user");
  assert.equal(capturedRequest.messages.some((message) => message.role === "system"), false);
  assert.equal(capturedHeaders.Authorization, "Bearer micu-secret");
  assert.equal(capturedHeaders["anthropic-version"], "2023-06-01");
  assert.equal(capturedHeaders["User-Agent"], "claude-cli/2.0.76 (external, cli)");
  assert.equal(micuQuestions[0].question, "Micu题目");

  await requestAiQuestions({
    provider: "micu",
    protocol: "anthropic",
    baseUrl: "https://www.micuapi.ai",
    model: "glm-5.2-fast",
    apiKey: "micu-secret",
    criteria: { count: 1 }
  }, mockFetch);
  assert.equal(capturedUrl, "https://www.micuapi.ai/v1/chat/completions");
  assert.equal(capturedRequest.model, "glm-5.2-fast");
  assert.equal(capturedRequest.max_tokens, 12000);
  assert.deepEqual(capturedRequest.thinking, { type: "disabled" });
  assert.deepEqual(capturedRequest.response_format, { type: "json_object" });
  assert.match(capturedHeaders["User-Agent"], /^Mozilla\/5\.0/);

  let fallbackCalls = 0;
  const fallbackQuestions = await requestAiQuestions({
    provider: "micu",
    protocol: "anthropic",
    baseUrl: "https://www.micuapi.ai",
    model: "kimi-k2.7-code",
    apiKey: "micu-secret",
    criteria: { count: 1 }
  }, async (_url, options) => {
    fallbackCalls += 1;
    const body = JSON.parse(options.body);
    if (body.model === "kimi-k2.7-code") {
      return new Response(JSON.stringify({ error: { message: "Service Error" } }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ questions: [
        { chapter: "根轨迹", type: "计算", difficulty: "中等", question: "GLM接管题目", answer: "答案", analysis: "解析", keywords: [] }
      ] }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  assert.equal(fallbackCalls, 3);
  assert.equal(fallbackQuestions[0].question, "GLM接管题目");
  assert.match(fallbackQuestions[0].source, /GLM接管/);
  assert.match(fallbackQuestions[0].generationNotice, /连续两次/);

  await assert.rejects(
    requestAiQuestions({
      provider: "micu",
      protocol: "anthropic",
      baseUrl: "https://www.micuapi.ai",
      model: "glm-5.2-fast",
      apiKey: "micu-secret",
      criteria: { count: 1 }
    }, async () => { const error = new Error("The operation was aborted due to timeout"); error.name = "TimeoutError"; throw error; }),
    /5 分钟内没有返回/
  );

  assert.equal(String(modelsEndpointUrl("https://www.micuapi.ai")), "https://www.micuapi.ai/v1/models");
  assert.equal(String(modelsEndpointUrl("https://www.micuapi.ai/v1")), "https://www.micuapi.ai/v1/models");
  let modelListHeaders;
  const models = await requestAiModels({ provider: "micu", baseUrl: "https://www.micuapi.ai", apiKey: "micu-secret" }, async (_url, options) => {
    modelListHeaders = options.headers;
    return new Response(JSON.stringify({ data: [{ id: "glm-5.2-fast" }, { id: "kimi-k2.7-code" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  assert.deepEqual(models, ["glm-5.2-fast", "kimi-k2.7-code"]);
  assert.equal(modelListHeaders["x-api-key"], "micu-secret");
  assert.equal(modelListHeaders.Authorization, undefined);
  let authFallbackCalls = 0;
  const fallbackModels = await requestAiModels({ provider: "micu", baseUrl: "https://www.micuapi.ai", apiKey: "micu-secret" }, async (_url, options) => {
    authFallbackCalls += 1;
    if (options.headers["x-api-key"]) return new Response(JSON.stringify({ error: { message: "legacy relay" } }), { status: 401, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ data: [{ id: "legacy-model" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  assert.deepEqual(fallbackModels, ["legacy-model"]);
  assert.equal(authFallbackCalls, 2);

  await assert.rejects(
    requestAiQuestions({
      provider: "micu",
      protocol: "anthropic",
      baseUrl: "https://www.micuapi.ai",
      model: "",
      apiKey: "micu-secret",
      authMode: "bearer",
      criteria: { count: 1 }
    }, anthropicFetch),
    /读取并选择模型/
  );

  await assert.rejects(
    requestAiQuestions({
      provider: "micu",
      protocol: "anthropic",
      baseUrl: "https://www.micuapi.ai",
      model: "gpt-5.6-sol",
      apiKey: "micu-secret",
      criteria: { count: 1 }
    }, async () => new Response(JSON.stringify({ error: { message: "This token has no access to model gpt-5.6-sol" } }), { status: 403, headers: { "Content-Type": "application/json" } })),
    /读取可用模型/
  );

  await assert.rejects(
    requestAiQuestions({ protocol: "chat", baseUrl: "https://api.example.com/v1", model: "test", criteria: { count: 1 } }, mockFetch),
    /API密钥/
  );

  try {
    await requestAiQuestions({
      protocol: "chat",
      baseUrl: "https://relay.example/v1",
      model: "relay-model",
      apiKey: "SECRET-VALUE",
      criteria: { count: 1 }
    }, async () => new Response(JSON.stringify({ error: { message: "key SECRET-VALUE invalid" } }), { status: 401, headers: { "Content-Type": "application/json" } }));
    assert.fail("401 response should reject");
  } catch (error) {
    assert.match(error.message, /中转站鉴权失败/);
    assert.equal(error.message.includes("SECRET-VALUE"), false);
  }

  const server = createAppServer({ fetch: mockFetch });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const health = await fetch(`http://127.0.0.1:${address.port}/api/health`).then((response) => response.json());
  assert.deepEqual(health, { ok: true, aiProxy: true });
  const page = await fetch(`http://127.0.0.1:${address.port}/`).then((response) => response.text());
  assert.match(page, /自动控制原理考研计算平台/);
  await new Promise((resolve) => server.close(resolve));

  console.log("AI server tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
