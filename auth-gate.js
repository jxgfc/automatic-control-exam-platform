(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const form = $("#gate-form");
  const title = $("#title");
  const submit = $("#submit");
  const toggle = $("#toggle");
  const activationWrap = $("#activation-wrap");
  const activation = $("#activation");
  const error = $("#error");
  const status = $("#status");
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  let mode = "login";

  function render() {
    const register = mode === "register";
    title.textContent = register ? "使用激活码注册" : "登录后继续";
    submit.textContent = register ? "注册并进入" : "登录";
    toggle.textContent = register ? "已有账号？返回登录" : "没有账号？使用激活码注册";
    activationWrap.classList.toggle("is-visible", register);
    activation.required = register;
  }
  function setError(message) { error.textContent = message || ""; error.hidden = !message; }
  toggle.addEventListener("click", () => { mode = mode === "login" ? "register" : "login"; setError(""); render(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    submit.disabled = true;
    status.textContent = mode === "register" ? "正在核验激活码…" : "正在登录…";
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value, activationCode: activation.value.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "账号操作失败");
      window.location.replace(next.startsWith("/") ? next : "/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "账号服务暂时不可用");
      status.textContent = "";
    } finally { submit.disabled = false; }
  });
  render();
})();
