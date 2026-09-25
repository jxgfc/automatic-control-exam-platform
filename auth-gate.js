(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);

  function safeNextPath(value) {
    const candidateValue = String(value || "");
    if (!candidateValue.startsWith("/") || /[\\\u0000-\u0020\u007f]/.test(candidateValue)) return "/";
    try {
      const destination = new URL(candidateValue, window.location.origin);
      if (!["http:", "https:"].includes(destination.protocol) || destination.origin !== window.location.origin || destination.username || destination.password) return "/";
      return destination.pathname + destination.search + destination.hash;
    } catch (_) { return "/"; }
  }
  if (typeof window !== "undefined") window.ControlAuthGate = { safeNextPath };

  const form = $("#gate-form");
  if (!form) return;
  const title = $("#title");
  const submit = $("#submit");
  const toggle = $("#toggle");
  const activationWrap = $("#activation-wrap");
  const activation = $("#activation");
  const error = $("#error");
  const status = $("#status");
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  let mode = "login";
  let busy = false;


  function render() {
    const register = mode === "register";
    title.textContent = register ? "使用激活码注册" : "登录后继续";
    submit.textContent = register ? "注册并进入" : "登录";
    toggle.textContent = register ? "已有账号？返回登录" : "没有账号？使用激活码注册";
    activationWrap.classList.toggle("is-visible", register);
    activation.required = register;
    $("#password").autocomplete = register ? "new-password" : "current-password";
    toggle.disabled = busy;
    submit.disabled = busy;
  }
  function setError(message) { error.textContent = message || ""; error.hidden = !message; }
  toggle.addEventListener("click", () => {
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
    status.textContent = mode === "register" ? "正在核验激活码…" : "正在登录…";
    let redirected = false;
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value, activationCode: activation.value.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "账号操作失败");
      redirected = true;
      window.location.replace(safeNextPath(next));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "账号服务暂时不可用");
      status.textContent = "";
    } finally {
      if (!redirected) {
        busy = false;
        render();
      }
    }
  });
  render();
})();
