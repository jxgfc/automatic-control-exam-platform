(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const message = $("#message");
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const date = (value) => value ? new Date(value).toLocaleString("zh-CN") : "-";
  function setMessage(value) { message.textContent = value || ""; }
  async function request(path, options) {
    const response = await fetch(path, { credentials: "same-origin", ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "后台请求失败");
    return payload;
  }
  function renderCodes(codes) {
    $("#codes").innerHTML = codes.map((code) => {
      const expired = !code.usedAt && code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now();
      const status = code.usedAt ? "已使用" : expired ? "已过期" : "可使用";
      const action = !code.usedAt && !expired ? '<button type="button" data-revoke="' + escapeHtml(code.id) + '">撤销</button>' : "-";
      return "<tr><td>" + escapeHtml(code.id) + "</td><td>" + escapeHtml(code.codeHint) + "</td><td>" + escapeHtml(code.label) + "</td><td>" + status + "</td><td>" + date(code.expiresAt) + "</td><td>" + action + "</td></tr>";
    }).join("") || '<tr><td colspan="6">暂无激活码</td></tr>';
  }
  function renderUsers(users) {
    $("#users").innerHTML = users.map((user) => "<tr><td>" + escapeHtml(user.id) + "</td><td>" + escapeHtml(user.username) + "</td><td>" + date(user.createdAt) + "</td><td>" + escapeHtml(user.activationCodeId || "旧账号") + "</td></tr>").join("") || '<tr><td colspan="4">暂无用户</td></tr>';
  }
  async function refresh() {
    setMessage("正在读取后台数据…");
    try {
      const [stats, codes, users] = await Promise.all([request("/api/admin/stats"), request("/api/admin/activation-codes?limit=500"), request("/api/admin/users?limit=500")]);
      $("#user-total").textContent = stats.users.total;
      $("#question-total").textContent = stats.questionBank.total;
      $("#code-available").textContent = stats.activationCodes.available;
      $("#code-used").textContent = stats.activationCodes.used;
      renderCodes(codes.codes || []);
      renderUsers(users.users || []);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "后台数据读取失败"); }
  }
  $("#generate").addEventListener("click", async () => {
    const button = $("#generate");
    button.disabled = true;
    $("#generated").hidden = true;
    try {
      const payload = await request("/api/admin/activation-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: Number($("#code-count").value), expiresInDays: Number($("#code-days").value), label: $("#code-label").value.trim() }) });
      $("#generated").textContent = (payload.codes || []).map((code) => code.code).join("\n");
      $("#generated").hidden = false;
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "激活码生成失败"); }
    finally { button.disabled = false; }
  });
  $("#codes").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-revoke]");
    if (!button || !window.confirm("确认撤销这个未使用激活码？")) return;
    try { await request("/api/admin/activation-codes/" + encodeURIComponent(button.dataset.revoke) + "/revoke", { method: "POST" }); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "激活码撤销失败"); }
  });
  $("#refresh").addEventListener("click", refresh);
  $("#logout").addEventListener("click", async () => { try { await request("/api/auth/logout", { method: "POST" }); } finally { window.location.replace("/login.html"); } });
  (async () => {
    try {
      const session = await request("/api/auth/me");
      if (!session.authenticated) { window.location.replace("/login.html?next=/admin.html"); return; }
      if (!session.isAdmin) { setMessage("当前账号没有管理员权限"); return; }
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "账号服务不可用"); }
  })();
})();
