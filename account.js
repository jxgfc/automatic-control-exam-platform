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
    switchButton.hidden = loggedIn;
    logout.hidden = !loggedIn;
    adminLink.hidden = !loggedIn || !user.isAdmin;
    submit.textContent = mode === "login" ? "登录" : "注册";
  }
  function showPanel() {
    panel.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    render();
    if (!user) $("#auth-username").focus();
  }
  function hidePanel() {
    panel.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
    setError("");
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
  openButton.addEventListener("click", () => panel.hidden ? showPanel() : hidePanel());
  $("#auth-close").addEventListener("click", hidePanel);
  switchButton.addEventListener("click", () => { mode = mode === "login" ? "register" : "login"; setError(""); render(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    submit.disabled = true;
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
      render();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "账号服务暂时不可用");
    } finally { submit.disabled = false; }
  });
  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch (_) {}
    user = null;
    mode = "login";
    logout.disabled = false;
    render();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#account-widget")) hidePanel();
  });
  window.ControlAccount = { getUser: () => user, refresh: readSession };
  render();
  readSession();
})();
