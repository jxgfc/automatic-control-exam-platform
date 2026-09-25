(function () {
  "use strict";

  const profile = window.ControlSiteProfile || {};
  const home = document.querySelector("#personal-home");
  if (!home) return;

  const $ = (selector, root) => (root || home).querySelector(selector);
  const $$ = (selector, root) => [...(root || home).querySelectorAll(selector)];
  const text = (selector, value) => {
    const element = $(selector);
    if (element && value != null) element.textContent = value;
  };

  const backupKeys = [
    "control-ai-question-history-v1",
    "control-question-favorites-v1",
    "control-question-wrong-v1",
    "control-question-wrong-book-v2",
    "control-question-attempts-v2",
    "control-ai-settings-v1",
    "control-knowledge-progress-v1"
  ];

  function backupStatus(message, isError) {
    const status = $("[data-backup-status]");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function exportLearningData() {
    const values = {};
    backupKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    });
    const payload = {
      schema: "control-study-backup-v1",
      exportedAt: new Date().toISOString(),
      keys: values
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "automatic-control-study-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupStatus("备份已下载（" + Object.keys(values).length + " 类记录）");
  }

  async function importLearningData(file) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) throw new Error("备份文件不能超过3MB");
    let payload;
    try { payload = JSON.parse(await file.text()); } catch (_) { throw new Error("备份文件不是有效JSON"); }
    if (!payload || payload.schema !== "control-study-backup-v1" || !payload.keys || typeof payload.keys !== "object" || Array.isArray(payload.keys)) {
      throw new Error("备份版本不兼容");
    }
    const entries = Object.entries(payload.keys).filter(([key, value]) => backupKeys.includes(key) && typeof value === "string");
    if (!entries.length) throw new Error("备份中没有可恢复的学习记录");
    const invalid = entries.find(([, value]) => {
      try { JSON.parse(value); return false; } catch (_) { return true; }
    });
    if (invalid) throw new Error("备份中的学习数据格式不完整");
    if (!window.confirm("导入备份会覆盖当前浏览器中的同名学习记录，是否继续？")) return;
    entries.forEach(([key, value]) => localStorage.setItem(key, value));
    backupStatus("已恢复 " + entries.length + " 类记录，正在刷新…");
    setTimeout(() => window.location.reload(), 260);
  }

  text("[data-profile-name]", profile.name || "自动控制学习空间");
  text("[data-profile-short-name]", profile.shortName || profile.name || "控制学习空间");
  text("[data-profile-eyebrow]", profile.eyebrow || "PERSONAL LAB");
  text("[data-profile-role]", profile.role || "自动控制原理考研学习与计算工具");
  text("[data-profile-bio]", profile.bio || "围绕考试大纲整理学习资料与计算工具。");
  text("[data-profile-location]", profile.location || "在线学习空间");

  $$('[data-profile-avatar]').forEach((avatar) => {
    const avatarUrl = String(profile.avatar || "").trim();
    if (avatarUrl) {
      avatar.style.backgroundImage = `url("${avatarUrl.replace(/"/g, "&quot;")}")`;
      avatar.classList.add("has-image");
      avatar.textContent = "";
    } else {
      const initials = String(profile.shortName || profile.name || "控").trim().slice(0, 1);
      avatar.textContent = initials;
    }
  });

  const links = $("[data-profile-links]");
  if (links && Array.isArray(profile.links)) {
    links.innerHTML = profile.links.map((item) => {
      const label = String(item && item.label || "链接");
      const href = String(item && item.href || "#");
      const external = /^https?:\/\//i.test(href);
      const target = external ? ' target="_blank" rel="noreferrer"' : "";
      return `<a href="${href.replace(/"/g, "&quot;")}"${target}>${label}</a>`;
    }).join("");
  }

  function scrollToPlatform() {
    const target = document.querySelector("#learning-platform");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $$('[data-home-action="platform"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      scrollToPlatform();
    });
  });

  $$('[data-home-tool]').forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.homeTool;
      const target = document.querySelector(`[data-tool="${tool}"]`);
      if (!target) return scrollToPlatform();
      target.click();
      scrollToPlatform();
    });
  });

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const syllabusCount = Array.isArray(window.ControlSyllabus) ? window.ControlSyllabus.length : 37;
  const practiceCount = Array.isArray(window.ControlPracticeQuestions) ? window.ControlPracticeQuestions.length : 0;
  const tree = window.ControlKnowledgeTree || {};
  const treeCount = Array.isArray(tree.chapters) ? tree.chapters.reduce((sum, chapter) => sum + (chapter.nodes || []).length, 0) : 37;
  text('[data-stat="syllabus"]', syllabusCount);
  text('[data-stat="questions"]', practiceCount || 60);
  text('[data-stat="tree"]', treeCount);

  const header = $(".personal-nav");
  if (header) {
    const toggle = $("[data-nav-toggle]", header);
    const menu = $("[data-nav-menu]", header);
    const syncMenu = () => {
      if (menu) menu.hidden = window.matchMedia("(max-width: 640px)").matches && !header.classList.contains("is-menu-open");
    };
    syncMenu();
    toggle && toggle.addEventListener("click", () => {
      const open = header.classList.toggle("is-menu-open");
      toggle.setAttribute("aria-expanded", String(open));
      if (menu) menu.hidden = !open;
    });
    $$("a", menu).forEach((link) => link.addEventListener("click", () => {
      header.classList.remove("is-menu-open");
      if (menu) menu.hidden = window.matchMedia("(max-width: 640px)").matches;
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }));
    window.addEventListener("resize", syncMenu);
  }

  const updateNav = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 18);
  };
  updateNav();
  window.addEventListener("scroll", updateNav, { passive: true });

  const exportButton = $("[data-backup-export]");
  const importButton = $("[data-backup-import]");
  const importFile = $("[data-backup-file]");
  exportButton && exportButton.addEventListener("click", () => {
    try { exportLearningData(); } catch (_) { backupStatus("备份导出失败，请检查浏览器存储权限", true); }
  });
  importButton && importButton.addEventListener("click", () => importFile && importFile.click());
  importFile && importFile.addEventListener("change", async () => {
    try { await importLearningData(importFile.files && importFile.files[0]); }
    catch (error) { backupStatus(error instanceof Error ? error.message : "备份导入失败", true); }
    finally { importFile.value = ""; }
  });
})();
