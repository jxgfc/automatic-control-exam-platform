(function () {
  "use strict";

  const Solver = window.RootLocusSolver;
  const Core = window.ControlExamCore;
  const Advanced = window.ControlAdvancedCore;
  const theoryQuestions = window.ControlTheoryQuestions || [];

  if (!Solver || !Core || !Advanced) return;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];

  function formatNumber(value, digits) {
    if (value === Infinity) return "∞";
    if (value === -Infinity) return "−∞";
    if (!Number.isFinite(value)) return "无定义";
    if (Math.abs(value) < 1e-10) return "0";
    const precision = digits || 6;
    const rounded = Number(value.toPrecision(precision));
    return Math.abs(rounded) >= 1e7 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-5)
      ? rounded.toExponential(precision - 1)
      : String(rounded);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function complexText(value) {
    const real = Math.abs(value.real) < 1e-9 ? 0 : value.real;
    const imaginary = Math.abs(value.imaginary) < 1e-9 ? 0 : value.imaginary;
    if (!imaginary) return formatNumber(real);
    if (!real) return formatNumber(imaginary) + "j";
    return formatNumber(real) + (imaginary >= 0 ? " + " : " − ") + formatNumber(Math.abs(imaginary)) + "j";
  }

  function polynomialText(coefficients, variable) {
    const name = variable || "s";
    const values = Solver.normalizePolynomial(coefficients);
    const degree = values.length - 1;
    const terms = [];
    values.forEach((coefficient, index) => {
      if (Math.abs(coefficient) < 1e-10) return;
      const power = degree - index;
      const magnitude = Math.abs(coefficient);
      let body = power === 0 ? formatNumber(magnitude) : (Math.abs(magnitude - 1) < 1e-10 ? "" : formatNumber(magnitude)) + name + (power === 1 ? "" : "<sup>" + power + "</sup>");
      terms.push({ negative: coefficient < 0, body });
    });
    if (!terms.length) return "0";
    return terms.map((term, index) => (index ? (term.negative ? " − " : " + ") : (term.negative ? "−" : "")) + term.body).join("");
  }

  function rationalText(value, variable) {
    return '<span class="inline-fraction"><span>' + polynomialText(value.numerator, variable) + '</span><span>' + polynomialText(value.denominator, variable) + "</span></span>";
  }

  function matrixText(matrix) {
    return '<span class="matrix-brackets"><span>' + matrix.map((row) => '<span class="matrix-row">' + row.map((value) => '<i>' + formatNumber(value) + "</i>").join("") + "</span>").join("") + "</span></span>";
  }

  function parseTransfer(numeratorSelector, denominatorSelector) {
    return Solver.transferFunctionFromExpressions($(numeratorSelector).value, $(denominatorSelector).value);
  }

  function parseCoefficientList(value) {
    const values = String(value).split(/[,，\s]+/).filter(Boolean).map(Number);
    if (!values.length || values.some((item) => !Number.isFinite(item))) throw new Error("请输入用逗号分隔的有限数字");
    return values;
  }

  function setError(selector, message) {
    const element = $(selector);
    element.textContent = message || "";
    element.hidden = !message;
  }

  function summary(label, value, warning) {
    return '<div class="result-summary-band ' + (warning ? "warning" : "success") + '"><span>' + label + "</span><strong>" + value + "</strong></div>";
  }

  function metricStrip(items) {
    return '<div class="metric-strip ' + (items.length === 4 ? "four" : "") + '">' + items.map((item) => '<div><span>' + item[0] + "</span><strong>" + item[1] + "</strong></div>").join("") + "</div>";
  }

  function addNavigation() {
    const nav = $("#module-nav");
    const overview = $('[data-tool="overview"]', nav);
    overview.insertAdjacentHTML("afterend", '<button type="button" class="module-link" data-tool="modeling" data-schools="828,861"><span class="module-number">01</span><span><strong>建模与变换</strong><small>部分分式、拉氏与梅逊公式</small></span></button>');
    nav.insertAdjacentHTML("beforeend", [
      '<button type="button" class="module-link" data-tool="nyquist" data-schools="828,861"><span class="module-number">07</span><span><strong>Nyquist分析</strong><small>围绕数与闭环频域指标</small></span></button>',
      '<button type="button" class="module-link" data-tool="compensation" data-schools="828,861"><span class="module-number">08</span><span><strong>系统校正</strong><small>超前、滞后与PID整定</small></span></button>',
      '<button type="button" class="module-link" data-tool="discrete" data-schools="828,861"><span class="module-number">09</span><span><strong>离散系统</strong><small>Jury、差分与ZOH</small></span></button>',
      '<button type="button" class="module-link" data-tool="nonlinear" data-schools="828,861"><span class="module-number">10</span><span><strong>非线性系统</strong><small>描述函数与自激振荡</small></span></button>',
      '<button type="button" class="module-link" data-tool="state-space" data-schools="828,861"><span class="module-number">11</span><span><strong>状态空间</strong><small>能控能观、配置与Lyapunov</small></span></button>',
      '<button type="button" class="module-link" data-tool="theory" data-schools="828,861"><span class="module-number">12</span><span><strong>理论自测</strong><small>简述、证明与核心概念</small></span></button>'
    ].join(""));
    const numbers = { overview: "00", modeling: "01", routh: "02", "steady-error": "03", "second-order": "04", "root-locus": "05", frequency: "06", nyquist: "07", compensation: "08", discrete: "09", nonlinear: "10", "state-space": "11", theory: "12" };
    $$(".module-link", nav).forEach((button) => { $(".module-number", button).textContent = numbers[button.dataset.tool]; });
  }

  function transferInput(prefix, numerator, denominator) {
    return '<div class="compact-transfer-input"><span>G(s) =</span><div><label><span>N(s)</span><input id="' + prefix + '-numerator" type="text" value="' + numerator + '"></label><span class="fraction-rule"></span><label><span>D(s)</span><input id="' + prefix + '-denominator" type="text" value="' + denominator + '"></label></div></div>';
  }

  function addToolViews() {
    const main = $(".platform-main");
    const rootLocus = $("#tool-root-locus");
    rootLocus.insertAdjacentHTML("beforebegin", `
      <section class="tool-view" id="tool-modeling" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">01 · MODELING</p><h2>建模、变换与梅逊公式</h2><p>输入有理式或信号流图支路，直接完成展开、反变换和总传递函数计算。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="tool-workspace"><section class="calculator-input-area">
          <label class="field"><span class="field-label">计算类型</span><select id="modeling-mode"><option value="partial">部分分式与拉氏反变换</option><option value="laplace">常用拉氏变换</option><option value="blocks">结构图等效化简</option><option value="mason">信号流图与梅逊公式</option></select></label>
          <div class="mode-panel" data-modeling-panel="partial">${transferInput("partial", "1", "s(s+1)^2")}</div>
          <div class="mode-panel" data-modeling-panel="laplace" hidden>
            <div class="two-field-grid"><label class="field"><span class="field-label">原函数</span><select id="laplace-type"><option value="power">t^n</option><option value="exp">e^(at)</option><option value="sin">sin(ωt)</option><option value="cos">cos(ωt)</option><option value="delay">f(t−τ)·1(t−τ)</option></select></label><label class="field"><span class="field-label">参数 n / a / ω / τ</span><input id="laplace-parameter" type="number" value="2" step="0.1"></label></div>
          </div>
          <div class="mode-panel" data-modeling-panel="blocks" hidden>
            <label class="field"><span class="field-label">连接方式</span><select id="blocks-operation"><option value="series">串联 G1·G2</option><option value="parallel">并联 G1+G2</option><option value="negative">负反馈 G1/(1+G1H)</option><option value="positive">正反馈 G1/(1−G1H)</option></select></label>
            ${transferInput("blocks-g1", "1", "s+1")}${transferInput("blocks-g2", "2", "s+2")}${transferInput("blocks-h", "1", "1")}
          </div>
          <div class="mode-panel" data-modeling-panel="mason" hidden>
            <label class="field"><span class="field-label">支路：起点, 终点, 增益</span><textarea id="mason-edges" rows="7">R,A,1
A,Y,1/(s+1)
Y,A,-2</textarea></label>
            <div class="two-field-grid"><label class="field"><span class="field-label">输入节点</span><input id="mason-source" value="R"></label><label class="field"><span class="field-label">输出节点</span><input id="mason-target" value="Y"></label></div>
          </div>
          <div id="modeling-error" class="error-message" role="alert" hidden></div><button id="modeling-calculate" class="primary-button" type="button"><span>计算建模结果</span><span aria-hidden="true">→</span></button>
          <div class="method-strip"><span>公式</span><div><p>F(s)=Q(s)+Σ A<sub>ik</sub>/(s−p<sub>i</sub>)<sup>k</sup></p><p>T=ΣP<sub>k</sub>Δ<sub>k</sub>/Δ</p></div></div>
        </section><section class="calculator-output-area" id="modeling-result" aria-live="polite"></section></div>
      </section>`);

    main.insertAdjacentHTML("beforeend", `
      <section class="tool-view" id="tool-nyquist" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">07 · NYQUIST</p><h2>Nyquist稳定判据与闭环频域指标</h2><p>给出P、N、Z、闭环稳定性、谐振峰值和闭环带宽。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="tool-workspace"><section class="calculator-input-area">${transferInput("nyquist", "1", "(s+1)^2")}
          <div class="two-field-grid"><label class="field"><span class="field-label">ωmin</span><input id="nyquist-min" type="number" value="0.001" min="0.000001"></label><label class="field"><span class="field-label">ωmax</span><input id="nyquist-max" type="number" value="1000" min="0.001"></label></div>
          <div id="nyquist-error" class="error-message" role="alert" hidden></div><button id="nyquist-calculate" class="primary-button" type="button"><span>绘制并判断稳定性</span><span aria-hidden="true">→</span></button>
          <div class="method-strip"><span>判据</span><div><p>本工具约定逆时针净包围为正：Z = P − N</p><p>Z = 0 时闭环稳定</p></div></div>
        </section><section class="calculator-output-area" id="nyquist-result" aria-live="polite"></section></div>
      </section>

      <section class="tool-view" id="tool-compensation" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">08 · DESIGN</p><h2>系统校正与PID整定</h2><p>自动计算超前、滞后校正网络，或按临界比例法整定P/PI/PID。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="tool-workspace"><section class="calculator-input-area">
          <label class="field"><span class="field-label">设计方法</span><select id="compensation-mode"><option value="lead">超前校正</option><option value="lag">滞后校正</option><option value="laglead">滞后-超前组合校正</option><option value="pid">Ziegler-Nichols整定</option></select></label>
          <div class="mode-panel" data-compensation-panel="lead lag laglead">${transferInput("compensation", "1", "s(s+1)")}<div class="two-field-grid"><label class="field"><span class="field-label">期望相角裕度</span><input id="compensation-margin" type="number" value="65" min="1" max="89"></label><label class="field"><span class="field-label">安全余量</span><input id="compensation-safety" type="number" value="5" min="0" max="20"></label></div><label class="field" id="lag-beta-field" hidden><span class="field-label">低频增益倍率 β</span><input id="compensation-beta" type="number" value="10" min="1.01"></label></div>
          <div class="mode-panel" data-compensation-panel="pid" hidden><div class="two-field-grid"><label class="field"><span class="field-label">临界增益 K<sub>u</sub></span><input id="pid-ku" type="number" value="10" min="0.001"></label><label class="field"><span class="field-label">临界周期 T<sub>u</sub></span><input id="pid-tu" type="number" value="2" min="0.001"></label></div><label class="field"><span class="field-label">控制器</span><select id="pid-type"><option>P</option><option>PI</option><option selected>PID</option></select></label></div>
          <div id="compensation-error" class="error-message" role="alert" hidden></div><button id="compensation-calculate" class="primary-button" type="button"><span>计算校正参数</span><span aria-hidden="true">→</span></button>
          <div class="method-strip"><span>目标</span><div><p>超前：增加相角裕度与带宽</p><p>滞后：提高低频增益与稳态精度</p></div></div>
        </section><section class="calculator-output-area" id="compensation-result" aria-live="polite"></section></div>
      </section>

      <section class="tool-view" id="tool-discrete" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">09 · DISCRETE</p><h2>离散系统计算器</h2><p>Jury判据、差分方程响应、ZOH状态空间离散化与常用Z变换。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="tool-workspace"><section class="calculator-input-area">
          <label class="field"><span class="field-label">计算类型</span><select id="discrete-mode"><option value="jury">Jury稳定判据</option><option value="difference">差分方程响应</option><option value="zoh">零阶保持离散化</option><option value="ztransform">常用Z变换</option><option value="zinverse">有理式Z反变换</option></select></label>
          <div class="mode-panel" data-discrete-panel="jury"><label class="field"><span class="field-label">特征多项式 F(z)</span><input id="jury-polynomial" value="z^2-0.7z+0.1"></label></div>
          <div class="mode-panel" data-discrete-panel="difference" hidden><label class="field"><span class="field-label">输出系数 a<sub>0</sub>,a<sub>1</sub>,…</span><input id="difference-a" value="1,-0.5"></label><label class="field"><span class="field-label">输入系数 b<sub>0</sub>,b<sub>1</sub>,…</span><input id="difference-b" value="1"></label><div class="two-field-grid"><label class="field"><span class="field-label">输入</span><select id="difference-input"><option value="step">单位阶跃</option><option value="impulse">单位脉冲</option><option value="ramp">单位斜坡</option></select></label><label class="field"><span class="field-label">采样点数</span><input id="difference-count" type="number" value="30" min="2" max="500"></label></div></div>
          <div class="mode-panel" data-discrete-panel="zoh" hidden><label class="field"><span class="field-label">A矩阵</span><textarea id="zoh-a" rows="3">0,1;-2,-3</textarea></label><label class="field"><span class="field-label">B矩阵</span><textarea id="zoh-b" rows="2">0;1</textarea></label><label class="field"><span class="field-label">采样周期 T</span><input id="zoh-time" type="number" value="0.1" min="0.000001"></label></div>
          <div class="mode-panel" data-discrete-panel="ztransform" hidden><div class="two-field-grid"><label class="field"><span class="field-label">序列</span><select id="ztransform-type"><option value="impulse">δ[k]</option><option value="step">1[k]</option><option value="exp">a^k</option><option value="ramp">k</option><option value="delay">1[k−m]</option><option value="finite">有限序列</option></select></label><label class="field"><span class="field-label">参数 a / m</span><input id="ztransform-parameter" type="number" value="0.5"></label></div><label class="field"><span class="field-label">有限序列 x[0],x[1],…</span><input id="ztransform-values" value="1,2,3"></label></div>
          <div class="mode-panel" data-discrete-panel="zinverse" hidden><div class="compact-transfer-input"><span>X(z) =</span><div><label><span>N(z)</span><input id="zinverse-numerator" value="z"></label><span class="fraction-rule"></span><label><span>D(z)</span><input id="zinverse-denominator" value="z-0.5"></label></div></div><label class="field"><span class="field-label">输出序列点数</span><input id="zinverse-count" type="number" value="20" min="2" max="500"></label></div>
          <div id="discrete-error" class="error-message" role="alert" hidden></div><button id="discrete-calculate" class="primary-button" type="button"><span>计算离散系统</span><span aria-hidden="true">→</span></button>
          <div class="method-strip"><span>稳定域</span><div><p>|z<sub>i</sub>| &lt; 1</p><p>A<sub>d</sub>=e<sup>AT</sup>，B<sub>d</sub>=∫e<sup>Aτ</sup>Bdτ</p></div></div>
        </section><section class="calculator-output-area" id="discrete-result" aria-live="polite"></section></div>
      </section>

      <section class="tool-view" id="tool-nonlinear" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">10 · NONLINEAR</p><h2>非线性描述函数与自激振荡</h2><p>计算典型非线性环节的描述函数，并数值搜索极限环振幅与频率。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="tool-workspace"><section class="calculator-input-area">
          <label class="field"><span class="field-label">非线性类型</span><select id="nonlinear-type"><option value="relay">理想继电</option><option value="hysteresis">带滞环继电</option><option value="saturation">饱和</option><option value="deadzone">死区</option></select></label>
          <div class="two-field-grid"><label class="field"><span class="field-label">增益/输出幅值 K</span><input id="nonlinear-gain" type="number" value="1" min="0.000001"></label><label class="field"><span class="field-label">宽度 h / a</span><input id="nonlinear-width" type="number" value="0.2" min="0"></label></div><label class="field"><span class="field-label">给定输入振幅 A</span><input id="nonlinear-amplitude" type="number" value="0.5" min="0.000001"></label>
          ${transferInput("nonlinear", "1", "s(s+1)(s+2)")}
          <div id="nonlinear-error" class="error-message" role="alert" hidden></div><button id="nonlinear-calculate" class="primary-button" type="button"><span>计算描述函数与极限环</span><span aria-hidden="true">→</span></button>
          <div class="method-strip"><span>条件</span><div><p>1 + N(A)G(jω) = 0</p><p>即 G(jω) = −1/N(A)</p></div></div>
        </section><section class="calculator-output-area" id="nonlinear-result" aria-live="polite"></section></div>
      </section>

      <section class="tool-view" id="tool-state-space" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">11 · STATE SPACE</p><h2>状态空间综合计算器</h2><p>覆盖模型转换、状态转移矩阵、能控能观、极点配置、观测器和Lyapunov方程。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="tool-workspace"><section class="calculator-input-area">
          <label class="field"><span class="field-label">计算类型</span><select id="state-mode"><option value="analysis">模型分析</option><option value="transfer">传递函数转状态空间</option><option value="feedback">状态反馈极点配置</option><option value="observer">观测器极点配置</option><option value="lyapunov">Lyapunov方程</option></select></label>
          <div class="mode-panel" data-state-panel="analysis"><label class="field"><span class="field-label">A</span><textarea id="state-a" rows="3">0,1;-2,-3</textarea></label><div class="two-field-grid"><label class="field"><span class="field-label">B</span><textarea id="state-b" rows="2">0;1</textarea></label><label class="field"><span class="field-label">C</span><textarea id="state-c" rows="2">1,0</textarea></label></div><div class="two-field-grid"><label class="field"><span class="field-label">D</span><input id="state-d" value="0"></label><label class="field"><span class="field-label">时间 t</span><input id="state-time" type="number" value="1"></label></div></div>
          <div class="mode-panel" data-state-panel="transfer" hidden>${transferInput("state-transfer", "1", "s^2+3s+2")}</div>
          <div class="mode-panel" data-state-panel="feedback" hidden><label class="field"><span class="field-label">A</span><textarea id="feedback-a" rows="3">0,1;0,0</textarea></label><label class="field"><span class="field-label">B</span><textarea id="feedback-b" rows="2">0;1</textarea></label><label class="field"><span class="field-label">期望极点</span><input id="feedback-poles" value="-2,-3"></label></div>
          <div class="mode-panel" data-state-panel="observer" hidden><label class="field"><span class="field-label">A</span><textarea id="observer-a" rows="3">0,1;-2,-3</textarea></label><label class="field"><span class="field-label">C</span><textarea id="observer-c" rows="2">1,0</textarea></label><label class="field"><span class="field-label">期望观测器极点</span><input id="observer-poles" value="-5,-6"></label></div>
          <div class="mode-panel" data-state-panel="lyapunov" hidden><label class="field"><span class="field-label">A</span><textarea id="lyapunov-a" rows="3">-1,0;0,-2</textarea></label><label class="field"><span class="field-label">Q（正定）</span><textarea id="lyapunov-q" rows="3">1,0;0,1</textarea></label></div>
          <div id="state-error" class="error-message" role="alert" hidden></div><button id="state-calculate" class="primary-button" type="button"><span>计算状态空间结果</span><span aria-hidden="true">→</span></button>
          <div class="method-strip"><span>核心</span><div><p>Φ(t)=e<sup>At</sup>，G(s)=C(sI−A)<sup>−1</sup>B+D</p><p>A<sup>T</sup>P+PA=−Q</p></div></div>
        </section><section class="calculator-output-area" id="state-result" aria-live="polite"></section></div>
      </section>

      <section class="tool-view theory-view" id="tool-theory" data-schools="828,861" hidden>
        <div class="tool-titlebar"><div><p class="section-index">12 · THEORY</p><h2>简述与证明自测</h2><p>按当前院校范围抽题，先作答再展开参考答案和得分关键词。</p></div><div class="school-tags"><span>828</span><span>861</span></div></div>
        <div class="theory-toolbar"><label class="field"><span class="field-label">章节</span><select id="theory-chapter"><option value="all">全部章节</option></select></label><div class="theory-progress" id="theory-progress"></div></div>
        <article class="theory-card" id="theory-card"></article>
        <div class="theory-actions"><button type="button" class="secondary-button" id="theory-previous">上一题</button><button type="button" class="primary-button" id="theory-reveal">显示参考答案</button><button type="button" class="secondary-button" id="theory-next">下一题</button></div>
      </section>`);
  }

  function calculatorValue(value) {
    if (Array.isArray(value)) return value.map((row) => Array.isArray(row) ? row.join(",") : row).join(";");
    return String(value == null ? "" : value);
  }

  function applyCalculatorInput(selector, value) {
    const input = $(selector);
    if (!input || value == null) return false;
    input.value = calculatorValue(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function showQuestionContext(tool, context) {
    const view = $("#tool-" + tool);
    if (!view || !context || !context.question) return;
    const old = $("[data-question-context]", view);
    if (old) old.remove();
    const heading = $(".tool-titlebar", view) || view.firstElementChild;
    if (!heading) return;
    heading.insertAdjacentHTML("afterend", '<aside class="question-context-banner" data-question-context><span>正在带入题目</span><p>' + escapeHtml(context.question) + '</p><button type="button" class="text-button" data-return-question>返回题库继续作答</button></aside>');
    const back = $("[data-return-question]", view);
    if (back) back.addEventListener("click", () => {
      const questionButton = $('[data-tool="question-bank"]');
      if (questionButton) questionButton.click();
    });
  }

  function applyCalculatorPreset(tool, preset) {
    const inputs = preset && preset.inputs ? preset.inputs : {};
    if (tool === "root-locus") {
      const tab = $("#tab-formula");
      if (tab) tab.click();
      applyCalculatorInput("#formula-numerator-input", inputs.numerator || "1");
      applyCalculatorInput("#formula-denominator-input", inputs.denominator || "1");
      const calculate = $("#calculate-button");
      if (calculate) calculate.click();
      return;
    }
    if (tool === "second-order" && inputs.mode) {
      applyCalculatorInput("#time-mode", inputs.mode);
      const mode = $("#time-mode");
      if (mode) mode.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const modeSelectors = {
      modeling: "#modeling-mode",
      compensation: "#compensation-mode",
      discrete: "#discrete-mode",
      nonlinear: "#nonlinear-type",
      "state-space": "#state-mode"
    };
    if (inputs.mode != null && modeSelectors[tool]) {
      applyCalculatorInput(modeSelectors[tool], inputs.mode);
      const mode = $(modeSelectors[tool]);
      if (mode) mode.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const mappings = {
      routh: [["#routh-polynomial", inputs.polynomial], ["#routh-calculate", null]],
      frequency: [["#frequency-numerator", inputs.numerator], ["#frequency-denominator", inputs.denominator], ["#frequency-min", inputs.minimum], ["#frequency-max", inputs.maximum], ["#frequency-calculate", null]],
      nyquist: [["#nyquist-numerator", inputs.numerator], ["#nyquist-denominator", inputs.denominator], ["#nyquist-min", inputs.minimum], ["#nyquist-max", inputs.maximum], ["#nyquist-calculate", null]],
      "steady-error": [["#error-numerator", inputs.numerator], ["#error-denominator", inputs.denominator], ["#error-input-type", inputs.inputType], ["#error-amplitude", inputs.amplitude], ["#steady-error-calculate", null]],
      "second-order": [["#second-zeta", inputs.zeta], ["#second-wn", inputs.wn], ["#first-gain", inputs.gain], ["#first-time", inputs.timeConstant], ["#higher-numerator", inputs.numerator], ["#higher-denominator", inputs.denominator], ["#second-order-calculate", null]],
      compensation: [["#compensation-numerator", inputs.numerator], ["#compensation-denominator", inputs.denominator], ["#compensation-margin", inputs.margin], ["#compensation-safety", inputs.safety], ["#compensation-beta", inputs.beta], ["#compensation-calculate", null]],
      modeling: [["#partial-numerator", inputs.numerator], ["#partial-denominator", inputs.denominator], ["#modeling-calculate", null]],
      discrete: [["#jury-polynomial", inputs.polynomial], ["#difference-a", inputs.a], ["#difference-b", inputs.b], ["#difference-count", inputs.count], ["#discrete-calculate", null]],
      nonlinear: [["#nonlinear-gain", inputs.gain], ["#nonlinear-width", inputs.width], ["#nonlinear-amplitude", inputs.amplitude], ["#nonlinear-calculate", null]],
      "state-space": [["#state-a", inputs.a], ["#state-b", inputs.b], ["#state-c", inputs.c], ["#state-d", inputs.d], ["#state-calculate", null]]
    };
    (mappings[tool] || []).forEach(([selector, value]) => {
      if (value != null) applyCalculatorInput(selector, value);
      else { const button = $(selector); if (button) button.click(); }
    });
  }

  window.ControlCalculatorBridge = {
    open(tool, preset, context) {
      const target = $('[data-tool="' + tool + '"]');
      if (!target) return;
      window.ControlQuestionContext = context || null;
      target.click();
      showQuestionContext(tool, context);
      applyCalculatorPreset(tool, preset);
    }
  };

  addNavigation();
  addToolViews();
  // Dynamic transfer-function panels are inserted above; attach their shared
  // keypad immediately as well as through the observer used for later panels.
  if (window.TransferKeypad) window.TransferKeypad.attach(document);

  function installModeSwitch(selectSelector, panelAttribute, callback) {
    const select = $(selectSelector);
    select.addEventListener("change", () => {
      $$(`[${panelAttribute}]`).forEach((panel) => {
        const modes = panel.getAttribute(panelAttribute).split(/\s+/);
        panel.hidden = !modes.includes(select.value);
      });
      if (callback) callback(select.value);
    });
  }

  installModeSwitch("#modeling-mode", "data-modeling-panel");
  installModeSwitch("#compensation-mode", "data-compensation-panel", (mode) => { $("#lag-beta-field").hidden = mode !== "lag" && mode !== "laglead"; });
  installModeSwitch("#discrete-mode", "data-discrete-panel");
  installModeSwitch("#state-mode", "data-state-panel");

  function calculateModeling() {
    setError("#modeling-error");
    try {
      const mode = $("#modeling-mode").value;
      if (mode === "partial") {
        const transfer = parseTransfer("#partial-numerator", "#partial-denominator");
        const result = Advanced.partialFraction(transfer.numerator, transfer.denominator);
        const terms = result.terms.map((term) => {
          const denominator = "(s " + (term.pole.real < 0 && Math.abs(term.pole.imaginary) < 1e-8 ? "+ " + formatNumber(-term.pole.real) : "− (" + complexText(term.pole) + ")") + ")" + (term.power > 1 ? "<sup>" + term.power + "</sup>" : "");
          return '<div class="formula-line"><strong>' + complexText(term.coefficient) + "</strong><span>/ " + denominator + "</span></div>";
        }).join("");
        const inverse = result.terms.map((term) => {
          const factorial = Array.from({ length: Math.max(0, term.power - 1) }, (_, index) => index + 1).reduce((value, item) => value * item, 1);
          const coefficient = { real: term.coefficient.real / factorial, imaginary: term.coefficient.imaginary / factorial };
          return complexText(coefficient) + (term.power > 1 ? "t<sup>" + (term.power - 1) + "</sup>" : "") + "e<sup>(" + complexText(term.pole) + ")t</sup>";
        }).join(" + ") || "0";
        $("#modeling-result").innerHTML = summary("部分分式分解", result.terms.length + " 个极点项", false) +
          metricStrip([["分子阶次", String(transfer.numerator.length - 1)], ["分母阶次", String(transfer.denominator.length - 1)], ["重极点最高次数", String(Math.max(0, ...result.terms.map((term) => term.multiplicity))) ]]) +
          '<div class="result-section"><span class="block-label">展开结果</span><div class="formula-stack">' + (polynomialText(result.quotient) !== "0" ? '<div class="formula-line"><strong>Q(s)</strong><span>= ' + polynomialText(result.quotient) + "</span></div>" : "") + terms + "</div></div>" +
          '<div class="derivation-steps"><span class="block-label">拉氏反变换（t ≥ 0）</span><p>f(t) = ' + inverse + "</p></div>";
      } else if (mode === "laplace") {
        const type = $("#laplace-type").value;
        const parameter = Number($("#laplace-parameter").value);
        if (!Number.isFinite(parameter)) throw new Error("参数必须是有限数字");
        const factorial = (value) => Array.from({ length: Math.max(0, value) }, (_, index) => index + 1).reduce((product, item) => product * item, 1);
        let source;
        let transformed;
        if (type === "power") {
          if (!Number.isInteger(parameter) || parameter < 0 || parameter > 20) throw new Error("幂次n应为0到20的整数");
          source = "t<sup>" + parameter + "</sup>";
          transformed = factorial(parameter) + "/s<sup>" + (parameter + 1) + "</sup>";
        } else if (type === "exp") { source = "e<sup>" + formatNumber(parameter) + "t</sup>"; transformed = "1/(s−" + formatNumber(parameter) + ")"; }
        else if (type === "sin") { source = "sin(" + formatNumber(parameter) + "t)"; transformed = formatNumber(parameter) + "/(s²+" + formatNumber(parameter * parameter) + ")"; }
        else if (type === "cos") { source = "cos(" + formatNumber(parameter) + "t)"; transformed = "s/(s²+" + formatNumber(parameter * parameter) + ")"; }
        else { source = "f(t−" + formatNumber(parameter) + ")1(t−" + formatNumber(parameter) + ")"; transformed = "e<sup>−" + formatNumber(parameter) + "s</sup>F(s)"; }
        $("#modeling-result").innerHTML = summary("拉氏变换", "L{ " + source + " } = " + transformed, false) + '<div class="derivation-steps"><p>使用单边拉氏变换，默认信号在 t&lt;0 时为零。</p></div>';
      } else if (mode === "blocks") {
        const g1 = parseTransfer("#blocks-g1-numerator", "#blocks-g1-denominator");
        const g2 = parseTransfer("#blocks-g2-numerator", "#blocks-g2-denominator");
        const h = parseTransfer("#blocks-h-numerator", "#blocks-h-denominator");
        const operation = $("#blocks-operation").value;
        let result;
        let formula;
        if (operation === "series") { result = Advanced.rationalMultiply(g1, g2); formula = "G<sub>eq</sub>=G1·G2"; }
        else if (operation === "parallel") { result = Advanced.rationalAdd(g1, g2); formula = "G<sub>eq</sub>=G1+G2"; }
        else {
          const loop = Advanced.rationalMultiply(g1, h);
          const denominator = operation === "negative"
            ? Advanced.rationalAdd(Advanced.rational([1], [1]), loop)
            : Advanced.rationalSubtract(Advanced.rational([1], [1]), loop);
          result = Advanced.rationalDivide(g1, denominator);
          formula = operation === "negative" ? "G<sub>eq</sub>=G1/(1+G1H)" : "G<sub>eq</sub>=G1/(1−G1H)";
        }
        $("#modeling-result").innerHTML = summary("结构图等效传递函数", "G<sub>eq</sub>(s) = " + rationalText(result), false) +
          metricStrip([["连接关系", formula], ["等效零点数", String(Math.max(0, result.numerator.length - 1))], ["等效极点数", String(Math.max(0, result.denominator.length - 1))]]) +
          '<div class="derivation-steps"><p>结果已自动展开，并数值约去可消去的公共零极点。</p></div>';
      } else {
        const result = Advanced.masonGain($("#mason-edges").value, $("#mason-source").value.trim(), $("#mason-target").value.trim());
        const paths = result.paths.map((path, index) => '<p>P<sub>' + (index + 1) + "</sub>：" + path.edges.map((edge) => escapeHtml(edge.from + "→" + edge.to)).join(" · ") + "，Δ<sub>" + (index + 1) + "</sub> = " + rationalText(path.delta) + "</p>").join("");
        $("#modeling-result").innerHTML = summary("总传递函数", "T(s) = " + rationalText(result.transfer), false) +
          metricStrip([["前向通路", String(result.paths.length)], ["独立回路", String(result.loops.length)], ["不接触回路组", String(result.nonTouchingGroups.length)]]) +
          '<div class="derivation-steps"><span class="block-label">梅逊公式明细</span><p>Δ = ' + rationalText(result.delta) + "</p>" + paths + "</div>";
      }
    } catch (error) {
      setError("#modeling-error", error instanceof Error ? error.message : "建模计算失败");
    }
  }

  $("#modeling-calculate").addEventListener("click", calculateModeling);

  function nyquistSvg(result) {
    const positive = result.points.map((point) => ({ x: point.real, y: point.imaginary }));
    const negative = [...positive].reverse().map((point) => ({ x: point.x, y: -point.y }));
    const all = positive.concat(negative);
    const magnitudes = all.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]).sort((a, b) => a - b);
    const clip = Math.max(1.5, magnitudes[Math.floor(magnitudes.length * 0.94)] || 1.5);
    const visible = all.map((point) => ({ x: Math.max(-clip, Math.min(clip, point.x)), y: Math.max(-clip, Math.min(clip, point.y)) }));
    const width = 600;
    const height = 390;
    const padding = 34;
    const mapX = (value) => padding + (value + clip) / (2 * clip) * (width - 2 * padding);
    const mapY = (value) => height - padding - (value + clip) / (2 * clip) * (height - 2 * padding);
    const positivePath = visible.slice(0, positive.length).map((point, index) => (index ? "L" : "M") + mapX(point.x).toFixed(2) + " " + mapY(point.y).toFixed(2)).join(" ");
    const negativePath = visible.slice(positive.length).map((point, index) => (index ? "L" : "M") + mapX(point.x).toFixed(2) + " " + mapY(point.y).toFixed(2)).join(" ");
    // Keep a small, transparent hit target for every sampled point.  This makes
    // dense Nyquist curves inspectable without changing the visual line.
    const pointHits = visible.map((point, index) => '<circle class="plot-hit-point" data-plot-hit="true" cx="' + mapX(point.x).toFixed(2) + '" cy="' + mapY(point.y).toFixed(2) + '" r="7" data-plot-label="' + (index < positive.length ? 'ω=' + formatNumber(result.points[index].frequency, 4) : 'ω=' + formatNumber(result.points[positive.length * 2 - index - 1].frequency, 4)) + '" data-plot-x="' + formatNumber(point.x, 6) + '" data-plot-y="' + formatNumber(point.y, 6) + '"/>').join('');
    return '<svg viewBox="0 0 600 390" role="img" aria-label="Nyquist曲线"><line x1="34" y1="195" x2="566" y2="195" stroke="#aab4af"/><line x1="300" y1="34" x2="300" y2="356" stroke="#aab4af"/><path d="' + positivePath + '" fill="none" stroke="#176b4d" stroke-width="2.3"/><path d="' + negativePath + '" fill="none" stroke="#326ea8" stroke-width="2"/>' + pointHits + '<circle cx="' + mapX(-1) + '" cy="' + mapY(0) + '" r="5" fill="#b64b44"/><text x="' + (mapX(-1) + 7) + '" y="' + (mapY(0) - 8) + '" fill="#8b322d" font-size="10">(-1,j0)</text><text x="550" y="187" font-size="10" fill="#66716d">Re</text><text x="307" y="47" font-size="10" fill="#66716d">Im</text></svg>';
  }

  function calculateNyquist() {
    setError("#nyquist-error");
    try {
      const transfer = parseTransfer("#nyquist-numerator", "#nyquist-denominator");
      const result = Core.nyquistAnalysis(transfer.numerator, transfer.denominator, $("#nyquist-min").value, $("#nyquist-max").value, 520);
      $("#nyquist-result").innerHTML = summary("闭环稳定性", result.closedLoopStable ? "稳定：Z = 0" : "不稳定：Z = " + result.closedLoopRightHalfPlanePoles, !result.closedLoopStable) +
        metricStrip([["P（开环右半平面极点）", String(result.openLoopRightHalfPlanePoles)], ["N（逆时针净围绕数）", String(result.counterclockwiseEncirclements)], ["Z（闭环右半平面极点）", String(result.closedLoopRightHalfPlanePoles)], ["闭环带宽", result.bandwidth ? formatNumber(result.bandwidth) + " rad/s" : "未检出"]]) +
        '<div class="nyquist-plot"><span class="block-label">Nyquist曲线</span>' + nyquistSvg(result) + "</div>" +
        '<div class="derivation-steps"><p>谐振峰值 M<sub>r</sub> = ' + formatNumber(result.resonantPeak) + "，谐振频率 ω<sub>r</sub> = " + formatNumber(result.resonantFrequency) + " rad/s。</p></div>";
    } catch (error) { setError("#nyquist-error", error instanceof Error ? error.message : "Nyquist计算失败"); }
  }

  $("#nyquist-calculate").addEventListener("click", calculateNyquist);

  function calculateCompensation() {
    setError("#compensation-error");
    try {
      const mode = $("#compensation-mode").value;
      if (mode === "pid") {
        const result = Core.zieglerNicholsPid($("#pid-ku").value, $("#pid-tu").value, $("#pid-type").value);
        $("#compensation-result").innerHTML = summary("整定结果", result.type + " 控制器", false) + metricStrip([["Kp", formatNumber(result.kp)], ["Ki", formatNumber(result.ki)], ["Kd", formatNumber(result.kd)], ["Ti / Td", formatNumber(result.ti) + " / " + formatNumber(result.td)]]) + '<div class="derivation-steps"><p>并联形式：G<sub>c</sub>(s)=Kp+Ki/s+Kd·s。</p></div>';
        return;
      }
      const transfer = parseTransfer("#compensation-numerator", "#compensation-denominator");
      if (mode === "laglead") {
        const desiredMargin = Number($("#compensation-margin").value);
        const safety = Number($("#compensation-safety").value);
        const beta = Number($("#compensation-beta").value);
        const lagTarget = Math.max(20, desiredMargin - 20);
        const lag = Core.lagCompensatorDesign(transfer.numerator, transfer.denominator, lagTarget, beta, safety);
        const laggedNumerator = Solver.multiply(transfer.numerator, lag.compensator.numerator);
        const laggedDenominator = Solver.multiply(transfer.denominator, lag.compensator.denominator);
        let lead = null;
        if ((lag.compensated.phaseMargin || 0) < desiredMargin - 0.5) lead = Core.leadCompensatorDesign(laggedNumerator, laggedDenominator, desiredMargin, safety);
        const leadCompensator = lead ? lead.compensator : { numerator: [1], denominator: [1] };
        const combined = Advanced.rationalMultiply(lag.compensator, leadCompensator);
        const finalBode = lead ? lead.compensated : lag.compensated;
        $("#compensation-result").innerHTML = summary("滞后-超前组合网络", "Gc(s) = " + rationalText(combined), false) +
          metricStrip([["校正前相角裕度", formatNumber(lag.original.phaseMargin) + "°"], ["滞后级后裕度", formatNumber(lag.compensated.phaseMargin) + "°"], ["组合后裕度", formatNumber(finalBode.phaseMargin) + "°"], ["低频倍率β", formatNumber(beta)]]) +
          '<div class="derivation-steps"><p>先用滞后级改善低频精度，再由超前级补足相角裕度；组合网络为两级乘积。</p></div>';
        return;
      }
      const result = mode === "lead"
        ? Core.leadCompensatorDesign(transfer.numerator, transfer.denominator, $("#compensation-margin").value, $("#compensation-safety").value)
        : Core.lagCompensatorDesign(transfer.numerator, transfer.denominator, $("#compensation-margin").value, $("#compensation-beta").value, $("#compensation-safety").value);
      const parameterItems = mode === "lead"
        ? [["α", formatNumber(result.alpha)], ["T", formatNumber(result.timeConstant) + " s"], ["最大相角频率", formatNumber(result.maximumPhaseFrequency) + " rad/s"]]
        : [["β", formatNumber(result.beta)], ["T", formatNumber(result.timeConstant) + " s"], ["新交叉频率", formatNumber(result.crossover) + " rad/s"]];
      $("#compensation-result").innerHTML = summary(mode === "lead" ? "超前校正网络" : "滞后校正网络", "Gc(s) = " + rationalText(result.compensator), false) +
        metricStrip([["校正前相角裕度", formatNumber(result.original.phaseMargin) + "°"], ["校正后相角裕度", formatNumber(result.compensated.phaseMargin) + "°"], ["校正后ωc", formatNumber(result.compensated.gainCrossover) + " rad/s"]]) +
        '<div class="metric-grid">' + parameterItems.map((item) => '<div><span>' + item[0] + "</span><strong>" + item[1] + "</strong></div>").join("") + "</div>";
    } catch (error) { setError("#compensation-error", error instanceof Error ? error.message : "校正设计失败"); }
  }

  $("#compensation-calculate").addEventListener("click", calculateCompensation);

  function responseSvg(values) {
    const width = 600;
    const height = 230;
    const padding = 28;
    const minimum = Math.min(0, ...values);
    const maximum = Math.max(1, ...values);
    const range = Math.max(1e-8, maximum - minimum);
    const mapX = (index) => padding + index / Math.max(1, values.length - 1) * (width - 2 * padding);
    const mapY = (value) => height - padding - (value - minimum) / range * (height - 2 * padding);
    const path = values.map((value, index) => (index ? "L" : "M") + mapX(index).toFixed(2) + " " + mapY(value).toFixed(2)).join(" ");
    const stems = values.slice(0, 80).map((value, index) => '<line x1="' + mapX(index) + '" y1="' + mapY(0) + '" x2="' + mapX(index) + '" y2="' + mapY(value) + '" stroke="#a9cfbc"/><circle class="plot-hit-point" data-plot-hit="true" cx="' + mapX(index) + '" cy="' + mapY(value) + '" r="5" fill="#176b4d" data-plot-label="k=' + index + '" data-plot-x="' + index + '" data-plot-y="' + formatNumber(value, 8) + '"/>').join("");
    return '<svg viewBox="0 0 600 230" role="img" aria-label="离散响应"><line x1="28" y1="' + mapY(0) + '" x2="572" y2="' + mapY(0) + '" stroke="#aab4af"/>' + stems + '<path d="' + path + '" fill="none" stroke="#176b4d" stroke-width="1.7"/></svg>';
  }

  function calculateDiscrete() {
    setError("#discrete-error");
    try {
      const mode = $("#discrete-mode").value;
      if (mode === "jury") {
        const coefficients = Core.parsePolynomial($("#jury-polynomial").value.replace(/[zZ]/g, "s"));
        const result = Advanced.juryStability(coefficients);
        const rows = result.rows.map((row, index) => '<tr><th>' + (index + 1) + "</th><td>" + row.coefficients.map(formatNumber).join(", ") + "</td><td>" + formatNumber(row.reflection) + '</td><td><span class="condition-mark ' + (row.passed ? "pass" : "fail") + '">' + (row.passed ? "通过" : "不通过") + "</span></td></tr>").join("");
        $("#discrete-result").innerHTML = summary("Jury判据", result.stable ? "稳定：全部根在单位圆内" : "不稳定或临界稳定", !result.stable) + metricStrip([["F(1)", formatNumber(result.pAtOne)], ["(−1)^nF(−1)", formatNumber(Math.pow(-1, result.degree) * result.pAtMinusOne)], ["系统阶次", String(result.degree)]]) + '<div class="routh-table-wrap"><table class="routh-table"><thead><tr><th>递推</th><th>系数行</th><th>反射系数</th><th>条件</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
      } else if (mode === "difference") {
        const result = Advanced.simulateDifferenceEquation(parseCoefficientList($("#difference-a").value), parseCoefficientList($("#difference-b").value), $("#difference-input").value, $("#difference-count").value);
        const finalValue = result.output[result.output.length - 1];
        const peak = Math.max(...result.output.map(Math.abs));
        $("#discrete-result").innerHTML = summary("差分方程响应", "已计算 " + result.sampleCount + " 个采样点", false) +
          metricStrip([["y[0]", formatNumber(result.output[0])], ["y[末]", formatNumber(finalValue)], ["最大|y[k]|", formatNumber(peak)]]) +
          '<div class="response-plot"><span class="block-label">采样响应</span>' + responseSvg(result.output) + "</div>";
      } else if (mode === "zoh") {
        const result = Advanced.discretizeStateSpace(Advanced.parseMatrix($("#zoh-a").value), Advanced.parseMatrix($("#zoh-b").value), $("#zoh-time").value);
        $("#discrete-result").innerHTML = summary("零阶保持离散化", "采样周期 T = " + formatNumber(result.sampleTime), false) + '<div class="matrix-results"><div><span>A<sub>d</sub></span>' + matrixText(result.ad) + '</div><div><span>B<sub>d</sub></span>' + matrixText(result.bd) + "</div></div>";
      } else if (mode === "ztransform") {
        const type = $("#ztransform-type").value;
        const parameter = Number($("#ztransform-parameter").value);
        let source;
        let transformed;
        let roc;
        if (type === "impulse") { source = "δ[k]"; transformed = "1"; roc = "全z平面"; }
        else if (type === "step") { source = "1[k]"; transformed = "z/(z−1)"; roc = "|z|>1"; }
        else if (type === "exp") { source = formatNumber(parameter) + "<sup>k</sup>"; transformed = "z/(z−" + formatNumber(parameter) + ")"; roc = "|z|>" + formatNumber(Math.abs(parameter)); }
        else if (type === "ramp") { source = "k"; transformed = "z/(z−1)<sup>2</sup>"; roc = "|z|>1"; }
        else if (type === "delay") { const delay = Math.max(0, Math.round(parameter)); source = "1[k−" + delay + "]"; transformed = "z<sup>1−" + delay + "</sup>/(z−1)"; roc = "|z|>1"; }
        else {
          const values = parseCoefficientList($("#ztransform-values").value);
          source = "{" + values.map(formatNumber).join(", ") + "}";
          transformed = values.map((value, index) => (index ? " + " : "") + formatNumber(value) + (index ? "z<sup>−" + index + "</sup>" : "")).join("");
          roc = "除z=0外全平面";
        }
        $("#discrete-result").innerHTML = summary("单边Z变换", "Z{ " + source + " } = " + transformed, false) + metricStrip([["收敛域", roc], ["稳定域", "单位圆内"], ["映射", "z=e<sup>sT</sup>"]]);
      } else {
        const numeratorExpression = $("#zinverse-numerator").value.replace(/[zZ]/g, "s");
        const denominatorExpression = $("#zinverse-denominator").value.replace(/[zZ]/g, "s");
        const transfer = Solver.transferFunctionFromExpressions(numeratorExpression, denominatorExpression);
        if (transfer.numerator.length > transfer.denominator.length) throw new Error("因果Z反变换要求X(z)为真分式或分子分母同阶");
        const paddedNumerator = Array(transfer.denominator.length - transfer.numerator.length).fill(0).concat(transfer.numerator);
        const response = Advanced.simulateDifferenceEquation(transfer.denominator, paddedNumerator, "impulse", $("#zinverse-count").value);
        const partial = Advanced.partialFraction(transfer.numerator, transfer.denominator);
        const poles = Solver.complexPolynomialRoots(transfer.denominator);
        const stable = poles.every((pole) => Math.hypot(pole.real, pole.imaginary) < 1 - 1e-8);
        const termText = partial.terms.map((term) => complexText(term.coefficient) + "/(z−(" + complexText(term.pole) + "))" + (term.power > 1 ? "<sup>" + term.power + "</sup>" : "")).join(" + ");
        $("#discrete-result").innerHTML = summary("Z反变换序列", "x[k] = {" + response.output.slice(0, 8).map(formatNumber).join(", ") + (response.output.length > 8 ? ", …" : "") + "}", false) +
          metricStrip([["极点", poles.map(complexText).join("；")], ["单位圆稳定", stable ? "是" : "否"], ["部分分式项", String(partial.terms.length)]]) +
          '<div class="derivation-steps"><p>X(z) = ' + (termText || polynomialText(partial.quotient, "z")) + "</p></div><div class=\"response-plot\">" + responseSvg(response.output) + "</div>";
      }
    } catch (error) { setError("#discrete-error", error instanceof Error ? error.message : "离散系统计算失败"); }
  }

  $("#discrete-calculate").addEventListener("click", calculateDiscrete);

  function calculateNonlinear() {
    setError("#nonlinear-error");
    try {
      const type = $("#nonlinear-type").value;
      const parameters = { gain: Number($("#nonlinear-gain").value), width: Number($("#nonlinear-width").value) };
      const value = Advanced.describingFunction(type, parameters, $("#nonlinear-amplitude").value);
      const transfer = parseTransfer("#nonlinear-numerator", "#nonlinear-denominator");
      const cycle = Advanced.findLimitCycle(transfer.numerator, transfer.denominator, type, parameters, { amplitudeMin: 0.01, amplitudeMax: 100, frequencyMin: 0.001, frequencyMax: 1000 });
      $("#nonlinear-result").innerHTML = summary("描述函数", "N(A) = " + complexText(value), false) + metricStrip([["候选振幅 A", formatNumber(cycle.amplitude)], ["候选频率 ω", formatNumber(cycle.frequency) + " rad/s"], ["方程残差", formatNumber(cycle.residual)], ["数值收敛", cycle.converged ? "是" : "否"]]) + '<div class="derivation-steps"><p>' + (cycle.converged ? "找到满足 G(jω)≈−1/N(A) 的自激振荡候选点。" : "当前搜索范围内没有可靠的极限环交点；最小残差点仅供复核。") + "</p></div>";
    } catch (error) { setError("#nonlinear-error", error instanceof Error ? error.message : "非线性计算失败"); }
  }

  $("#nonlinear-calculate").addEventListener("click", calculateNonlinear);

  function calculateStateSpace() {
    setError("#state-error");
    try {
      const mode = $("#state-mode").value;
      if (mode === "analysis") {
        const a = Advanced.parseMatrix($("#state-a").value);
        const b = Advanced.parseMatrix($("#state-b").value);
        const c = Advanced.parseMatrix($("#state-c").value);
        const d = Advanced.parseMatrix($("#state-d").value);
        const controllability = Advanced.controllabilityMatrix(a, b);
        const observability = Advanced.observabilityMatrix(a, c);
        const rankC = Advanced.matrixRank(controllability);
        const rankO = Advanced.matrixRank(observability);
        const order = a.length;
        const transfer = Advanced.stateSpaceToTransfer(a, b, c, d);
        const transition = Advanced.matrixExponential(a, Number($("#state-time").value));
        $("#state-result").innerHTML = summary("基本性质", (rankC === order ? "完全能控" : "不完全能控") + "；" + (rankO === order ? "完全能观" : "不完全能观"), rankC !== order || rankO !== order) + metricStrip([["特征多项式", polynomialText(Advanced.characteristicPolynomial(a))], ["能控矩阵秩", rankC + "/" + order], ["能观矩阵秩", rankO + "/" + order]]) + '<div class="matrix-results"><div><span>e<sup>At</sup></span>' + matrixText(transition) + '</div><div><span>G(s)</span><strong>' + rationalText(transfer) + "</strong></div></div>";
      } else if (mode === "transfer") {
        const transfer = parseTransfer("#state-transfer-numerator", "#state-transfer-denominator");
        const model = Advanced.transferToControllableCanonical(transfer.numerator, transfer.denominator);
        $("#state-result").innerHTML = summary("能控标准型", "状态维数 n = " + model.a.length, false) + '<div class="matrix-results"><div><span>A</span>' + matrixText(model.a) + '</div><div><span>B</span>' + matrixText(model.b) + '</div><div><span>C</span>' + matrixText(model.c) + '</div><div><span>D</span>' + matrixText(model.d) + "</div></div>";
      } else if (mode === "feedback") {
        const result = Advanced.polePlacement(Advanced.parseMatrix($("#feedback-a").value), Advanced.parseMatrix($("#feedback-b").value), Solver.parseComplexList($("#feedback-poles").value, false));
        $("#state-result").innerHTML = summary("状态反馈 u=−Kx+r", "K = " + matrixText(result.gain), false) + metricStrip([["期望特征多项式", polynomialText(result.desiredPolynomial)], ["能控矩阵秩", String(Advanced.matrixRank(result.controllability))], ["配置极点数", String(result.desiredPolynomial.length - 1)]]);
      } else if (mode === "observer") {
        const result = Advanced.observerPlacement(Advanced.parseMatrix($("#observer-a").value), Advanced.parseMatrix($("#observer-c").value), Solver.parseComplexList($("#observer-poles").value, false));
        $("#state-result").innerHTML = summary("全维状态观测器", "L = " + matrixText(result.gain), false) + metricStrip([["期望误差特征多项式", polynomialText(result.desiredPolynomial)], ["观测器增益维数", result.gain.length + "×" + result.gain[0].length], ["配置极点数", String(result.desiredPolynomial.length - 1)]]);
      } else {
        const p = Advanced.lyapunovSolve(Advanced.parseMatrix($("#lyapunov-a").value), Advanced.parseMatrix($("#lyapunov-q").value));
        const eigen = Solver.complexPolynomialRoots(Advanced.characteristicPolynomial(p));
        const positive = eigen.every((value) => value.real > 1e-8 && Math.abs(value.imaginary) < 1e-7);
        $("#state-result").innerHTML = summary("Lyapunov方程解", positive ? "P正定，给定A为Hurwitz矩阵" : "P未判定为正定", !positive) + '<div class="matrix-results"><div><span>P</span>' + matrixText(p) + '</div><div><span>P的特征值</span><strong>' + eigen.map(complexText).join("，") + "</strong></div></div>";
      }
    } catch (error) { setError("#state-error", error instanceof Error ? error.message : "状态空间计算失败"); }
  }

  $("#state-calculate").addEventListener("click", calculateStateSpace);

  let theoryIndex = 0;
  let theoryRevealed = false;

  function availableQuestions() {
    const profile = $("#school-profile").value;
    const chapter = $("#theory-chapter").value;
    return theoryQuestions.filter((item) => (profile === "all" || item.schools.includes(profile)) && (chapter === "all" || item.chapter === chapter));
  }

  function renderTheory() {
    const questions = availableQuestions();
    if (!questions.length) {
      $("#theory-card").innerHTML = '<div class="empty-answer">当前筛选下没有题目</div>';
      $("#theory-progress").textContent = "0 / 0";
      return;
    }
    theoryIndex = (theoryIndex + questions.length) % questions.length;
    const item = questions[theoryIndex];
    $("#theory-progress").textContent = (theoryIndex + 1) + " / " + questions.length;
    $("#theory-card").innerHTML = '<div class="theory-meta"><span>' + escapeHtml(item.chapter) + "</span>" + item.schools.map((school) => "<i>" + school + "</i>").join("") + '</div><h3>' + escapeHtml(item.question) + "</h3>" + (theoryRevealed ? '<div class="theory-answer"><span>参考答案</span><p>' + escapeHtml(item.answer) + '</p><div class="keyword-list">' + item.keywords.map((keyword) => "<b>" + escapeHtml(keyword) + "</b>").join("") + "</div></div>" : '<div class="answer-placeholder">请先独立作答，再显示参考答案。</div>');
    $("#theory-reveal").textContent = theoryRevealed ? "隐藏参考答案" : "显示参考答案";
  }

  [...new Set(theoryQuestions.map((item) => item.chapter))].forEach((chapter) => {
    $("#theory-chapter").insertAdjacentHTML("beforeend", '<option value="' + escapeHtml(chapter) + '">' + escapeHtml(chapter) + "</option>");
  });
  $("#theory-chapter").addEventListener("change", () => { theoryIndex = 0; theoryRevealed = false; renderTheory(); });
  $("#school-profile").addEventListener("change", () => { theoryIndex = 0; theoryRevealed = false; renderTheory(); });
  $("#theory-previous").addEventListener("click", () => { theoryIndex -= 1; theoryRevealed = false; renderTheory(); });
  $("#theory-next").addEventListener("click", () => { theoryIndex += 1; theoryRevealed = false; renderTheory(); });
  $("#theory-reveal").addEventListener("click", () => { theoryRevealed = !theoryRevealed; renderTheory(); });

  function extendTimeDomain() {
    const inputArea = $("#tool-second-order .calculator-input-area");
    inputArea.insertAdjacentHTML("afterbegin", '<label class="field"><span class="field-label">系统类型</span><select id="time-mode"><option value="second">典型二阶系统</option><option value="first">典型一阶系统</option><option value="higher">高阶系统与主导极点</option></select></label>');
    const existingGrid = $("#tool-second-order .two-field-grid");
    const existingRange = $("#tool-second-order .range-field");
    existingGrid.dataset.timePanel = "second";
    existingRange.dataset.timePanel = "second";
    existingGrid.insertAdjacentHTML("beforebegin", '<div class="mode-panel" data-time-panel="first" hidden><div class="two-field-grid"><label class="field"><span class="field-label">稳态增益 K</span><input id="first-gain" type="number" value="1" step="0.1"></label><label class="field"><span class="field-label">时间常数 T</span><input id="first-time" type="number" value="1" min="0.000001"></label></div></div><div class="mode-panel" data-time-panel="higher" hidden>' + transferInput("higher", "1", "(s+1)(s^2+2s+5)") + "</div>");
    installModeSwitch("#time-mode", "data-time-panel");
    $("#second-order-calculate span").textContent = "计算时域指标";
    $("#second-order-calculate").addEventListener("click", () => {
      const mode = $("#time-mode").value;
      if (mode === "second") return;
      setError("#second-order-error");
      try {
        if (mode === "first") {
          const result = Core.firstOrderMetrics($("#first-gain").value, $("#first-time").value);
          const values = Array.from({ length: 121 }, (_, index) => result.valueAtTime(index * result.settlingTime2 / 120));
          $("#second-order-result").innerHTML = summary("一阶系统", "G(s) = " + formatNumber(result.gain) + "/(" + formatNumber(result.timeConstant) + "s+1)", false) + metricStrip([["极点", formatNumber(result.pole)], ["10%~90%上升时间", formatNumber(result.riseTime10To90) + " s"], ["2%调节时间", formatNumber(result.settlingTime2) + " s"], ["5%调节时间", formatNumber(result.settlingTime5) + " s"]]) + '<div class="response-plot">' + responseSvg(values) + "</div>";
        } else {
          const transfer = parseTransfer("#higher-numerator", "#higher-denominator");
          const result = Core.higherOrderAnalysis(transfer.numerator, transfer.denominator);
          const equivalent = result.equivalent ? (result.equivalent.order === 2 ? "二阶：ζ=" + formatNumber(result.equivalent.dampingRatio) + "，ωn=" + formatNumber(result.equivalent.naturalFrequency) : "一阶：T=" + formatNumber(result.equivalent.timeConstant)) : "不适合低阶近似";
          $("#second-order-result").innerHTML = summary("高阶系统稳定性", result.stable ? "稳定" : "不稳定或临界稳定", !result.stable) + metricStrip([["全部极点", result.poles.map(complexText).join("；")], ["主导极点", result.dominantPoles.map(complexText).join("；")], ["分离比", formatNumber(result.separationRatio)], ["近似可靠性", result.approximationReliable ? "满足5倍经验准则" : "需谨慎"]]) + '<div class="derivation-steps"><p>低阶近似：' + equivalent + "。</p><p>近似零极点相消对数：" + result.cancellations.length + "。</p></div>";
        }
      } catch (error) { setError("#second-order-error", error instanceof Error ? error.message : "时域计算失败"); }
    });
  }

  function extendSteadyError() {
    const inputArea = $("#tool-steady-error .calculator-input-area");
    inputArea.insertAdjacentHTML("afterbegin", '<label class="field"><span class="field-label">误差来源</span><select id="steady-mode"><option value="reference">给定输入误差</option><option value="disturbance">扰动输入误差</option></select></label>');
    const transfer = $("#tool-steady-error .compact-transfer-input");
    const grid = $("#tool-steady-error .two-field-grid");
    transfer.dataset.steadyPanel = "reference";
    grid.dataset.steadyPanel = "reference";
    transfer.insertAdjacentHTML("beforebegin", '<div class="mode-panel" data-steady-panel="disturbance" hidden><p class="field-meta formula-note">结构：R → G1 → (+D) → G2 → Y，H为反馈环节</p>' + transferInput("disturbance-g1", "1", "s") + transferInput("disturbance-g2", "1", "s+1") + transferInput("disturbance-h", "1", "1") + '<div class="two-field-grid"><label class="field"><span class="field-label">扰动信号</span><select id="disturbance-order"><option value="0">A·1(t)</option><option value="1">A·t</option><option value="2">A·t²/2</option></select></label><label class="field"><span class="field-label">幅值 A</span><input id="disturbance-amplitude" type="number" value="1"></label></div></div>');
    installModeSwitch("#steady-mode", "data-steady-panel");
    $("#steady-error-calculate").addEventListener("click", () => {
      if ($("#steady-mode").value !== "disturbance") return;
      setError("#steady-error-message");
      try {
        const g1 = parseTransfer("#disturbance-g1-numerator", "#disturbance-g1-denominator");
        const g2 = parseTransfer("#disturbance-g2-numerator", "#disturbance-g2-denominator");
        const h = parseTransfer("#disturbance-h-numerator", "#disturbance-h-denominator");
        const loop = Advanced.rationalMultiply(Advanced.rationalMultiply(g1, g2), h);
        const disturbancePath = Advanced.rationalNegate(Advanced.rationalMultiply(g2, h));
        const errorTransfer = Advanced.rationalDivide(disturbancePath, Advanced.rationalAdd(Advanced.rational([1], [1]), loop));
        const value = Advanced.finalValueForPolynomialInput(errorTransfer, Number($("#disturbance-order").value), Number($("#disturbance-amplitude").value));
        $("#steady-error-result").innerHTML = summary("扰动引起的稳态误差", "e<sub>ss,D</sub> = " + formatNumber(value), !Number.isFinite(value)) + metricStrip([["E(s)/D(s)", rationalText(errorTransfer)], ["环路传递函数", rationalText(loop)], ["扰动注入位置", "G1之后、G2之前"]]) + '<div class="derivation-steps"><p>E(s)/D(s)=−G2(s)H(s)/[1+G1(s)G2(s)H(s)]，再用终值定理计算。</p></div>';
      } catch (error) { setError("#steady-error-message", error instanceof Error ? error.message : "扰动误差计算失败"); }
    });
  }

  extendTimeDomain();
  extendSteadyError();
  if (window.TransferKeypad) window.TransferKeypad.attach(document);
  renderTheory();

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    const view = event.target.closest(".tool-view");
    if (!view) return;
    const buttons = {
      "tool-modeling": "#modeling-calculate",
      "tool-steady-error": "#steady-error-calculate",
      "tool-second-order": "#second-order-calculate",
      "tool-nyquist": "#nyquist-calculate",
      "tool-compensation": "#compensation-calculate",
      "tool-discrete": "#discrete-calculate",
      "tool-nonlinear": "#nonlinear-calculate",
      "tool-state-space": "#state-calculate"
    };
    if (buttons[view.id]) {
      event.preventDefault();
      $(buttons[view.id]).click();
    }
  });

  [calculateModeling, calculateNyquist, calculateCompensation, calculateDiscrete, calculateNonlinear, calculateStateSpace].forEach((calculate) => calculate());

  // SVG plots are deliberately dependency-free.  The interaction layer is
  // attached after rendering and also watches future result updates, so every
  // calculator gets the same wheel zoom, drag pan and point inspection.
  (function installPlotInteractions() {
    const SVG_NS = "http://www.w3.org/2000/svg";
    let tooltip;
    let activeSvg = null;
    const plotSelector = ".response-plot svg, .bode-plot svg, .nyquist-plot svg, .root-locus-block svg, .axis-block svg";

    function getTooltip() {
      if (tooltip) return tooltip;
      tooltip = document.createElement("div");
      tooltip.className = "plot-tooltip";
      tooltip.setAttribute("role", "status");
      tooltip.hidden = true;
      document.body.appendChild(tooltip);
      return tooltip;
    }

    function showTooltip(event, target) {
      const label = target.getAttribute("data-plot-label") || target.parentElement && target.parentElement.getAttribute("aria-label");
      if (!label) return;
      const tip = getTooltip();
      const x = target.getAttribute("data-plot-x");
      const y = target.getAttribute("data-plot-y");
      tip.innerHTML = "<strong>数据点</strong><span>" + label + "</span>" + (x !== null || y !== null ? "<small>坐标：" + (x || "—") + "，" + (y || "—") + "</small>" : "");
      tip.hidden = false;
      const margin = 12;
      const rect = tip.getBoundingClientRect();
      const left = Math.min(window.innerWidth - rect.width - margin, Math.max(margin, event.clientX + 14));
      const top = Math.min(window.innerHeight - rect.height - margin, Math.max(margin, event.clientY - rect.height - 14));
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }

    function hideTooltip() {
      if (tooltip) tooltip.hidden = true;
    }

    function updateTransform(state) {
      state.viewport.setAttribute("transform", "translate(" + state.tx.toFixed(2) + " " + state.ty.toFixed(2) + ") scale(" + state.scale.toFixed(4) + ")");
    }

    function reset(state) {
      state.scale = 1;
      state.tx = 0;
      state.ty = 0;
      updateTransform(state);
    }

    function pointInView(svg, event) {
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      return {
        x: viewBox.x + (event.clientX - rect.left) / rect.width * viewBox.width,
        y: viewBox.y + (event.clientY - rect.top) / rect.height * viewBox.height
      };
    }

    function attach(svg) {
      if (!svg || svg.dataset.plotInteractive === "true") return;
      svg.dataset.plotInteractive = "true";
      svg.classList.add("interactive-plot");
      svg.setAttribute("tabindex", "0");
      svg.setAttribute("aria-description", "滚轮缩放，拖动平移，双击复位；悬停数据点查看具体数值");
      const viewport = document.createElementNS(SVG_NS, "g");
      viewport.setAttribute("data-plot-viewport", "true");
      while (svg.firstChild) viewport.appendChild(svg.firstChild);
      svg.appendChild(viewport);
      const state = { viewport, scale: 1, tx: 0, ty: 0, dragging: false, lastX: 0, lastY: 0 };
      svg.__plotState = state;
      const hint = svg.parentElement && svg.parentElement.querySelector(".plot-help");
      if (!hint && svg.parentElement) {
        const help = document.createElement("span");
        help.className = "plot-help";
        help.textContent = "滚轮缩放 · 拖动平移 · 悬停查看数据 · 双击复位";
        svg.parentElement.appendChild(help);
      }
      svg.addEventListener("wheel", (event) => {
        event.preventDefault();
        const before = pointInView(svg, event);
        const factor = event.deltaY < 0 ? 1.16 : 1 / 1.16;
        const next = Math.max(0.65, Math.min(8, state.scale * factor));
        state.tx = before.x - (before.x - state.tx) * (next / state.scale);
        state.ty = before.y - (before.y - state.ty) * (next / state.scale);
        state.scale = next;
        updateTransform(state);
      }, { passive: false });
      svg.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        state.dragging = true;
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        svg.setPointerCapture(event.pointerId);
        svg.classList.add("is-panning");
      });
      svg.addEventListener("pointermove", (event) => {
        if (state.dragging) {
          const rect = svg.getBoundingClientRect();
          const viewBox = svg.viewBox.baseVal;
          state.tx += (event.clientX - state.lastX) / rect.width * viewBox.width;
          state.ty += (event.clientY - state.lastY) / rect.height * viewBox.height;
          state.lastX = event.clientX;
          state.lastY = event.clientY;
          updateTransform(state);
        }
        const target = event.target && event.target.closest ? event.target.closest("[data-plot-label]") : null;
        if (target && svg.contains(target)) showTooltip(event, target); else hideTooltip();
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((name) => svg.addEventListener(name, (event) => {
        if (name === "pointerleave" && !state.dragging) hideTooltip();
        if (state.dragging && (name !== "pointerleave" || !svg.hasPointerCapture(event.pointerId))) {
          state.dragging = false;
          svg.classList.remove("is-panning");
        }
      }));
      svg.addEventListener("dblclick", () => reset(state));
      svg.addEventListener("keydown", (event) => {
        if (event.key === "0" || event.key === "Escape") { event.preventDefault(); reset(state); }
        if (event.key === "+" || event.key === "=") { state.scale = Math.min(8, state.scale * 1.16); updateTransform(state); }
        if (event.key === "-") { state.scale = Math.max(.65, state.scale / 1.16); updateTransform(state); }
      });
    }

    function scan(root) {
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll(plotSelector).forEach(attach);
    }
    scan(document);
    new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => scan(node)))).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest && event.target.closest(".interactive-plot")) activeSvg = event.target.closest(".interactive-plot");
    });
    document.addEventListener("visibilitychange", hideTooltip);
  }());
})();
