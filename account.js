(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const openButton = $("#auth-open");
  const panel = $("#auth-panel");
  const form = $("#auth-form");
  const title = $("#auth-title");
  const submit = $("#auth-submit");
  const switchButton = $("#auth-switch");
  const logout = $("#auth-logout");
  const errorBox = $("#auth-error");
  const activationField = $("#auth-activation-field");
  const activationInput = $("#auth-activation-code");
  const adminLink = $("#auth-admin-link");
  if (!openButton || !panel || !form) return;
  let mode = "login";
  let user = null;
  let busy = false;
  let returnFocus = null;

  function clearUsernameAutofill(username) {
    const normalized = String(username || "").trim().toLocaleLowerCase("en-US");
    if (!normalized) return;
    ["#coverage-search", "#knowledge-search", "#bank-search"].forEach((selector) => {
      const input = $(selector);
      if (!input || input.value.trim().toLocaleLowerCase("en-US") !== normalized) return;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function setError(message) {
    errorBox.textContent = message || "";
    errorBox.hidden = !message;
  }
  function render() {
    const loggedIn = Boolean(user);
    openButton.textContent = loggedIn ? user.username : "登录";
    openButton.classList.toggle("is-authenticated", loggedIn);
    title.textContent = loggedIn ? "账号状态" : mode === "login" ? "账号登录" : "创建账号";
    form.hidden = loggedIn;
    activationField.hidden = loggedIn || mode !== "register";
    activationInput.required = !loggedIn && mode === "register";
    $("#auth-password").autocomplete = mode === "register" ? "new-password" : "current-password";
    switchButton.hidden = loggedIn;
    switchButton.disabled = busy;
    submit.disabled = busy;
    logout.hidden = !loggedIn;
    logout.disabled = busy;
    adminLink.hidden = !loggedIn || !user.isAdmin;
    submit.textContent = mode === "login" ? "登录" : "注册";
  }
  function showPanel() {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    panel.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    render();
    if (!user) $("#auth-username").focus();
  }
  function hidePanel(restoreFocus = false) {
    panel.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
    setError("");
    if (restoreFocus && returnFocus && typeof returnFocus.focus === "function" && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }
  async function readSession() {
    if (window.location.protocol === "file:") { render(); return; }
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.authenticated) {
        user = payload.user ? { ...payload.user, isAdmin: Boolean(payload.isAdmin) } : null;
        clearUsernameAutofill(user && user.username);
      }
    } catch (_) { /* Offline use does not require an account. */ }
    render();
  }
  openButton.addEventListener("click", () => panel.hidden ? showPanel() : hidePanel(true));
  $("#auth-close").addEventListener("click", () => hidePanel(true));
  switchButton.addEventListener("click", () => {
    if (busy) return;
    mode = mode === "login" ? "register" : "login";
    setError("");
    render();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    busy = true;
    render();
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: $("#auth-username").value.trim(), password: $("#auth-password").value, activationCode: activationInput.value.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || (mode === "login" ? "登录失败" : "注册失败"));
      user = payload.user ? { ...payload.user, isAdmin: Boolean(payload.isAdmin) } : null;
      clearUsernameAutofill(user && user.username);
      $("#auth-password").value = "";
      activationInput.value = "";
      busy = false;
      render();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "账号服务暂时不可用");
      busy = false;
      render();
    }
  });
  logout.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    setError("");
    render();
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "退出登录失败，请稍后重试");
    } catch (requestError) {
      busy = false;
      setError(requestError instanceof Error ? requestError.message : "退出登录失败，请稍后重试");
      render();
      return;
    }
    user = null;
    mode = "login";
    busy = false;
    render();
    const next = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace("/login.html?next=" + encodeURIComponent(next.startsWith("/") ? next : "/"));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#account-widget")) hidePanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) hidePanel(true);
  });
  window.ControlAccount = { getUser: () => user, refresh: readSession };
  render();
  readSession();
})();
