"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const MAX_BODY = 256 * 1024;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("请求内容过大"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (_) {
        reject(new Error("请求JSON格式不正确"));
      }
    });
    request.on("error", reject);
  });
}

function cleanText(value, maximum) {
  return String(value == null ? "" : value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, maximum);
}

const multilineMathEnvironments = ["cases", "aligned", "array", "matrix", "bmatrix", "pmatrix", "vmatrix", "Vmatrix", "gathered", "split"];
const validNCommands = new Set(["nabla", "natural", "ne", "neg", "neq", "nexists", "ngeq", "ngtr", "ni", "nleq", "nless", "nmid", "not", "notin", "nparallel", "nu", "nvdash", "nVdash", "newline"]);

function isInsideMultilineEnvironment(source, offset) {
  const before = source.slice(0, offset);
  return multilineMathEnvironments.some((environment) => {
    return before.lastIndexOf("\\begin{" + environment + "}") > before.lastIndexOf("\\end{" + environment + "}");
  });
}

function normalizeMathSegment(value) {
  const source = String(value);
  let result = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const insideMultilineEnvironment = isInsideMultilineEnvironment(source, index);
    if (character === "\r" || character === "\n") {
      result += insideMultilineEnvironment ? "\\\\" : character;
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      continue;
    }
    if (character === "\\" && source[index + 1] === "\\" && source[index + 2] === "n") {
      result += insideMultilineEnvironment ? "\\\\" : " ";
      index += 2;
      continue;
    }
    if (character === "\\" && source[index + 1] === "n") {
      const command = source.slice(index + 1).match(/^[A-Za-z]+/);
      if (command && validNCommands.has(command[0])) {
        result += "\\n";
        index += 1;
        continue;
      }
      result += insideMultilineEnvironment ? "\\\\" : " ";
      index += 1;
      continue;
    }
    result += character;
  }
  return result;
}

function normalizeFormulaArtifacts(value) {
  const delimitedMath = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\$)(?:\\.|[^$\r\n])+\$/g;
  return String(value).replace(delimitedMath, (formula) => normalizeMathSegment(formula));
}

function validateProviderUrl(rawValue) {
  let value;
  try {
    value = new URL(String(rawValue));
  } catch (_) {
    throw new Error("API地址格式不正确");
  }
  const local = value.hostname === "127.0.0.1" || value.hostname === "localhost" || value.hostname === "::1";
  if (value.protocol !== "https:" && !(local && value.protocol === "http:")) {
    throw new Error("远程API必须使用HTTPS；本机模型可使用localhost HTTP");
  }
  if (value.username || value.password) throw new Error("API地址中不能包含账号或密码");
  return value;
}

function endpointUrl(baseUrl, protocol) {
  const value = validateProviderUrl(baseUrl);
  const pathname = value.pathname.replace(/\/+$/, "");
  if (/\/(?:responses|chat\/completions|messages)$/i.test(pathname)) {
    value.pathname = pathname;
  } else if (protocol === "anthropic") {
    value.pathname = /\/v\d+$/i.test(pathname) ? pathname + "/messages" : pathname + "/v1/messages";
  } else {
    value.pathname = pathname + (protocol === "responses" ? "/responses" : "/chat/completions");
  }
  return value;
}

function modelsEndpointUrl(baseUrl) {
  const value = validateProviderUrl(baseUrl);
  let pathname = value.pathname.replace(/\/+$/, "");
  if (/\/messages$/i.test(pathname)) pathname = pathname.replace(/\/messages$/i, "/models");
  else if (!/\/models$/i.test(pathname)) pathname += /\/v\d+$/i.test(pathname) ? "/models" : "/v1/models";
  value.pathname = pathname;
  return value;
}

async function requestAiModels(input, fetchImplementation) {
  const provider = cleanText(input.provider || "", 30);
  const baseUrl = cleanText(input.baseUrl || (provider === "micu" ? "https://www.micuapi.ai" : ""), 500);
  const apiKey = cleanText(input.apiKey, 500);
  const requestedAuthMode = ["x-api-key", "api-key", "bearer"].includes(input.authMode)
    ? input.authMode
    : "";
  if (!baseUrl) throw new Error("请填写API地址");
  if (!apiKey) throw new Error("请先填写API密钥");
  const providerUrl = modelsEndpointUrl(baseUrl);
  const fetcher = fetchImplementation || global.fetch;
  if (typeof fetcher !== "function") throw new Error("当前Node.js版本不支持网络请求");
  const authModes = requestedAuthMode
    ? [requestedAuthMode]
    : provider === "micu"
      ? ["x-api-key", "bearer"]
      : ["bearer"];
  let response;
  let responseText;
  for (const authMode of authModes) {
    const authHeaders = authMode === "x-api-key"
      ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : authMode === "api-key"
        ? { "api-key": apiKey }
        : { Authorization: "Bearer " + apiKey };
    response = await fetcher(providerUrl, {
      method: "GET",
      headers: {
        ...authHeaders,
        "User-Agent": provider === "micu" ? "claude-cli/2.0.76 (external, cli)" : "control-exam-platform/1.0"
      },
      redirect: "error",
      signal: AbortSignal.timeout(30000)
    });
    responseText = await response.text();
    if (response.ok || ![401, 403].includes(response.status) || authMode === authModes[authModes.length - 1]) break;
  }
  let payload;
  try { payload = JSON.parse(responseText); } catch (_) { throw new Error("模型服务返回了非JSON响应"); }
  if (!response.ok) {
    const providerMessage = payload && payload.error && (payload.error.message || payload.error);
    const safeMessage = cleanText(providerMessage || "", 300).split(apiKey).join("****");
    if (response.status === 401 || response.status === 403) throw new Error("读取模型列表失败（" + response.status + "）：请检查令牌是否有效及是否有模型列表权限。" + (safeMessage ? " 上游信息：" + safeMessage : ""));
    throw new Error("读取模型列表失败（" + response.status + "）" + (safeMessage ? "：" + safeMessage : ""));
  }
  const candidates = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
  const models = candidates.map((item) => typeof item === "string" ? item : item && (item.id || item.name)).filter(Boolean).map((item) => cleanText(item, 120)).filter(Boolean);
  if (!models.length) throw new Error("模型列表为空，请手动填写模型ID");
  return [...new Set(models)].slice(0, 100);
}

function buildPrompt(criteria) {
  const count = Math.max(1, Math.min(5, Number(criteria.count) || 3));
  const school = cleanText(criteria.school || "828与861", 30);
  const chapter = cleanText(criteria.chapter || "综合", 40);
  const type = cleanText(criteria.type || "计算", 20);
  const difficulty = cleanText(criteria.difficulty || "中等", 20);
  const extra = cleanText(criteria.extra || "", 500);
  return [
    "请生成" + count + "道原创的自动控制原理考研题，不得照抄或声称来自任何付费题库。",
    "考试范围：" + school + "；章节：" + chapter + "；题型：" + type + "；难度：" + difficulty + "。",
    extra ? "附加要求：" + extra + "。" : "",
    "每题必须条件充分、答案唯一，计算题给出可复核的中间步骤；使用中国高校自动控制原理常用符号。",
    "题干、答案和解析中的全部数学公式必须使用LaTeX：行内公式写成$...$，独立公式写成$$...$$；分式使用\\frac，上下标使用_与^，矩阵使用bmatrix。中文说明不要放进公式定界符。",
    "仅返回JSON，不要Markdown。结构必须为：",
    '{"questions":[{"chapter":"章节","type":"题型","difficulty":"难度","question":"题目","answer":"最终答案","analysis":"完整解析","keywords":["关键词"]}]}'
  ].filter(Boolean).join("\n");
}

function extractProviderText(payload, protocol) {
  if (protocol === "anthropic") {
    if (typeof payload.content === "string") return payload.content;
    const content = Array.isArray(payload.content) ? payload.content : [];
    const preferred = content.filter((item) => item && ["text", "output_text"].includes(item.type)).map((item) => item.text || item.output_text || "").filter(Boolean);
    if (preferred.length) return preferred.join("\n");
    const fallback = content.map((item) => item && (item.text || item.output_text || (typeof item.content === "string" ? item.content : ""))).filter(Boolean);
    if (fallback.length) return fallback.join("\n");
    if (typeof payload.output_text === "string") return payload.output_text;
  }
  if (protocol === "responses") {
    if (typeof payload.output_text === "string") return payload.output_text;
    const parts = [];
    for (const output of payload.output || []) {
      for (const content of output.content || []) {
        if (typeof content.text === "string") parts.push(content.text);
      }
    }
    return parts.join("\n");
  }
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => item.text || "").join("\n");
  return "";
}

function balancedJsonSegments(text, open, close) {
  const segments = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === open) {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === close && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        segments.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return segments;
}

function repairJsonBackslashes(value) {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") { result += character; continue; }
    const next = value[index + 1] || "";
    if (next === "\\" || next === '"' || next === "/") {
      result += character + next;
      index += 1;
      continue;
    }
    if (next === "u" && /^[0-9a-fA-F]{4}$/.test(value.slice(index + 2, index + 6))) {
      result += value.slice(index, index + 6);
      index += 5;
      continue;
    }
    const word = value.slice(index + 1).match(/^[A-Za-z]+/);
    const latexCommand = word && /^(?:backslash|bar|begin|because|beta|bf|big|binom|boxed|bullet|frac|nabla|ne|neg|neq|not|nu|rangle|Re|right|rho|rm|rightarrow|tan|tau|text|theta|tilde|times|to|top|triangle)$/i.test(word[0]);
    if (/[bfnrt]/.test(next) && !latexCommand) {
      result += character + next;
      index += 1;
      continue;
    }
    result += "\\\\";
  }
  return result;
}

function questionPayload(value) {
  if (Array.isArray(value)) return value.length ? { questions: value } : null;
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value.questions)) return value;
  if (value.data && Array.isArray(value.data.questions)) return value.data;
  if (value.result && Array.isArray(value.result.questions)) return value.result;
  return null;
}

function parseJsonQuestionPayload(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "").trim();
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = [...withoutThinking.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1].trim());
  const candidates = [withoutThinking, ...fenced, ...balancedJsonSegments(withoutThinking, "{", "}"), ...balancedJsonSegments(withoutThinking, "[", "]")].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    const variants = [
      repairJsonBackslashes(candidate).replace(/,\s*([}\]])/g, "$1"),
      candidate.replace(/,\s*([}\]])/g, "$1"),
      candidate
    ];
    for (const variant of [...new Set(variants)]) {
      try {
        let parsed = JSON.parse(variant);
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        const payload = questionPayload(parsed);
        if (payload) return payload;
      } catch (_) { /* Try the next locally repaired candidate. */ }
    }
  }
  return null;
}

function parseSectionQuestionPayload(text) {
  const source = String(text || "").replace(/```(?:markdown|text)?/gi, "").replace(/```/g, "").trim();
  const labelPattern = /(?:^|\n)\s*(?:#{1,6}\s*)?\*{0,2}(题目|问题|参考答案|答案|解答|详细解析|解析)\*{0,2}\s*[：:]?\s*/g;
  const sections = [];
  let match;
  while ((match = labelPattern.exec(source))) sections.push({ label: match[1], start: labelPattern.lastIndex, marker: match.index });
  sections.forEach((section, index) => { section.value = source.slice(section.start, sections[index + 1] ? sections[index + 1].marker : source.length).trim(); });
  const find = (labels) => sections.find((section) => labels.includes(section.label) && section.value);
  const question = find(["题目", "问题"]);
  const answer = find(["参考答案", "答案", "解答"]);
  const analysis = find(["详细解析", "解析"]);
  if (!question || !answer) return null;
  return { questions: [{ question: question.value, answer: answer.value, analysis: analysis ? analysis.value : answer.value }] };
}

function parseGeneratedQuestions(text, expectedCount) {
  const parsed = parseJsonQuestionPayload(text) || parseSectionQuestionPayload(text);
  if (!parsed) throw new Error("AI返回了文字内容，但无法识别题目结构。请切换另一个模型后重试");
  if (!parsed || !Array.isArray(parsed.questions) || !parsed.questions.length) throw new Error("AI返回的题目列表为空");
  return parsed.questions.slice(0, expectedCount).map((item, index) => {
    const question = normalizeFormulaArtifacts(cleanText(item.question, 4000));
    const answer = normalizeFormulaArtifacts(cleanText(item.answer, 4000));
    const analysis = normalizeFormulaArtifacts(cleanText(item.analysis, 8000));
    if (!question || !answer || !analysis) throw new Error("第" + (index + 1) + "道AI题缺少题目、答案或解析");
    return {
      id: "AI-" + Date.now() + "-" + index,
      chapter: cleanText(item.chapter, 40) || "综合",
      type: cleanText(item.type, 20) || "计算",
      difficulty: cleanText(item.difficulty, 20) || "中等",
      question,
      answer,
      analysis,
      keywords: Array.isArray(item.keywords) ? item.keywords.slice(0, 8).map((value) => cleanText(value, 30)).filter(Boolean) : [],
      source: "AI原创生成"
    };
  });
}

function questionTimeoutMs(count) {
  return Math.min(300000, 120000 + Math.max(1, Number(count) || 1) * 60000);
}

function isMicuChatModel(provider, model) {
  return provider === "micu" && /^(?:glm|kimi|qwen|deepseek|doubao|ernie|minimax|yi|hunyuan|moonshot)[-_.]/i.test(model);
}

async function requestAiQuestions(input, fetchImplementation) {
  let protocol = ["responses", "anthropic"].includes(input.protocol) ? input.protocol : "chat";
  if (/\/chat\/completions\/?(?:\?.*)?$/i.test(String(input.baseUrl))) protocol = "chat";
  if (/\/responses\/?(?:\?.*)?$/i.test(String(input.baseUrl))) protocol = "responses";
  if (/\/messages\/?(?:\?.*)?$/i.test(String(input.baseUrl))) protocol = "anthropic";
  const model = cleanText(input.model, 100);
  const apiKey = cleanText(input.apiKey, 500);
  const baseUrl = cleanText(input.baseUrl, 500);
  const authMode = ["x-api-key", "api-key"].includes(input.authMode) ? input.authMode : "bearer";
  const count = Math.max(1, Math.min(5, Number(input.criteria && input.criteria.count) || 3));
  if (!baseUrl) throw new Error("请填写API地址");
  if (!model) throw new Error(input.provider === "micu" ? "请先读取并选择模型，或手动填写模型ID" : "请填写模型名称");
  const micuChatModel = isMicuChatModel(input.provider, model);
  if (micuChatModel) protocol = "chat";
  let endpointBase = baseUrl;
  if (micuChatModel) {
    const value = validateProviderUrl(baseUrl);
    if (!value.pathname.replace(/\/+$/, "")) value.pathname = "/v1";
    endpointBase = String(value);
  }
  const providerUrl = endpointUrl(endpointBase, protocol);
  const local = providerUrl.hostname === "127.0.0.1" || providerUrl.hostname === "localhost" || providerUrl.hostname === "::1";
  if (!apiKey && !local) throw new Error("请填写API密钥");
  const prompt = buildPrompt(input.criteria || {});
  const systemPrompt = "你是自动控制原理考研命题与审题专家。直接给出结果，不输出内部思考过程；严格输出有效JSON。";
  const maxTokens = micuChatModel ? Math.min(20000, 9000 + count * 3000) : Math.min(10000, 1000 + count * 2000);
  const modelField = model ? { model } : {};
  const chatOptions = input.provider === "micu" ? { temperature: 0.2, thinking: { type: "disabled" } } : {};
  const requestBody = protocol === "responses"
    ? { model, input: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] }
    : protocol === "anthropic"
      ? { ...modelField, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: prompt }] }
      : { model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], max_tokens: maxTokens, response_format: { type: "json_object" }, ...chatOptions };
  const fetcher = fetchImplementation || global.fetch;
  if (typeof fetcher !== "function") throw new Error("当前Node.js版本不支持网络请求");
  const authorizationHeaders = apiKey
    ? authMode === "bearer" ? { Authorization: "Bearer " + apiKey } : { [authMode]: apiKey }
    : {};
  const protocolHeaders = protocol === "anthropic" ? { "anthropic-version": "2023-06-01" } : {};
  const providerHeaders = input.provider === "micu"
    ? { "User-Agent": protocol === "chat" ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" : "claude-cli/2.0.76 (external, cli)" }
    : {};
  const timeoutMs = micuChatModel ? 300000 : questionTimeoutMs(count);
  let providerResponse;
  let responseText;
  try {
    providerResponse = await fetcher(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authorizationHeaders,
        ...protocolHeaders,
        ...providerHeaders
      },
      body: JSON.stringify(requestBody),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs)
    });
    responseText = await providerResponse.text();
  } catch (error) {
    const timeoutLike = error && (error.name === "TimeoutError" || error.name === "AbortError" || /timeout|timed out|aborted/i.test(error.message || ""));
    if (timeoutLike) throw new Error("中转站在 " + Math.round(timeoutMs / 60000) + " 分钟内没有返回结果。建议先生成1题，或切换另一个可用模型后重试。");
    throw error;
  }
  if (responseText.length > 2 * 1024 * 1024) throw new Error("AI响应内容过大");
  let payload;
  try { payload = JSON.parse(responseText); } catch (_) { throw new Error("AI服务返回了非JSON响应"); }
  if (!providerResponse.ok) {
    const providerMessage = payload && payload.error && (payload.error.message || payload.error);
    const rawProviderMessage = cleanText(providerMessage || "", 300);
    const safeProviderMessage = apiKey ? rawProviderMessage.split(apiKey).join("****") : rawProviderMessage;
    if (providerResponse.status === 403 && /no access to model|model[^.]{0,80}(?:access|permission|denied|forbidden)/i.test(rawProviderMessage)) {
      throw new Error("当前令牌没有所选模型的权限（403）。请点击“读取可用模型”并重新选择。" + (safeProviderMessage ? " 上游信息：" + safeProviderMessage : ""));
    }
    if (providerResponse.status === 401) {
      throw new Error("中转站鉴权失败（401）：请确认使用的是中转站令牌，而不是官方平台密钥。" + (safeProviderMessage ? " 上游信息：" + safeProviderMessage : ""));
    }
    if (providerResponse.status === 403) {
      throw new Error("中转站拒绝访问（403）：请检查令牌分组、模型权限和余额。" + (safeProviderMessage ? " 上游信息：" + safeProviderMessage : ""));
    }
    if (input.provider === "micu" && [500, 502, 503, 504].includes(providerResponse.status)) {
      const retryCount = Math.max(0, Number(input.internalRetryCount) || 0);
      if (retryCount < 1) {
        return requestAiQuestions({ ...input, internalRetryCount: retryCount + 1 }, fetcher);
      }
      if (/^kimi[-_.]/i.test(model) && !input.internalFallbackUsed) {
        const fallbackQuestions = await requestAiQuestions({
          ...input,
          model: "glm-5.2-fast",
          internalRetryCount: 0,
          internalFallbackUsed: true
        }, fetcher);
        return fallbackQuestions.map((question) => ({
          ...question,
          source: "AI原创生成 · Kimi异常后由GLM接管",
          generationNotice: "Kimi连续两次返回服务错误，已自动切换为glm-5.2-fast完成生成。"
        }));
      }
      throw new Error("Micu模型服务连续两次异常（" + providerResponse.status + "）。请稍后重试，或切换另一个可用模型。" + (safeProviderMessage ? " 上游信息：" + safeProviderMessage : ""));
    }
    throw new Error("AI服务请求失败（" + providerResponse.status + "）：" + (safeProviderMessage || "请检查模型名称、接口协议和额度"));
  }
  const providerText = extractProviderText(payload, protocol);
  const finishReason = payload.stop_reason || (payload.choices && payload.choices[0] && payload.choices[0].finish_reason);
  if (!providerText.trim() && ["max_tokens", "length"].includes(finishReason)) {
    throw new Error("模型在输出题目前已达到长度上限。请切换另一个模型，或减少生成题目数量");
  }
  if (!providerText.trim()) throw new Error("模型返回了空内容，请切换另一个模型后重试");
  return parseGeneratedQuestions(providerText, count);
}

function serveStatic(request, response, pathname) {
  let relativePath;
  try { relativePath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname); } catch (_) { response.writeHead(400); response.end(); return; }
  const filePath = path.resolve(ROOT, "." + relativePath);
  if (!filePath.startsWith(ROOT + path.sep)) { response.writeHead(403); response.end(); return; }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function createAppServer(options) {
  const settings = options || {};
  return http.createServer(async (request, response) => {
    const host = request.headers.host || "127.0.0.1";
    let url;
    try { url = new URL(request.url, "http://" + host); } catch (_) { response.writeHead(400); response.end(); return; }
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, aiProxy: true });
      return;
    }
    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(204, { "Cache-Control": "public, max-age=86400" });
      response.end();
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/ai/questions") {
      try {
        const body = await readJson(request);
        const questions = await requestAiQuestions(body, settings.fetch);
        sendJson(response, 200, { questions });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : "AI出题失败" });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/ai/models") {
      try {
        const body = await readJson(request);
        const models = await requestAiModels(body, settings.fetch);
        sendJson(response, 200, { models });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : "读取模型列表失败" });
      }
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return; }
    serveStatic(request, response, url.pathname);
  });
}

if (require.main === module) {
  const port = Math.max(1, Math.min(65535, Number(process.env.PORT) || 4173));
  const host = process.env.HOST || "0.0.0.0";
  const server = createAppServer();
  server.listen(port, host, () => {
    const displayHost = host === "0.0.0.0" ? "localhost" : host;
    console.log("自动控制AI题库已启动：http://" + displayHost + ":" + port);
    console.log("监听地址：" + host + ":" + port + "；API密钥不会写入本地文件。");
  });
}

module.exports = { createAppServer, buildPrompt, parseGeneratedQuestions, requestAiQuestions, requestAiModels, modelsEndpointUrl, questionTimeoutMs, isMicuChatModel };
