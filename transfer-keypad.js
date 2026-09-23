(function (root) {
  "use strict";

  // A small, dependency-free expression keypad shared by every compact
  // transfer-function input. It deliberately edits the input at the current
  // selection so it works on touch screens as well as with a mouse.
  const state = {
    input: null,
    panel: null
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function variableFor(input) {
    const id = String(input && input.id || "").toLowerCase();
    return id.includes("zinverse") ? "z" : "s";
  }

  function insertAtCursor(input, text) {
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    input.setRangeText(text, start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
  }

  function backspace(input) {
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    if (start !== end) {
      input.setRangeText("", start, end, "start");
    } else if (start > 0) {
      input.setRangeText("", start - 1, start, "start");
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
  }

  function hide() {
    if (state.panel) state.panel.hidden = true;
  }

  function show(input, anchor) {
    if (!state.panel) return;
    state.input = input;
    // Opening the keypad from its trigger should append at the end when the
    // field was not already focused; an already focused field keeps its caret
    // or selection so the keypad remains a true cursor editor.
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    }
    const variable = variableFor(input);
    state.panel.innerHTML = [
      '<div class="transfer-keypad-head"><strong>公式键盘</strong><span>输入 ' + escapeHtml(variable) + '、复数或多项式</span><button type="button" data-tkp-action="close" aria-label="关闭公式键盘">×</button></div>',
      '<div class="transfer-keypad-grid">',
      '<button type="button" class="tkp-command" data-tkp-action="clear">清空</button><button type="button" class="tkp-command" data-tkp-action="backspace" aria-label="退格">⌫</button><button type="button" data-tkp-value="(">(</button><button type="button" data-tkp-value=")">)</button><button type="button" data-tkp-value="^">xⁿ</button>',
      '<button type="button" data-tkp-value="7">7</button><button type="button" data-tkp-value="8">8</button><button type="button" data-tkp-value="9">9</button><button type="button" data-tkp-value="+">+</button><button type="button" data-tkp-value="-">−</button>',
      '<button type="button" data-tkp-value="4">4</button><button type="button" data-tkp-value="5">5</button><button type="button" data-tkp-value="6">6</button><button type="button" data-tkp-value="*">×</button><button type="button" data-tkp-value="/">÷</button>',
      '<button type="button" data-tkp-value="1">1</button><button type="button" data-tkp-value="2">2</button><button type="button" data-tkp-value="3">3</button><button type="button" data-tkp-value=".">.</button><button type="button" class="tkp-variable" data-tkp-variable="true">' + escapeHtml(variable) + '</button>',
      '<button type="button" class="tkp-wide" data-tkp-value="0">0</button><button type="button" data-tkp-value="j">j</button><button type="button" data-tkp-value=",">,</button><button type="button" data-tkp-value="-">−</button>',
      '</div>'
    ].join("");
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(330, Math.max(280, window.innerWidth - 24));
    state.panel.style.width = width + "px";
    state.panel.style.left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left)) + "px";
    state.panel.style.top = Math.min(window.innerHeight - 300, rect.bottom + 8) + "px";
    state.panel.hidden = false;
  }

  function ensurePanel() {
    if (state.panel) return;
    const panel = document.createElement("div");
    panel.className = "transfer-keypad-popover";
    panel.hidden = true;
    panel.addEventListener("mousedown", (event) => event.preventDefault());
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || !state.input) return;
      const action = button.dataset.tkpAction;
      if (action === "close") return hide();
      if (action === "clear") {
        state.input.value = "";
        state.input.dispatchEvent(new Event("input", { bubbles: true }));
        state.input.focus({ preventScroll: true });
      } else if (action === "backspace") {
        backspace(state.input);
      } else if (button.dataset.tkpVariable) {
        insertAtCursor(state.input, variableFor(state.input));
      } else if (button.dataset.tkpValue) {
        insertAtCursor(state.input, button.dataset.tkpValue);
      }
    });
    document.body.appendChild(panel);
    state.panel = panel;
  }

  function attach(rootNode) {
    if (!rootNode || !rootNode.querySelectorAll) return;
    ensurePanel();
    const inputs = rootNode.matches && rootNode.matches(".compact-transfer-input input")
      ? [rootNode]
      : [...rootNode.querySelectorAll(".compact-transfer-input input")];
    inputs.forEach((input) => {
      if (input.dataset.transferKeypadReady === "true") return;
      input.dataset.transferKeypadReady = "true";
      input.setAttribute("inputmode", "text");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "transfer-keypad-trigger";
      button.textContent = "⌨";
      button.title = "打开公式键盘";
      button.setAttribute("aria-label", "打开公式键盘");
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => show(input, button));
      input.insertAdjacentElement("afterend", button);
    });
  }

  function install() {
    if (!document.body) return;
    attach(document);
    if (!root.__transferKeypadObserver) {
      root.__transferKeypadObserver = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) attach(node);
      })));
      root.__transferKeypadObserver.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener("click", (event) => {
      if (state.panel && !state.panel.hidden && !state.panel.contains(event.target) && !event.target.closest(".transfer-keypad-trigger")) hide();
    });
    window.addEventListener("resize", hide);
    // Keep the keypad open while the trigger is being scrolled into view. A
    // click on an off-screen field causes the browser to emit a scroll event
    // before the click handler runs; hiding on every scroll used to close the
    // newly opened keypad immediately (especially after switching tools).
    // The panel is fixed to the viewport, and the outside-click handler still
    // provides an explicit way to dismiss it.
  }

  root.TransferKeypad = { install, attach, hide };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(typeof window !== "undefined" ? window : globalThis);
