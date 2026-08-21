(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const message = $("#message");
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const date = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("zh-CN");
  };
  const formatLabel = (value) => {
    const text = String(value == null ? "" : value).trim();
    return !text || /^[?？�]+$/.test(text) ? "未设置批次" : text;
  };
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
      const statusClass = code.usedAt ? "used" : expired ? "expired" : "available";
      const action = !code.usedAt && !expired ? '<button type="button" data-revoke="' + escapeHtml(code.id) + '">撤销</button>' : "-";
      const batchLabel = formatLabel(code.label);
      return "<tr><td>" + escapeHtml(code.id) + "</td><td><code>" + escapeHtml(code.codeHint) + "</code></td><td class=\"label-cell\" title=\"" + escapeHtml(batchLabel) + "\">" + escapeHtml(batchLabel) + "</td><td><span class=\"status status-" + statusClass + "\">" + status + "</span></td><td>" + date(code.expiresAt) + "</td><td>" + action + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="empty">暂无激活码</td></tr>';
  }
  function renderUsers(users) {
    $("#users").innerHTML = users.map((user) => "<tr><td>" + escapeHtml(user.id) + "</td><td>" + escapeHtml(user.username) + "</td><td>" + date(user.createdAt) + "</td><td>" + escapeHtml(user.activationCodeId || "旧账号") + "</td></tr>").join("") || '<tr><td colspan="4" class="empty">暂无用户</td></tr>';
  }
  async function refresh() {
    setMessage("正在读取后台数据…");
    try {
      const [stats, codes, users] = await Promise.all([request("/api/admin/stats"), request("/api/admin/activation-codes?limit=500"), request("/api/admin/users?limit=500")]);
      $("#user-total").textContent = stats.users.total;
      $("#question-total").textContent = stats.questionBank.total;
      $("#code-available").textContent = stats.activationCodes.available;
      $("#code-used").textContent = stats.activationCodes.used;
      $("#code-expired").textContent = stats.activationCodes.expired;
      renderCodes(codes.codes || []);
      renderUsers(users.users || []);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "后台数据读取失败"); }
  }
  $("#generate").addEventListener("click", async () => {
    const button = $("#generate");
    button.disabled = true;
    $("#generated-wrap").hidden = true;
    try {
      const payload = await request("/api/admin/activation-codes", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ count: Number($("#code-count").value), expiresInDays: Number($("#code-days").value), label: $("#code-label").value.trim() }) });
      const generatedCodes = (payload.codes || []).map((code) => code.code).filter(Boolean);
      $("#generated").textContent = generatedCodes.join("\n");
      $("#generated-wrap").hidden = generatedCodes.length === 0;
      $("#copy-status").textContent = "";
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "激活码生成失败"); }
    finally { button.disabled = false; }
  });
  $("#copy-generated").addEventListener("click", async () => {
    const text = $("#generated").textContent.trim();
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
        textarea.remove();
      }
      $("#copy-status").textContent = "已复制";
    } catch (_) {
      $("#copy-status").textContent = "复制失败，请手动选择文本";
    }
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
