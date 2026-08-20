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
      if (menu) menu.hidden = false;
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }));
    window.addEventListener("resize", syncMenu);
  }

  const updateNav = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 18);
  };
  updateNav();
  window.addEventListener("scroll", updateNav, { passive: true });
})();
