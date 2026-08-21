(function () {
  "use strict";

  const data = window.ControlKnowledgeTree || { chapters: [], resources: {} };
  const chapters = data.chapters || [];
  const nodes = chapters.flatMap((chapter) => chapter.nodes.map((node) => ({ ...node, chapterId: chapter.id, chapterTitle: chapter.title })));
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const PROGRESS_KEY = "control-knowledge-progress-v1";
  const progress = readProgress();
  let activeNodeId = nodes[0] ? nodes[0].id : "";
  let activeChapterId = chapters[0] ? chapters[0].id : "";

  function readProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) {
      return {};
    }
  }

  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (_) { /* Storage may be disabled. */ }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function formatText(value) {
    const raw = String(value == null ? "" : value);
    const math = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\$)(?:\\.|[^$\r\n])+\$/g;
    let result = "";
    let cursor = 0;
    let match;
    while ((match = math.exec(raw)) !== null) {
      result += escapeHtml(raw.slice(cursor, match.index)).replace(/\r\n?|\n/g, "<br>");
      result += escapeHtml(match[0].replace(/\r\n?|\n/g, " "));
      cursor = match.index + match[0].length;
    }
    return result + escapeHtml(raw.slice(cursor)).replace(/\r\n?|\n/g, "<br>");
  }

  function renderMath(container) {
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

  function statusOf(node) {
    return progress[node.id] && ["learning", "mastered"].includes(progress[node.id].status) ? progress[node.id].status : "unread";
  }

  function statusLabel(status) {
    return status === "mastered" ? "已掌握" : status === "learning" ? "学习中" : "未开始";
  }

  function completionStats() {
    const started = nodes.filter((node) => statusOf(node) !== "unread").length;
    const mastered = nodes.filter((node) => statusOf(node) === "mastered").length;
    return { started, mastered, total: nodes.length, percent: nodes.length ? Math.round(mastered / nodes.length * 100) : 0 };
  }

  function addView() {
    $("#module-nav").insertAdjacentHTML("beforeend", '<button type="button" class="module-link" data-tool="knowledge-tree" data-schools="828,861"><span class="module-number">14</span><span><strong>知识树学习</strong><small>知识点、例题与学习进度</small></span></button>');
    $(".platform-main").insertAdjacentHTML("beforeend", `
      <section class="tool-view knowledge-tree-view" id="tool-knowledge-tree" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">14 · KNOWLEDGE TREE</p><h2>知识树学习</h2><p>按考研大纲拆解 37 个知识点，配套公式、步骤、易错点、原创例题与公开资源。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="knowledge-layout">
          <aside class="knowledge-tree-panel">
            <div class="knowledge-progress-summary" id="knowledge-progress-summary"></div>
            <label class="field"><span class="field-label">搜索知识点</span><input id="knowledge-search" name="knowledge-query" type="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="例如：根轨迹、Lyapunov、Bode"></label>
            <div class="knowledge-filter-row"><button type="button" class="knowledge-filter is-active" data-knowledge-filter="all">全部</button><button type="button" class="knowledge-filter" data-knowledge-filter="unread">未开始</button><button type="button" class="knowledge-filter" data-knowledge-filter="learning">学习中</button><button type="button" class="knowledge-filter" data-knowledge-filter="mastered">已掌握</button></div>
            <div class="knowledge-tree" id="knowledge-tree-list"></div>
          </aside>
          <article class="knowledge-lesson" id="knowledge-lesson"></article>
        </div>
      </section>`);
  }

  function nodeMatches(node, query, filter) {
    const text = [node.title, node.chapterTitle, node.overview, node.query, ...(node.objectives || []), ...(node.keyPoints || [])].join(" ").toLowerCase();
    return (!query || text.includes(query)) && (filter === "all" || statusOf(node) === filter);
  }

  function renderProgressSummary() {
    const stats = completionStats();
    $("#knowledge-progress-summary").innerHTML = '<div class="knowledge-progress-numbers"><strong>' + stats.percent + '%</strong><span>整体掌握</span><small>' + stats.mastered + ' / ' + stats.total + ' 个节点</small></div><div class="knowledge-progress-bar"><i style="width:' + stats.percent + '%"></i></div><div class="knowledge-progress-meta"><span>已开始 ' + stats.started + '</span><span>剩余 ' + (stats.total - stats.mastered) + '</span></div>';
  }

  function renderTree() {
    const query = $("#knowledge-search").value.trim().toLowerCase();
    const filterButton = $(".knowledge-filter.is-active");
    const filter = filterButton ? filterButton.dataset.knowledgeFilter : "all";
    const html = chapters.map((chapter) => {
      const visible = chapter.nodes.filter((node) => nodeMatches({ ...node, chapterTitle: chapter.title }, query, filter));
      if (!visible.length) return "";
      const chapterDone = chapter.nodes.filter((node) => statusOf(node) === "mastered").length;
      const open = chapter.id === activeChapterId || Boolean(query) || filter !== "all";
      return '<section class="knowledge-chapter ' + (open ? "is-open" : "") + '"><button type="button" class="knowledge-chapter-toggle" data-knowledge-chapter="' + escapeHtml(chapter.id) + '"><span><strong>' + escapeHtml(chapter.title) + '</strong><small>' + chapterDone + ' / ' + chapter.nodes.length + ' 已掌握</small></span><b aria-hidden="true">+</b></button><div class="knowledge-node-list">' + visible.map((node) => '<button type="button" class="knowledge-node ' + (node.id === activeNodeId ? "is-active " : "") + 'is-' + statusOf(node) + '" data-knowledge-node="' + escapeHtml(node.id) + '"><span class="knowledge-node-dot"></span><span><strong>' + escapeHtml(node.title) + '</strong><small>' + escapeHtml(node.type) + ' · ' + escapeHtml(statusLabel(statusOf(node))) + '</small></span></button>').join("") + '</div></section>';
    }).join("");
    $("#knowledge-tree-list").innerHTML = html || '<div class="knowledge-no-results">没有符合当前筛选的知识点</div>';
    $$(".knowledge-chapter-toggle").forEach((button) => button.addEventListener("click", () => {
      const chapter = button.closest(".knowledge-chapter");
      chapter.classList.toggle("is-open");
      activeChapterId = button.dataset.knowledgeChapter;
    }));
    $$("[data-knowledge-node]").forEach((button) => button.addEventListener("click", () => {
      activeNodeId = button.dataset.knowledgeNode;
      const node = nodes.find((item) => item.id === activeNodeId);
      activeChapterId = node ? node.chapterId : activeChapterId;
      renderTree();
      renderLesson();
    }));
  }

  function renderFormula(formula) {
    return '<div class="knowledge-formula"><div class="knowledge-formula-math">$$' + escapeHtml(formula.latex) + '$$</div><p>' + formatText(formula.note || "") + '</p></div>';
  }

  function renderExample(example) {
    if (!example) return "";
    return '<section class="knowledge-example"><div class="knowledge-section-heading"><span>原创例题</span><small>按考试答题步骤组织</small></div><div class="knowledge-example-problem">' + formatText(example.problem) + '</div><ol>' + (example.steps || []).map((step) => '<li>' + formatText(step) + '</li>').join("") + '</ol><div class="knowledge-example-answer"><strong>结论</strong><span>' + formatText(example.answer) + '</span></div></section>';
  }

  function renderResources(node) {
    const resources = (node.resources || []).map((id) => data.resources[id]).filter(Boolean);
    if (!resources.length) return "";
    return '<section class="knowledge-resources"><div class="knowledge-section-heading"><span>公开延伸资源</span><small>外部链接可能随网站调整</small></div><div class="knowledge-resource-list">' + resources.map((resource) => '<a href="' + escapeHtml(resource.url) + '" target="_blank" rel="noreferrer noopener"><strong>' + escapeHtml(resource.title) + '</strong><span>' + escapeHtml(resource.description) + '</span></a>').join("") + '</div></section>';
  }

  function renderLesson() {
    const node = nodes.find((item) => item.id === activeNodeId) || nodes[0];
    if (!node) return;
    const status = statusOf(node);
    const stats = completionStats();
    const prerequisiteNodes = (node.prerequisites || []).map((id) => nodes.find((item) => item.id === id)).filter(Boolean);
    const nextNode = nodes[nodes.findIndex((item) => item.id === node.id) + 1];
    $("#knowledge-lesson").innerHTML = '<header class="knowledge-lesson-heading"><div><p class="section-index">' + escapeHtml(node.chapterTitle) + ' · ' + escapeHtml(node.type) + '</p><h2>' + escapeHtml(node.title) + '</h2><p>' + formatText(node.overview) + '</p></div><div class="knowledge-lesson-meta"><span class="knowledge-status is-' + status + '">' + statusLabel(status) + '</span><small>整体进度 ' + stats.percent + '%</small></div></header><div class="knowledge-lesson-actions"><button type="button" class="primary-button" data-knowledge-status="learning">开始学习</button><button type="button" class="secondary-button" data-knowledge-status="mastered">标记已掌握</button><button type="button" class="secondary-button" data-knowledge-action="practice">进入专项练习</button>' + (node.tool ? '<button type="button" class="secondary-button" data-knowledge-action="tool">打开计算器</button>' : "") + '</div><div class="knowledge-prerequisites"><strong>学习路径</strong><span>' + (prerequisiteNodes.length ? prerequisiteNodes.map((item) => '<button type="button" data-knowledge-node="' + escapeHtml(item.id) + '">' + escapeHtml(item.title) + '</button>').join('<i>→</i>') : "无前置节点，可直接开始") + '</span></div><div class="knowledge-lesson-grid"><section class="knowledge-section"><div class="knowledge-section-heading"><span>学习目标</span><small>完成后应能独立作答</small></div><ul>' + (node.objectives || []).map((item) => '<li>' + formatText(item) + '</li>').join("") + '</ul></section><section class="knowledge-section"><div class="knowledge-section-heading"><span>核心辨析</span><small>概念、边界与得分点</small></div><ul>' + (node.keyPoints || []).map((item) => '<li>' + formatText(item) + '</li>').join("") + '</ul></section></div><section class="knowledge-section knowledge-formula-section"><div class="knowledge-section-heading"><span>核心公式</span><small>点击公式下方说明理解适用条件</small></div><div class="knowledge-formula-list">' + (node.formulas || []).map(renderFormula).join("") + '</div></section><section class="knowledge-section"><div class="knowledge-section-heading"><span>标准解题流程</span><small>考试书写顺序</small></div><ol class="knowledge-method-list">' + (node.method || []).map((item) => '<li>' + formatText(item) + '</li>').join("") + '</ol></section><section class="knowledge-section knowledge-pitfalls"><div class="knowledge-section-heading"><span>常见失分点</span><small>做题后逐条自检</small></div><ul>' + (node.pitfalls || []).map((item) => '<li>' + formatText(item) + '</li>').join("") + '</ul></section>' + renderExample(node.example) + renderResources(node) + '<footer class="knowledge-next"><button type="button" class="secondary-button" data-knowledge-action="previous">上一个知识点</button><span>节点 ' + (nodes.findIndex((item) => item.id === node.id) + 1) + ' / ' + nodes.length + '</span><button type="button" class="secondary-button" data-knowledge-action="next">下一个知识点</button></footer>';
    renderMath($("#knowledge-lesson"));
    bindLessonActions(node);
  }

  function bindLessonActions(node) {
    $$('[data-knowledge-status]').forEach((button) => button.addEventListener("click", () => {
      progress[node.id] = { status: button.dataset.knowledgeStatus, updatedAt: Date.now() };
      saveProgress();
      renderProgressSummary();
      renderTree();
      renderLesson();
    }));
    $$('[data-knowledge-node]').forEach((button) => button.addEventListener("click", () => {
      activeNodeId = button.dataset.knowledgeNode;
      const target = nodes.find((item) => item.id === activeNodeId);
      if (target) activeChapterId = target.chapterId;
      renderTree();
      renderLesson();
    }));
    $$('[data-knowledge-action]').forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.knowledgeAction;
      const index = nodes.findIndex((item) => item.id === node.id);
      if (action === "next" || action === "previous") {
        const target = nodes[(index + (action === "next" ? 1 : -1) + nodes.length) % nodes.length];
        activeNodeId = target.id;
        activeChapterId = target.chapterId;
        renderTree();
        renderLesson();
      } else if (action === "practice") {
        const bankButton = $('[data-tool="question-bank"]');
        if (bankButton) bankButton.click();
        const source = $("#bank-source");
        if (source) {
          source.value = "all";
          source.dispatchEvent(new Event("change"));
          $("#bank-search").value = node.query || node.title;
          $("#bank-search").dispatchEvent(new Event("input"));
          $("#bank-start").click();
        }
      } else if (action === "tool" && node.tool) {
        const toolButton = $('[data-tool="' + node.tool + '"]');
        if (toolButton) toolButton.click();
      }
    }));
  }

  function init() {
    if (!nodes.length || !$("#module-nav") || !$(".platform-main")) return;
    addView();
    $("#knowledge-search").addEventListener("input", renderTree);
    $$("[data-knowledge-filter]").forEach((button) => button.addEventListener("click", () => {
      $$("[data-knowledge-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderTree();
    }));
    renderProgressSummary();
    renderTree();
    renderLesson();
  }

  init();
})();
