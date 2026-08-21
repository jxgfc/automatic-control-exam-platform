(function () {
  "use strict";

  const practiceQuestions = window.ControlPracticeQuestions || [];
  const theoryQuestions = (window.ControlTheoryQuestions || []).map((item, index) => ({
    ...item,
    id: "T" + String(index + 1).padStart(3, "0"),
    type: item.chapter === "状态空间" && /定理|原理/.test(item.question) ? "证明" : "简答",
    difficulty: "基础",
    source: "大纲理论自测",
    analysis: item.answer
  }));
  const builtInQuestions = practiceQuestions.concat(theoryQuestions);
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const HISTORY_KEY = "control-ai-question-history-v1";
  const FAVORITES_KEY = "control-question-favorites-v1";
  const WRONG_KEY = "control-question-wrong-v1";
  const WRONG_BOOK_KEY = "control-question-wrong-book-v2";
  const ATTEMPTS_KEY = "control-question-attempts-v2";
  const SETTINGS_KEY = "control-ai-settings-v1";
  let cloudQuestions = [];

  const providerPresets = {
    openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-5-mini", protocol: "responses", authMode: "bearer" },
    micu: { baseUrl: "https://www.micuapi.ai", model: "", protocol: "anthropic", authMode: "bearer" },
    relay: { baseUrl: "", model: "", protocol: "chat", authMode: "bearer" },
    deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat", protocol: "chat", authMode: "bearer" },
    local: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5:7b", protocol: "chat", authMode: "bearer" }
  };

  const chapterToolMap = {
    "系统建模": "modeling",
    "时域分析": "second-order",
    "稳态误差": "steady-error",
    "根轨迹": "root-locus",
    "频域分析": "frequency",
    "系统校正": "compensation",
    "离散系统": "discrete",
    "非线性系统": "nonlinear",
    "状态空间": "state-space",
    "基础概念": "theory"
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function markLegacyMath(value) {
    const raw = String(value == null ? "" : value);
    if (/\$\$?|\\\(|\\\[/.test(raw)) return raw;
    const matrixMarked = raw.replace(/\[\[([^\]]+)\],\[([^\]]+)\]\]/g, (_, firstRow, secondRow) => {
      return "$\\begin{bmatrix}" + firstRow.replace(/,/g, "&") + "\\\\" + secondRow.replace(/,/g, "&") + "\\end{bmatrix}$";
    });
    const mathRun = /([A-Za-zΦφζηωσΔπλΣ][A-Za-z0-9ΦφζηωσΔπλΣ_'′()[\]{}+\-*/^=≈<>·√∫∞°%.,\s]*[=≈<>][A-Za-z0-9ΦφζηωσΔπλΣ_'′()[\]{}+\-*/^=≈<>·√∫∞°%.,\s]*)/g;
    return matrixMarked.replace(mathRun, (match) => "$" + match.trim() + "$");
  }

  const multilineMathEnvironments = ["cases", "aligned", "array", "matrix", "bmatrix", "pmatrix", "vmatrix", "Vmatrix", "gathered", "split"];
  const validNCommands = new Set(["nabla", "natural", "ne", "neg", "neq", "nexists", "ngeq", "ngtr", "ni", "nleq", "nless", "nmid", "not", "notin", "nparallel", "nu", "nvdash", "nVdash", "newline"]);

  function isInsideMultilineEnvironment(source, offset) {
    const before = source.slice(0, offset);
    return multilineMathEnvironments.some((environment) => {
      return before.lastIndexOf("\\begin{" + environment + "}") > before.lastIndexOf("\\end{" + environment + "}");
    });
  }

  // Normalize real and escaped AI row-break markers before KaTeX rendering.
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

  function normalizeFormulaText(value) {
    const delimitedMath = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\$)(?:\\.|[^$\r\n])+\$/g;
    return String(value == null ? "" : value).replace(delimitedMath, (formula) => normalizeMathSegment(formula));
  }

  function examText(value) {
    const marked = markLegacyMath(value);
    const delimitedMath = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\$)(?:\\.|[^$\r\n])+\$/g;
    let html = "";
    let textStart = 0;
    let match;

    while ((match = delimitedMath.exec(marked)) !== null) {
      html += escapeHtml(marked.slice(textStart, match.index)).replace(/\r\n?|\n/g, "<br>");
      html += escapeHtml(normalizeMathSegment(match[0]).replace(/\r\n?|\n/g, " "));
      textStart = match.index + match[0].length;
    }

    return html + escapeHtml(marked.slice(textStart)).replace(/\r\n?|\n/g, "<br>");
  }

  function renderExamMath(container) {
    if (!container || typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false,
      strict: false,
      trust: false
    });
  }

  function suggestedScore(item) {
    if (item.type === "证明" || item.type === "综合设计") return item.difficulty === "提高" ? 15 : 12;
    if (item.type === "简答" || item.type === "分析") return item.difficulty === "提高" ? 10 : 8;
    return item.difficulty === "提高" ? 15 : item.difficulty === "中等" ? 12 : 8;
  }

  function readStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Storage can be disabled. */ }
  }

  function normalizeQuestion(item, index) {
    return {
      id: String(item.id || "AI-HISTORY-" + index),
      chapter: String(item.chapter || "综合"),
      type: String(item.type || "计算"),
      difficulty: String(item.difficulty || "中等"),
      schools: Array.isArray(item.schools) ? item.schools : ["828", "861"],
      question: normalizeFormulaText(String(item.question || "")),
      options: Array.isArray(item.options) ? item.options.map((value) => normalizeFormulaText(String(value))).filter(Boolean).slice(0, 12) : [],
      answer: normalizeFormulaText(String(item.answer || "")),
      analysis: normalizeFormulaText(String(item.analysis || item.answer || "")),
      keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
      source: String(item.source || "AI原创生成"),
      generationNotice: String(item.generationNotice || "")
    };
  }

  function normalizeAttempt(item) {
    const rating = ["wrong", "partial", "mastered"].includes(item && item.rating) ? item.rating : "";
    return {
      questionId: String(item && item.questionId || ""),
      rating,
      timestamp: Math.max(0, Number(item && item.timestamp) || 0),
      chapter: String(item && item.chapter || "综合"),
      type: String(item && item.type || "计算"),
      difficulty: String(item && item.difficulty || "中等"),
      keywords: Array.isArray(item && item.keywords) ? item.keywords.map(String).filter(Boolean).slice(0, 8) : [],
      schools: Array.isArray(item && item.schools) ? item.schools.map(String) : ["828", "861"],
      source: String(item && item.source || "题库")
    };
  }

  let aiHistory = readStorage(HISTORY_KEY, []).map(normalizeQuestion).filter((item) => item.question && item.answer);
  let favorites = new Set(readStorage(FAVORITES_KEY, []).map(String));
  let attemptHistory = readStorage(ATTEMPTS_KEY, []).map(normalizeAttempt).filter((item) => item.questionId && item.rating).slice(-1500);

  function allQuestions() {
    const questions = new Map();
    builtInQuestions.concat(aiHistory, cloudQuestions).forEach((item) => {
      const contentKey = [item.question, item.answer].join("\n");
      const key = contentKey || String(item.id);
      if (!questions.has(key)) questions.set(key, item);
    });
    return [...questions.values()];
  }

  async function loadCloudQuestions() {
    if (window.location.protocol === "file:") return;
    try {
      const response = await fetch("/api/question-bank?limit=100", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      cloudQuestions = (payload.items || []).map((item, index) => normalizeQuestion({ ...item, source: item.source || "云端AI题库" }, index)).filter((item) => item.question && item.answer);
      if ($("#bank-source-cloud")) $("#bank-source-cloud").textContent = "云端AI题库（" + cloudQuestions.length + "题）";
      updateStats();
      if (queue.length === 0) renderQuestion();
    } catch (_) {
      cloudQuestions = [];
    }
  }

  function normalizeWrongEntry(entry, index) {
    const lookup = new Map(allQuestions().map((item) => [String(item.id), item]));
    const rawQuestion = entry && (entry.question || entry.snapshot) || lookup.get(String(entry && entry.id || ""));
    if (!rawQuestion) return null;
    const question = normalizeQuestion(rawQuestion, index);
    const id = String(entry && entry.id || question.id);
    question.id = id;
    return {
      id,
      question,
      status: ["unmastered", "reviewing", "mastered"].includes(entry && entry.status) ? entry.status : "unmastered",
      wrongCount: Math.max(0, Number(entry && entry.wrongCount != null ? entry.wrongCount : 1) || 0),
      partialCount: Math.max(0, Number(entry && entry.partialCount) || 0),
      reviewCount: Math.max(0, Number(entry && entry.reviewCount) || 0),
      correctStreak: Math.max(0, Number(entry && entry.correctStreak) || 0),
      note: String(entry && entry.note || ""),
      firstWrongAt: Math.max(0, Number(entry && entry.firstWrongAt) || Date.now()),
      lastReviewedAt: Math.max(0, Number(entry && entry.lastReviewedAt) || Date.now()),
      lastRating: ["wrong", "partial", "mastered"].includes(entry && entry.lastRating) ? entry.lastRating : "wrong"
    };
  }

  const storedWrongBook = readStorage(WRONG_BOOK_KEY, []).map(normalizeWrongEntry).filter(Boolean);
  let wrongBook = new Map(storedWrongBook.map((entry) => [entry.id, entry]));
  readStorage(WRONG_KEY, []).map(String).forEach((id, index) => {
    if (wrongBook.has(id)) return;
    const question = allQuestions().find((item) => String(item.id) === id);
    const entry = normalizeWrongEntry(question ? { id, question } : null, storedWrongBook.length + index);
    if (entry) wrongBook.set(id, entry);
  });
  let wrongQuestions = new Set(wrongBook.keys());
  let queue = [];
  let queueIndex = 0;
  let answerVisible = false;
  const drafts = new Map();

  function addQuestionBankView() {
    $("#module-nav").insertAdjacentHTML("beforeend", '<button type="button" class="module-link" data-tool="question-bank" data-schools="828,861"><span class="module-number">13</span><span><strong>智能题库</strong><small>统一题库、错题本与掌握分析</small></span></button>');
    $(".platform-main").insertAdjacentHTML("beforeend", `
      <section class="tool-view question-bank-view" id="tool-question-bank" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">13 · QUESTION BANK</p><h2>智能题库</h2><p>内置题与AI生成题统一练习，错题复盘和掌握分析保存在当前浏览器。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="question-bank-layout">
          <section class="question-bank-controls">
            <label class="field"><span class="field-label">题库范围</span><select id="bank-source"><option value="all" id="bank-source-all">总题库</option><option value="builtin" id="bank-source-builtin">内置题库</option><option value="history" id="bank-source-history">AI题库</option><option value="wrong" id="bank-source-wrong">错题本</option><option value="favorite" id="bank-source-favorite">收藏题库</option><option value="ai">AI现场出题</option></select></label>
            <div class="mode-panel" data-bank-panel="all builtin history wrong favorite">
              <label class="field"><span class="field-label">搜索</span><input id="bank-search" type="search" placeholder="题目、知识点或关键词"></label>
              <div class="two-field-grid"><label class="field"><span class="field-label">章节</span><select id="bank-chapter"><option value="all">全部章节</option></select></label><label class="field"><span class="field-label">题型</span><select id="bank-type"><option value="all">全部题型</option><option>计算</option><option>分析</option><option>简答</option><option>证明</option></select></label></div>
              <div class="two-field-grid"><label class="field"><span class="field-label">难度</span><select id="bank-difficulty"><option value="all">全部难度</option><option>基础</option><option>中等</option><option>提高</option></select></label><label class="field"><span class="field-label">练习数量</span><select id="bank-count"><option value="10">10题</option><option value="20">20题</option><option value="all">全部</option></select></label></div>
              <div class="two-field-grid wrong-book-filters" id="wrong-book-filters" hidden><label class="field"><span class="field-label">复习状态</span><select id="bank-wrong-status"><option value="active">待复习</option><option value="unmastered">待攻克</option><option value="reviewing">复习中</option><option value="mastered">已掌握</option><option value="all">全部错题</option></select></label><label class="field"><span class="field-label">排序</span><select id="bank-wrong-sort"><option value="recent">最近复习</option><option value="wrong-count">错误最多</option><option value="oldest">最久未复习</option></select></label></div>
              <button id="bank-start" class="primary-button" type="button"><span>随机开始练习</span><span aria-hidden="true">→</span></button>
              <button id="bank-clear-history" class="text-button" type="button" hidden>清空AI历史题</button>
            </div>
            <div class="mode-panel" data-bank-panel="ai" hidden>
              <div class="ai-server-status" id="ai-server-status"><span></span><strong>正在检测AI服务</strong></div>
              <label class="field"><span class="field-label">模型服务</span><select id="ai-provider"><option value="micu">米醋 Micu（模型可选）</option><option value="openai">OpenAI官方</option><option value="relay">OpenAI兼容中转站</option><option value="deepseek">DeepSeek官方</option><option value="local">本机兼容模型</option><option value="custom">自定义兼容接口</option></select></label>
              <label class="field"><span class="field-label">API密钥 <em>仅保留在当前页面</em></span><input id="ai-api-key" type="password" autocomplete="off" placeholder="sk-…"></label>
              <div class="ai-preset-note" id="ai-preset-note" hidden><strong>Micu连接参数已自动配置</strong><span>填写Key后读取可用模型；系统会按模型自动选择兼容协议。</span></div>
              <label class="field" data-ai-advanced><span class="field-label">API地址</span><input id="ai-base-url" type="url"></label>
              <div class="two-field-grid" id="ai-model-grid"><label class="field" id="ai-model-field"><span class="field-label" id="ai-model-label">模型</span><input id="ai-model"><select id="ai-micu-model" hidden><option value="">请先读取可用模型</option></select><button type="button" class="secondary-button ai-fetch-models" id="ai-fetch-models" hidden>读取可用模型</button><small class="ai-model-status" id="ai-model-status" aria-live="polite"></small></label><label class="field" data-ai-advanced><span class="field-label">接口协议</span><select id="ai-protocol"><option value="responses">Responses API</option><option value="chat">Chat Completions</option><option value="anthropic">Anthropic Messages</option></select></label></div>
              <label class="field" data-ai-advanced><span class="field-label">鉴权方式</span><select id="ai-auth-mode"><option value="bearer">Authorization: Bearer</option><option value="x-api-key">x-api-key</option><option value="api-key">api-key</option></select></label>
              <div class="two-field-grid"><label class="field"><span class="field-label">章节</span><select id="ai-chapter"><option value="综合">综合</option></select></label><label class="field"><span class="field-label">题型</span><select id="ai-type"><option>计算</option><option>分析</option><option>简答</option><option>证明</option><option>综合设计</option></select></label></div>
              <div class="two-field-grid"><label class="field"><span class="field-label">难度</span><select id="ai-difficulty"><option>基础</option><option selected>中等</option><option>提高</option></select></label><label class="field"><span class="field-label">生成数量</span><select id="ai-count"><option selected>1</option><option>3</option><option>5</option></select></label></div>
              <label class="field"><span class="field-label">附加要求 <em>可留空</em></span><textarea id="ai-extra" rows="3" placeholder="例如：包含复数极点，给出完整劳斯表"></textarea></label>
              <div id="ai-generate-error" class="error-message" role="alert" hidden></div>
              <button id="ai-generate" class="primary-button" type="button"><span>AI生成原创题</span><span aria-hidden="true">→</span></button>
              <small class="ai-generation-status" id="ai-generation-status" aria-live="polite"></small>
              <div class="method-strip"><span>隐私</span><div><p>密钥不写入localStorage或项目文件</p><p>AI生成内容会自动保存到本机浏览器题库</p></div></div>
            </div>
          </section>
          <section class="question-bank-workspace">
            <div class="bank-workspace-tabs" role="tablist" aria-label="题库视图"><button type="button" class="is-active" data-bank-workspace-view="practice" aria-selected="true">练习</button><button type="button" data-bank-workspace-view="analysis" aria-selected="false">掌握分析</button></div>
            <div data-bank-workspace-panel="practice">
              <div class="bank-stat-strip" id="bank-stat-strip"></div>
              <article class="practice-question-card" id="practice-question-card"></article>
              <div class="practice-actions" id="practice-actions" hidden>
                <button type="button" class="secondary-button" id="bank-previous">上一题</button>
                <button type="button" class="secondary-button" id="bank-favorite">收藏</button>
                <button type="button" class="primary-button" id="bank-reveal">显示答案与解析</button>
                <button type="button" class="secondary-button" id="bank-wrong">标记错题</button>
                <button type="button" class="secondary-button" id="bank-next">下一题</button>
              </div>
            </div>
            <section class="mastery-dashboard" id="mastery-dashboard" data-bank-workspace-panel="analysis" hidden></section>
          </section>
        </div>
      </section>`);
  }

  addQuestionBankView();

  const cloudSourceOption = document.createElement("option");
  cloudSourceOption.value = "cloud";
  cloudSourceOption.id = "bank-source-cloud";
  cloudSourceOption.textContent = "云端AI题库";
  $("#bank-source").insertBefore(cloudSourceOption, $("#bank-source").querySelector("option[value='wrong']"));
  const localBankPanel = $("[data-bank-panel]");
  if (localBankPanel && !localBankPanel.dataset.bankPanel.includes("cloud")) localBankPanel.dataset.bankPanel += " cloud";

  const chapters = [...new Set(builtInQuestions.map((item) => item.chapter))];
  chapters.forEach((chapter) => {
    $("#bank-chapter").insertAdjacentHTML("beforeend", '<option value="' + escapeHtml(chapter) + '">' + escapeHtml(chapter) + "</option>");
    $("#ai-chapter").insertAdjacentHTML("beforeend", '<option value="' + escapeHtml(chapter) + '">' + escapeHtml(chapter) + "</option>");
  });

  function installModeSwitch() {
    const source = $("#bank-source");
    const update = () => {
      $$('[data-bank-panel]').forEach((panel) => {
        panel.hidden = !panel.dataset.bankPanel.split(/\s+/).includes(source.value);
      });
      $("#bank-clear-history").hidden = source.value !== "history" || !aiHistory.length;
      $("#wrong-book-filters").hidden = source.value !== "wrong";
      $("#bank-start").querySelector("span").textContent = source.value === "wrong" ? "开始错题复习" : source.value === "favorite" ? "开始收藏练习" : "随机开始练习";
      updateStats();
      if (source.value === "ai") checkAiServer();
    };
    source.addEventListener("change", update);
    update();
  }

  function saveWrongBook() {
    wrongQuestions = new Set(wrongBook.keys());
    writeStorage(WRONG_BOOK_KEY, [...wrongBook.values()]);
    writeStorage(WRONG_KEY, [...wrongQuestions]);
  }

  function wrongBookQuestions() {
    const status = $("#bank-wrong-status").value;
    const sort = $("#bank-wrong-sort").value;
    const entries = [...wrongBook.values()].filter((entry) => {
      if (status === "all") return true;
      if (status === "active") return entry.status !== "mastered";
      return entry.status === status;
    });
    entries.sort((first, second) => {
      if (sort === "wrong-count") return second.wrongCount - first.wrongCount || second.lastReviewedAt - first.lastReviewedAt;
      if (sort === "oldest") return first.lastReviewedAt - second.lastReviewedAt;
      return second.lastReviewedAt - first.lastReviewedAt;
    });
    return entries.map((entry) => entry.question);
  }

  function sourceQuestions() {
    const source = $("#bank-source").value;
    if (source === "builtin") return builtInQuestions;
    if (source === "history") return aiHistory;
    if (source === "cloud") return cloudQuestions;
    if (source === "wrong") return wrongBookQuestions();
    if (source === "favorite") return allQuestions().filter((item) => favorites.has(String(item.id)));
    return allQuestions();
  }

  function filteredQuestions() {
    const profile = $("#school-profile").value;
    const chapter = $("#bank-chapter").value;
    const type = $("#bank-type").value;
    const difficulty = $("#bank-difficulty").value;
    const query = $("#bank-search").value.trim().toLowerCase();
    return sourceQuestions().filter((item) => {
      const schoolMatch = profile === "all" || !item.schools || item.schools.includes(profile);
      const text = [item.question, item.answer, item.chapter, ...(item.keywords || [])].join(" ").toLowerCase();
      return schoolMatch && (chapter === "all" || item.chapter === chapter) && (type === "all" || item.type === type) && (difficulty === "all" || item.difficulty === difficulty) && (!query || text.includes(query));
    });
  }

  function shuffle(values) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function saveDraft() {
    const item = queue[queueIndex];
    const input = $("#bank-user-answer");
    if (item && input) drafts.set(item.id, input.value);
  }

  const ratingLabels = { wrong: "不会", partial: "模糊", mastered: "掌握" };
  const statusLabels = { unmastered: "待攻克", reviewing: "复习中", mastered: "已掌握" };

  function ratingValue(rating) {
    return rating === "mastered" ? 1 : rating === "partial" ? 0.5 : 0;
  }

  function profileAttempts() {
    const profile = $("#school-profile").value;
    return attemptHistory.filter((attempt) => profile === "all" || !attempt.schools.length || attempt.schools.includes(profile));
  }

  function summarizeAttempts(records) {
    if (!records.length) return { score: null, attempts: 0, unique: 0, trend: null };
    const byQuestion = new Map();
    records.forEach((record) => {
      if (!byQuestion.has(record.questionId)) byQuestion.set(record.questionId, []);
      byQuestion.get(record.questionId).push(record);
    });
    let weightedScore = 0;
    let totalWeight = 0;
    byQuestion.forEach((values) => {
      values.sort((first, second) => second.timestamp - first.timestamp).slice(0, 5).forEach((record, index) => {
        const weight = Math.pow(0.72, index);
        weightedScore += ratingValue(record.rating) * weight;
        totalWeight += weight;
      });
    });
    const ordered = records.slice().sort((first, second) => second.timestamp - first.timestamp);
    const recent = ordered.slice(0, 5);
    const previous = ordered.slice(5, 10);
    const average = (values) => values.reduce((sum, record) => sum + ratingValue(record.rating), 0) / Math.max(1, values.length);
    const trend = previous.length ? Math.round((average(recent) - average(previous)) * 100) : null;
    return { score: Math.round(weightedScore / totalWeight * 100), attempts: records.length, unique: byQuestion.size, trend };
  }

  function latestAttempt(questionId) {
    for (let index = attemptHistory.length - 1; index >= 0; index -= 1) {
      if (attemptHistory[index].questionId === String(questionId)) return attemptHistory[index];
    }
    return null;
  }

  function createWrongEntry(item, timestamp) {
    return {
      id: String(item.id),
      question: normalizeQuestion(item, 0),
      status: "unmastered",
      wrongCount: 0,
      partialCount: 0,
      reviewCount: 0,
      correctStreak: 0,
      note: "",
      firstWrongAt: timestamp,
      lastReviewedAt: timestamp,
      lastRating: "wrong"
    };
  }

  function recordAttempt(item, rating) {
    if (!item || !ratingLabels[rating]) return;
    const timestamp = Date.now();
    attemptHistory.push(normalizeAttempt({
      questionId: item.id,
      rating,
      timestamp,
      chapter: item.chapter,
      type: item.type,
      difficulty: item.difficulty,
      keywords: item.keywords,
      schools: item.schools,
      source: item.source
    }));
    attemptHistory = attemptHistory.slice(-1500);
    writeStorage(ATTEMPTS_KEY, attemptHistory);

    let entry = wrongBook.get(String(item.id));
    if (rating !== "mastered" && !entry) entry = createWrongEntry(item, timestamp);
    if (entry) {
      entry.question = normalizeQuestion(item, 0);
      entry.reviewCount += 1;
      entry.lastReviewedAt = timestamp;
      entry.lastRating = rating;
      if (rating === "wrong") {
        entry.wrongCount += 1;
        entry.correctStreak = 0;
        entry.status = "unmastered";
      } else if (rating === "partial") {
        entry.partialCount += 1;
        entry.correctStreak = 0;
        entry.status = "reviewing";
      } else {
        entry.correctStreak += 1;
        entry.status = entry.correctStreak >= 2 ? "mastered" : "reviewing";
      }
      wrongBook.set(entry.id, entry);
      saveWrongBook();
    }
    renderQuestion();
    renderMasteryDashboard();
  }

  function toggleWrongEntry(item) {
    const id = String(item.id);
    if (wrongBook.has(id)) {
      wrongBook.delete(id);
      saveWrongBook();
      renderQuestion();
      renderMasteryDashboard();
      return;
    }
    recordAttempt(item, "wrong");
  }

  function formatReviewDate(timestamp) {
    if (!timestamp) return "尚未复习";
    return new Date(timestamp).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  }

  function updateStats() {
    const total = allQuestions().length;
    const available = $("#bank-source").value === "ai" ? total : filteredQuestions().length;
    const activeWrong = [...wrongBook.values()].filter((entry) => entry.status !== "mastered").length;
    const mastery = summarizeAttempts(profileAttempts()).score;
    $("#bank-source-all").textContent = "总题库（" + total + "题）";
    $("#bank-source-builtin").textContent = "内置题库（" + builtInQuestions.length + "题）";
    $("#bank-source-history").textContent = "AI题库（" + aiHistory.length + "题）";
    $("#bank-source-wrong").textContent = "错题本（" + wrongBook.size + "题）";
    $("#bank-source-favorite").textContent = "收藏题库（" + favorites.size + "题）";
    $("#bank-stat-strip").innerHTML = '<div><strong>' + available + '</strong><span>当前可练</span></div><div><strong>' + total + '</strong><span>总题库</span></div><div><strong>' + activeWrong + '</strong><span>待复习错题</span></div><div><strong>' + (mastery == null ? "--" : mastery + "%") + '</strong><span>综合掌握率</span></div>';
  }

  function currentQuestion() {
    return queue[queueIndex] || null;
  }

  function renderQuestion() {
    const item = currentQuestion();
    updateStats();
    if (!item) {
      $("#practice-question-card").innerHTML = '<div class="bank-empty-state"><strong>选择题库范围后开始练习</strong><span>内置题无需联网；AI出题需要通过本地服务连接模型接口。</span></div>';
      $("#practice-actions").hidden = true;
      return;
    }
    const tool = chapterToolMap[item.chapter];
    const tags = [item.chapter, item.type, item.difficulty].filter(Boolean).map((value) => "<span>" + escapeHtml(value) + "</span>").join("");
    const keywords = (item.keywords || []).map((keyword) => "<b>" + escapeHtml(keyword) + "</b>").join("");
    const options = (item.options || []).length ? '<ol class="exam-options" type="A">' + item.options.map((option) => "<li>" + examText(option) + "</li>").join("") + "</ol>" : "";
    const wrongEntry = wrongBook.get(String(item.id));
    const recent = latestAttempt(item.id);
    const wrongMeta = wrongEntry ? '<div class="wrong-book-meta"><strong class="wrong-status is-' + wrongEntry.status + '">' + statusLabels[wrongEntry.status] + '</strong><span>错误 ' + wrongEntry.wrongCount + ' 次</span><span>模糊 ' + wrongEntry.partialCount + ' 次</span><span>复习 ' + wrongEntry.reviewCount + ' 次</span><span>最近 ' + formatReviewDate(wrongEntry.lastReviewedAt) + '</span></div>' : "";
    const assessment = '<div class="question-assessment"><div><strong>本次掌握情况</strong><span>' + (recent ? "最近记录：" + ratingLabels[recent.rating] : "尚未记录") + '</span></div><div class="assessment-segmented" role="group" aria-label="本题掌握情况"><button type="button" data-bank-rating="wrong" class="' + (recent && recent.rating === "wrong" ? "is-active" : "") + '">不会</button><button type="button" data-bank-rating="partial" class="' + (recent && recent.rating === "partial" ? "is-active" : "") + '">模糊</button><button type="button" data-bank-rating="mastered" class="' + (recent && recent.rating === "mastered" ? "is-active" : "") + '">掌握</button></div></div>';
    const wrongNote = wrongEntry ? '<label class="wrong-note-field"><span>错因 / 复盘</span><textarea data-bank-wrong-note rows="2" placeholder="记录错因、易混点或下次检查项">' + escapeHtml(wrongEntry.note) + "</textarea></label>" : "";
    const solution = answerVisible ? '<div class="practice-solution"><h4>参考答案</h4><div class="solution-answer math-content">' + examText(item.answer) + '</div><h4>解析</h4><div class="solution-analysis math-content">' + examText(item.analysis) + '</div><div class="keyword-list">' + keywords + "</div>" + (tool ? '<button type="button" class="table-tool-button" data-bank-open-tool="' + tool + '">打开对应计算器</button>' : "") + assessment + wrongNote + "</div>" : '<div class="answer-placeholder">完成作答后再展开答案与解析</div>';
    $("#practice-question-card").innerHTML = '<div class="exam-paper-heading"><div><strong>第 ' + (queueIndex + 1) + ' 题</strong><span>（本题 ' + suggestedScore(item) + ' 分）</span></div><small>' + escapeHtml(item.source) + " · " + (queueIndex + 1) + " / " + queue.length + '</small></div><div class="practice-tags">' + tags + "</div>" + wrongMeta + '<div class="exam-question-body math-content">' + examText(item.question) + '</div><label class="field practice-answer-field"><span class="exam-answer-label">解：</span><textarea id="bank-user-answer" rows="6" placeholder="在此书写解题过程"></textarea></label>' + solution;
    if (options) $(".exam-question-body", $("#practice-question-card")).insertAdjacentHTML("beforeend", options);
    $("#bank-user-answer").value = drafts.get(item.id) || "";
    renderExamMath($("#practice-question-card"));
    $("#practice-actions").hidden = false;
    $("#bank-reveal").textContent = answerVisible ? "隐藏答案与解析" : "显示答案与解析";
    $("#bank-favorite").textContent = favorites.has(item.id) ? "取消收藏" : "收藏";
    $("#bank-wrong").textContent = wrongQuestions.has(item.id) ? "移出错题" : "标记错题";
  }

  function startPractice() {
    const candidates = filteredQuestions();
    if (!candidates.length) {
      queue = [];
      renderQuestion();
      $("#practice-question-card").innerHTML = '<div class="bank-empty-state"><strong>没有符合条件的题目</strong><span>请调整章节、题型、难度或搜索词。</span></div>';
      return;
    }
    const countValue = $("#bank-count").value;
    const count = countValue === "all" ? candidates.length : Math.min(candidates.length, Number(countValue));
    queue = ($("#bank-source").value === "wrong" ? candidates.slice() : shuffle(candidates)).slice(0, count);
    queueIndex = 0;
    answerVisible = false;
    renderQuestion();
  }

  function moveQuestion(offset) {
    if (!queue.length) return;
    saveDraft();
    queueIndex = (queueIndex + offset + queue.length) % queue.length;
    answerVisible = false;
    renderQuestion();
  }

  function toggleSet(set, key, storageKey) {
    if (set.has(key)) set.delete(key); else set.add(key);
    writeStorage(storageKey, [...set]);
    renderQuestion();
  }

  function masteryLevel(score) {
    if (score >= 85) return { label: "已掌握", className: "strong" };
    if (score >= 65) return { label: "较稳定", className: "stable" };
    if (score >= 40) return { label: "较薄弱", className: "weak" };
    return { label: "待补强", className: "critical" };
  }

  function dimensionRows(records, dimension) {
    const groups = new Map();
    records.forEach((record) => {
      const values = dimension === "keywords" ? (record.keywords.length ? record.keywords : [record.chapter]) : [record[dimension]];
      [...new Set(values.filter(Boolean))].forEach((value) => {
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(record);
      });
    });
    return [...groups.entries()].map(([name, values]) => ({ name, ...summarizeAttempts(values) })).sort((first, second) => {
      return (first.score == null ? 101 : first.score) - (second.score == null ? 101 : second.score) || second.attempts - first.attempts || first.name.localeCompare(second.name, "zh-CN");
    });
  }

  function trendText(trend) {
    if (trend == null) return "趋势待积累";
    if (trend >= 5) return "近期 +" + trend + "%";
    if (trend <= -5) return "近期 " + trend + "%";
    return "近期稳定";
  }

  function renderMasteryRows(title, rows, limit) {
    const visibleRows = rows.slice(0, limit);
    return '<section class="mastery-dimension"><div class="mastery-dimension-heading"><h3>' + title + '</h3><span>' + rows.length + ' 项</span></div>' + (visibleRows.length ? '<div class="mastery-row-list">' + visibleRows.map((row) => {
      const level = masteryLevel(row.score);
      return '<div class="mastery-row"><div class="mastery-row-heading"><strong>' + escapeHtml(row.name) + '</strong><span>' + row.score + '% · ' + level.label + '</span></div><div class="mastery-progress" aria-label="' + escapeHtml(row.name) + '掌握率' + row.score + '%"><i class="is-' + level.className + '" style="width:' + row.score + '%"></i></div><small>作答 ' + row.attempts + ' 次 · 覆盖 ' + row.unique + ' 题 · ' + trendText(row.trend) + '</small></div>';
    }).join("") + '</div>' : '<div class="mastery-empty">暂无该维度的作答记录</div>') + "</section>";
  }

  function renderMasteryDashboard() {
    const container = $("#mastery-dashboard");
    if (!container) return;
    const records = profileAttempts();
    const profile = $("#school-profile").value;
    const questions = allQuestions().filter((item) => profile === "all" || !item.schools || item.schools.includes(profile));
    const overall = summarizeAttempts(records);
    const coverage = questions.length ? Math.min(100, Math.round(overall.unique / questions.length * 100)) : 0;
    const activeWrong = [...wrongBook.values()].filter((entry) => {
      const item = entry.question;
      return entry.status !== "mastered" && (profile === "all" || !item.schools || item.schools.includes(profile));
    });
    const recentCount = records.filter((record) => record.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;

    if (!records.length) {
      container.innerHTML = '<div class="mastery-empty-state"><strong>还没有掌握度记录</strong><span>完成题目并选择“不会、模糊或掌握”后，这里会形成多维学习分析。</span><button type="button" class="primary-button" data-master-action="practice">开始练习</button></div>';
      return;
    }

    const chapterRows = dimensionRows(records, "chapter");
    const knowledgeRows = dimensionRows(records, "keywords");
    const typeRows = dimensionRows(records, "type");
    const difficultyRows = dimensionRows(records, "difficulty");
    const weakestKnowledge = knowledgeRows[0];
    const weakestChapter = chapterRows[0];
    const recommendation = activeWrong.length
      ? "优先复习 " + activeWrong.length + " 道待攻克错题"
      : weakestKnowledge && weakestKnowledge.score < 75
        ? "优先补强“" + weakestKnowledge.name + "”"
        : "继续混合练习以扩大知识覆盖";
    const recommendationActions = (activeWrong.length ? '<button type="button" class="secondary-button" data-master-action="wrong">进入错题本</button>' : "") + (weakestKnowledge ? '<button type="button" class="secondary-button" data-master-keyword="' + encodeURIComponent(weakestKnowledge.name) + '">练习薄弱知识点</button>' : "");

    container.innerHTML = '<div class="mastery-dashboard-heading"><div><p class="section-index">LEARNING ANALYTICS</p><h2>知识掌握分析</h2></div><span>基于 ' + overall.attempts + ' 次自评</span></div><div class="mastery-summary"><div><strong>' + overall.score + '%</strong><span>综合掌握率</span></div><div><strong>' + coverage + '%</strong><span>题库覆盖率</span></div><div><strong>' + activeWrong.length + '</strong><span>待复习错题</span></div><div><strong>' + recentCount + '</strong><span>近7天作答</span></div></div><div class="mastery-recommendation"><div><strong>当前建议</strong><span>' + escapeHtml(recommendation) + (weakestChapter ? '；章节薄弱项为“' + escapeHtml(weakestChapter.name) + '”' : "") + '</span></div><div>' + recommendationActions + '</div></div><div class="mastery-dimension-grid">' + renderMasteryRows("章节掌握", chapterRows, 12) + renderMasteryRows("知识点掌握", knowledgeRows, 12) + renderMasteryRows("题型掌握", typeRows, 8) + renderMasteryRows("难度掌握", difficultyRows, 6) + "</div>";
  }

  function switchWorkspaceView(view) {
    $$('[data-bank-workspace-view]').forEach((button) => {
      const active = button.dataset.bankWorkspaceView === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $$('[data-bank-workspace-panel]').forEach((panel) => { panel.hidden = panel.dataset.bankWorkspacePanel !== view; });
    if (view === "analysis") renderMasteryDashboard();
  }

  function practiceMasteryRecommendation(keyword) {
    switchWorkspaceView("practice");
    $("#bank-source").value = "all";
    $("#bank-source").dispatchEvent(new Event("change"));
    $("#bank-search").value = keyword || "";
    updateStats();
    startPractice();
  }

  function settingsWithoutKey() {
    return {
      version: 2,
      provider: $("#ai-provider").value,
      baseUrl: $("#ai-base-url").value,
      model: $("#ai-provider").value === "micu" ? $("#ai-micu-model").value : $("#ai-model").value,
      protocol: $("#ai-protocol").value,
      authMode: $("#ai-auth-mode").value
    };
  }

  function applyProviderPreset(provider, preserveCustom) {
    const preset = providerPresets[provider];
    $("#ai-base-url").placeholder = provider === "relay"
      ? "中转站提供的API Base，例如 https://域名/v1"
      : "API Base或完整接口地址";
    $("#ai-model").placeholder = provider === "relay" ? "填写中转站模型列表中的准确名称" : "模型名称";
    if (preset) {
      $("#ai-base-url").value = preset.baseUrl;
      $("#ai-model").value = preset.model;
      $("#ai-micu-model").innerHTML = '<option value="">请先读取可用模型</option>';
      $("#ai-protocol").value = preset.protocol;
      $("#ai-auth-mode").value = preset.authMode || "bearer";
    } else if (!preserveCustom) {
      $("#ai-base-url").value = "";
      $("#ai-model").value = "";
      $("#ai-micu-model").innerHTML = '<option value="">请先读取可用模型</option>';
      $("#ai-protocol").value = "chat";
      $("#ai-auth-mode").value = "bearer";
    }
    updateProviderVisibility(provider);
    writeStorage(SETTINGS_KEY, settingsWithoutKey());
  }

  function updateProviderVisibility(provider) {
    const simpleMicu = provider === "micu";
    $$('[data-ai-advanced]').forEach((element) => { element.hidden = simpleMicu; });
    $("#ai-preset-note").hidden = !simpleMicu;
    $("#ai-api-key").placeholder = simpleMicu ? "填写 Micu 的 sk-xxx 密钥" : "sk-…";
    $("#ai-model-grid").classList.toggle("single-field-grid", simpleMicu);
    $("#ai-model-label").innerHTML = simpleMicu ? "模型 <em>按Key读取</em>" : "模型";
    $("#ai-model").hidden = simpleMicu;
    $("#ai-micu-model").hidden = !simpleMicu;
    $("#ai-fetch-models").hidden = !simpleMicu;
    if (!simpleMicu) $("#ai-model-status").textContent = "";
  }

  function micuModelLabel(model) {
    if (/^glm-5\.2-fast$/i.test(model)) return model + "（实测约2-3分钟）";
    if (/^kimi-k2\.7-code$/i.test(model)) return model + "（可能超过3分钟）";
    return model;
  }

  function updateMicuLoadHint() {
    if ($("#ai-provider").value !== "micu") return;
    const model = $("#ai-micu-model").value;
    const count = Number($("#ai-count").value);
    if (/^kimi[-_.]/i.test(model) && count > 1) {
      $("#ai-model-status").textContent = "Kimi批量生成容易触发上游500，建议先选择1题";
    }
  }

  async function fetchMicuModels() {
    const button = $("#ai-fetch-models");
    const status = $("#ai-model-status");
    const apiKey = $("#ai-api-key").value.trim();
    status.textContent = "正在读取…";
    button.disabled = true;
    try {
      const response = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "micu", baseUrl: $("#ai-base-url").value, apiKey })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "读取模型列表失败");
      const models = Array.isArray(payload.models) ? payload.models : [];
      const previousModel = $("#ai-micu-model").value || $("#ai-model").value;
      $("#ai-micu-model").innerHTML = models.map((model) => '<option value="' + escapeHtml(model) + '">' + escapeHtml(micuModelLabel(model)) + '</option>').join("");
      $("#ai-micu-model").value = models.includes(previousModel) ? previousModel : models[0] || "";
      status.textContent = "已读取 " + models.length + " 个可用模型";
      updateMicuLoadHint();
      return models;
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取模型列表失败";
      status.textContent = message + "；请确认中转站 Key 有效且有模型列表权限，或直接保留/手动选择已有模型。";
      return [];
    } finally {
      button.disabled = false;
    }
  }

  async function checkAiServer() {
    const status = $("#ai-server-status");
    if (location.protocol === "file:") {
      status.className = "ai-server-status warning";
      status.innerHTML = '<span></span><strong>AI模式需双击 start-ai.cmd 后使用 http://127.0.0.1:4173</strong>';
      return false;
    }
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error();
      status.className = "ai-server-status ready";
      status.innerHTML = '<span></span><strong>AI代理已连接</strong>';
      return true;
    } catch (_) {
      status.className = "ai-server-status warning";
      status.innerHTML = '<span></span><strong>AI代理未连接，请通过 server.js 启动页面</strong>';
      return false;
    }
  }

  function setAiError(message) {
    const element = $("#ai-generate-error");
    element.textContent = message || "";
    element.hidden = !message;
  }

  async function generateAiQuestions() {
    setAiError("");
    const button = $("#ai-generate");
    const generationStatus = $("#ai-generation-status");
    const connected = await checkAiServer();
    if (!connected) {
      setAiError("请先双击 start-ai.cmd，并在打开的本地网页中使用AI出题。");
      return;
    }
    button.disabled = true;
    const startedAt = Date.now();
    const maxWaitMinutes = $("#ai-provider").value === "micu" ? 5 : Number($("#ai-count").value) === 1 ? 3 : 5;
    const updateElapsed = () => {
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      button.querySelector("span").textContent = "AI正在命题 · " + seconds + "秒";
      generationStatus.textContent = "正在等待模型生成，最长等待 " + maxWaitMinutes + " 分钟，请勿重复提交";
    };
    updateElapsed();
    const elapsedTimer = setInterval(updateElapsed, 1000);
    try {
      if ($("#ai-provider").value === "micu" && !$("#ai-micu-model").value) {
        const models = await fetchMicuModels();
        if (!models.length || !$("#ai-micu-model").value) throw new Error($("#ai-model-status").textContent || "没有可用模型");
      }
      const profile = $("#school-profile").value;
      const response = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settingsWithoutKey(),
          apiKey: $("#ai-api-key").value,
          criteria: {
            school: profile === "all" ? "浙江工大828与杭电861" : profile,
            chapter: $("#ai-chapter").value,
            type: $("#ai-type").value,
            difficulty: $("#ai-difficulty").value,
            count: Number($("#ai-count").value),
            extra: $("#ai-extra").value
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "AI出题请求失败");
      const generated = (payload.questions || []).map((item, index) => normalizeQuestion({ ...item, schools: profile === "all" ? ["828", "861"] : [profile] }, index));
      if (!generated.length) throw new Error("AI没有返回题目");
      aiHistory = generated.concat(aiHistory).slice(0, 500);
      writeStorage(HISTORY_KEY, aiHistory);
      generated.forEach((item) => {
        if (!$$('#bank-chapter option').some((option) => option.value === item.chapter)) {
          $("#bank-chapter").insertAdjacentHTML("beforeend", '<option value="' + escapeHtml(item.chapter) + '">' + escapeHtml(item.chapter) + "</option>");
        }
      });
      queue = generated;
      queueIndex = 0;
      answerVisible = false;
      renderQuestion();
      renderMasteryDashboard();
      const notice = generated.find((item) => item.generationNotice)?.generationNotice;
      generationStatus.textContent = (notice ? notice + " " : "生成完成，") + "用时 " + Math.max(1, Math.round((Date.now() - startedAt) / 1000)) + " 秒";
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI出题失败");
      generationStatus.textContent = "请求结束，用时 " + Math.max(1, Math.round((Date.now() - startedAt) / 1000)) + " 秒";
    } finally {
      clearInterval(elapsedTimer);
      button.disabled = false;
      button.querySelector("span").textContent = "AI生成原创题";
    }
  }

  installModeSwitch();
  const savedSettings = readStorage(SETTINGS_KEY, {});
  if (savedSettings.provider === "micu" && savedSettings.version !== 2 && savedSettings.model === "gpt-5.6-sol") {
    savedSettings.model = "";
  }
  $("#ai-provider").value = savedSettings.provider || "openai";
  if (savedSettings.baseUrl && savedSettings.model) {
    $("#ai-base-url").value = savedSettings.baseUrl;
    $("#ai-model").value = savedSettings.model;
    if (savedSettings.provider === "micu") $("#ai-micu-model").innerHTML = '<option value="' + escapeHtml(savedSettings.model) + '">' + escapeHtml(savedSettings.model) + "</option>";
    $("#ai-protocol").value = savedSettings.protocol || "chat";
    $("#ai-auth-mode").value = savedSettings.authMode || "bearer";
    updateProviderVisibility($("#ai-provider").value);
  } else {
    applyProviderPreset($("#ai-provider").value, false);
  }

  $("#ai-provider").addEventListener("change", () => applyProviderPreset($("#ai-provider").value, false));
  ["#ai-base-url", "#ai-model", "#ai-micu-model", "#ai-protocol", "#ai-auth-mode"].forEach((selector) => $(selector).addEventListener("change", () => writeStorage(SETTINGS_KEY, settingsWithoutKey())));
  $("#bank-start").addEventListener("click", startPractice);
  $("#bank-previous").addEventListener("click", () => moveQuestion(-1));
  $("#bank-next").addEventListener("click", () => moveQuestion(1));
  $("#bank-reveal").addEventListener("click", () => { saveDraft(); answerVisible = !answerVisible; renderQuestion(); });
  $("#bank-favorite").addEventListener("click", () => { const item = currentQuestion(); if (item) { saveDraft(); toggleSet(favorites, item.id, FAVORITES_KEY); } });
  $("#bank-wrong").addEventListener("click", () => { const item = currentQuestion(); if (item) { saveDraft(); toggleWrongEntry(item); } });
  $("#ai-generate").addEventListener("click", generateAiQuestions);
  $("#ai-fetch-models").addEventListener("click", fetchMicuModels);
  $("#ai-micu-model").addEventListener("change", updateMicuLoadHint);
  $("#ai-count").addEventListener("change", updateMicuLoadHint);
  $("#bank-clear-history").addEventListener("click", () => {
    aiHistory = [];
    writeStorage(HISTORY_KEY, aiHistory);
    queue = [];
    renderQuestion();
    renderMasteryDashboard();
    $("#bank-clear-history").hidden = true;
  });
  $("#practice-question-card").addEventListener("click", (event) => {
    const ratingButton = event.target.closest("[data-bank-rating]");
    if (ratingButton) {
      const item = currentQuestion();
      if (item) { saveDraft(); recordAttempt(item, ratingButton.dataset.bankRating); }
      return;
    }
    const button = event.target.closest("[data-bank-open-tool]");
    if (button) $('[data-tool="' + button.dataset.bankOpenTool + '"]').click();
  });
  $("#practice-question-card").addEventListener("input", (event) => {
    const note = event.target.closest("[data-bank-wrong-note]");
    const item = currentQuestion();
    const entry = item && wrongBook.get(String(item.id));
    if (note && entry) {
      entry.note = note.value.slice(0, 1000);
      wrongBook.set(entry.id, entry);
      saveWrongBook();
    }
  });
  $$('[data-bank-workspace-view]').forEach((button) => button.addEventListener("click", () => switchWorkspaceView(button.dataset.bankWorkspaceView)));
  $("#mastery-dashboard").addEventListener("click", (event) => {
    const action = event.target.closest("[data-master-action]");
    if (action) {
      if (action.dataset.masterAction === "wrong") {
        switchWorkspaceView("practice");
        $("#bank-source").value = "wrong";
        $("#bank-source").dispatchEvent(new Event("change"));
        $("#bank-wrong-status").value = "active";
        startPractice();
      } else {
        practiceMasteryRecommendation("");
      }
      return;
    }
    const keywordButton = event.target.closest("[data-master-keyword]");
    if (keywordButton) practiceMasteryRecommendation(decodeURIComponent(keywordButton.dataset.masterKeyword));
  });
  $("#school-profile").addEventListener("change", () => { updateStats(); renderMasteryDashboard(); });
  ["#bank-search", "#bank-chapter", "#bank-type", "#bank-difficulty", "#bank-wrong-status", "#bank-wrong-sort"].forEach((selector) => $(selector).addEventListener(selector === "#bank-search" ? "input" : "change", updateStats));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.closest("#tool-question-bank")) startPractice();
  });

  saveWrongBook();
  updateStats();
  renderQuestion();
  renderMasteryDashboard();
  loadCloudQuestions();
})();
