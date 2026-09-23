(function () {
  "use strict";

  const Core = window.ControlExamCore;
  const Solver = window.RootLocusSolver;
  const syllabus = window.ControlSyllabus || [];
  const elements = {
    profile: document.querySelector("#school-profile"),
    profileBadge: document.querySelector("#active-profile-badge"),
    nav: document.querySelector("#module-nav"),
    search: document.querySelector("#coverage-search"),
    statusFilter: document.querySelector("#coverage-status-filter"),
    coverageStats: document.querySelector("#coverage-stats"),
    coverageBody: document.querySelector("#coverage-table-body"),
    routhInput: document.querySelector("#routh-polynomial"),
    routhExample: document.querySelector("#routh-example"),
    routhButton: document.querySelector("#routh-calculate"),
    routhError: document.querySelector("#routh-error"),
    routhResult: document.querySelector("#routh-result"),
    errorNumerator: document.querySelector("#error-numerator"),
    errorDenominator: document.querySelector("#error-denominator"),
    errorInputType: document.querySelector("#error-input-type"),
    errorAmplitude: document.querySelector("#error-amplitude"),
    steadyButton: document.querySelector("#steady-error-calculate"),
    steadyMessage: document.querySelector("#steady-error-message"),
    steadyResult: document.querySelector("#steady-error-result"),
    secondZeta: document.querySelector("#second-zeta"),
    secondWn: document.querySelector("#second-wn"),
    secondRange: document.querySelector("#second-zeta-range"),
    secondButton: document.querySelector("#second-order-calculate"),
    secondError: document.querySelector("#second-order-error"),
    secondResult: document.querySelector("#second-order-result"),
    frequencyNumerator: document.querySelector("#frequency-numerator"),
    frequencyDenominator: document.querySelector("#frequency-denominator"),
    frequencyExample: document.querySelector("#frequency-example"),
    frequencyMinimum: document.querySelector("#frequency-min"),
    frequencyMaximum: document.querySelector("#frequency-max"),
    frequencyButton: document.querySelector("#frequency-calculate"),
    frequencyError: document.querySelector("#frequency-error"),
    frequencyResult: document.querySelector("#frequency-result")
  };

  let currentProfile = "all";
  let currentTool = "overview";

  function formatNumber(value, digits) {
    if (value === Infinity) {
      return "∞";
    }
    if (value === -Infinity) {
      return "−∞";
    }
    if (!Number.isFinite(value)) {
      return "无定义";
    }
    if (Math.abs(value) < 1e-11) {
      return "0";
    }
    const precision = digits || 6;
    const rounded = Number(value.toPrecision(precision));
    return Math.abs(rounded) >= 1e7 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-5)
      ? rounded.toExponential(precision - 1)
      : String(rounded);
  }

  function profileName(profile) {
    if (profile === "828") {
      return "浙江工大 828";
    }
    if (profile === "861") {
      return "杭电 861";
    }
    return "828 + 861";
  }

  function schoolsMatch(schools) {
    return currentProfile === "all" || schools.includes(currentProfile);
  }

  function showTool(toolId) {
    const target = document.querySelector("#tool-" + toolId);
    if (!target) {
      return;
    }
    const targetSchools = (target.dataset.schools || "828,861").split(",");
    if (!schoolsMatch(targetSchools)) {
      toolId = "overview";
    }
    currentTool = toolId;
    document.querySelectorAll(".tool-view").forEach((view) => {
      const active = view.id === "tool-" + toolId;
      view.hidden = !active;
      view.classList.toggle("active", active);
    });
    document.querySelectorAll(".module-link").forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === toolId);
    });
    // Entering from the personal home should reveal the selected tool. Once
    // the user is already inside the platform, keep their reading position.
    const platform = document.querySelector("#learning-platform") || document.querySelector(".platform-header");
    if (platform && window.scrollY + 24 < platform.getBoundingClientRect().top + window.scrollY) {
      platform.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }

  function applyProfile() {
    currentProfile = elements.profile.value;
    elements.profileBadge.textContent = profileName(currentProfile);
    document.querySelectorAll(".module-link").forEach((button) => {
      const schools = (button.dataset.schools || "828,861").split(",");
      button.hidden = !schoolsMatch(schools);
    });
    const currentView = document.querySelector("#tool-" + currentTool);
    if (currentView) {
      const schools = (currentView.dataset.schools || "828,861").split(",");
      if (!schoolsMatch(schools)) {
        showTool("overview");
      }
    }
    renderCoverage();
  }

  const statusLabels = {
    available: "计算工具",
    theory: "理论自测"
  };

  function renderCoverage() {
    const query = elements.search.value.trim().toLowerCase();
    const selectedStatus = elements.statusFilter.value;
    const profileRows = syllabus.filter((item) => schoolsMatch(item.schools));
    const visibleRows = profileRows.filter((item) => {
      const matchesQuery = !query || (item.chapter + item.topic + item.kind).toLowerCase().includes(query);
      const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
      return matchesQuery && matchesStatus;
    });
    const availableCount = profileRows.filter((item) => item.status === "available").length;
    const theoryCount = profileRows.filter((item) => item.status === "theory").length;
    const chapters = new Set(profileRows.map((item) => item.chapter)).size;

    elements.coverageStats.innerHTML =
      '<div><strong>' + profileRows.length + '</strong><span>大纲知识点</span></div>' +
      '<div><strong>' + chapters + '</strong><span>章节模块</span></div>' +
      '<div><strong>' + availableCount + '</strong><span>计算工具覆盖</span></div>' +
      '<div><strong>' + theoryCount + '</strong><span>理论自测覆盖</span></div>';

    elements.coverageBody.innerHTML = visibleRows.length
      ? visibleRows.map((item) => {
        const schoolTags = item.schools.map((school) => '<span class="mini-school-tag">' + school + "</span>").join("");
        const action = item.tool
          ? '<button type="button" class="table-tool-button" data-open-tool="' + item.tool + '">' + (statusLabels[item.status] || "进入工具") + "</button>"
          : '<span class="coverage-status ' + item.status + '">' + (statusLabels[item.status] || item.status) + "</span>";
        return '<tr><td>' + item.chapter + '</td><td>' + item.topic + '</td><td><div class="mini-school-tags">' + schoolTags + '</div></td><td>' + item.kind + '</td><td>' + action + "</td></tr>";
      }).join("")
      : '<tr><td colspan="5" class="empty-table">没有符合当前条件的知识点</td></tr>';
  }

  function hideMessage(element) {
    element.hidden = true;
    element.textContent = "";
  }

  function showMessage(element, message) {
    element.textContent = message;
    element.hidden = false;
  }

  function calculateRouth() {
    hideMessage(elements.routhError);
    try {
      const coefficients = Core.parsePolynomial(elements.routhInput.value);
      const result = Core.buildRouthTable(coefficients);
      const eventRows = new Map(result.events.map((event) => [event.row, event.type]));
      const tableRows = result.table.map((row, rowIndex) => {
        const cells = row.map((value, columnIndex) => {
          const special = columnIndex === 0 && eventRows.get(rowIndex) === "zero-first-column";
          return "<td>" + (special ? "ε" : formatNumber(value)) + "</td>";
        }).join("");
        return '<tr><th>s<sup>' + (result.degree - rowIndex) + "</sup></th>" + cells + "</tr>";
      }).join("");
      const notes = result.events.length
        ? '<div class="calculation-notes"><span>特殊情况处理</span>' + result.events.map((event) => "<p>" + event.message + "</p>").join("") + "</div>"
        : '<div class="calculation-notes clean"><span>特殊情况</span><p>未出现首列为零或整行全零。</p></div>';

      elements.routhResult.innerHTML =
        '<div class="result-summary-band ' + (result.stable ? "success" : "warning") + '"><span>稳定性结论</span><strong>' + result.conclusion + "</strong></div>" +
        '<div class="metric-strip"><div><span>系统阶次</span><strong>' + result.degree + '</strong></div><div><span>符号变化</span><strong>' + result.signChanges + '</strong></div><div><span>右半平面根</span><strong>' + result.rightHalfPlanePoles + "</strong></div></div>" +
        '<div class="result-section"><span class="block-label">劳斯表</span><div class="routh-table-wrap"><table class="routh-table"><tbody>' + tableRows + "</tbody></table></div></div>" +
        notes;
    } catch (error) {
      showMessage(elements.routhError, error instanceof Error ? error.message : "无法构造劳斯表");
    }
  }

  function calculateSteadyError() {
    hideMessage(elements.steadyMessage);
    try {
      const transfer = Solver.transferFunctionFromExpressions(
        elements.errorNumerator.value,
        elements.errorDenominator.value
      );
      const result = Core.staticErrorAnalysis(
        transfer.numerator,
        transfer.denominator,
        Number(elements.errorInputType.value),
        Number(elements.errorAmplitude.value)
      );
      const inputNames = ["阶跃输入", "斜坡输入", "抛物线输入"];
      const errorClass = result.steadyStateError === Infinity ? "warning" : "success";
      elements.steadyResult.innerHTML =
        '<div class="result-summary-band ' + errorClass + '"><span>稳态误差</span><strong>e<sub>ss</sub> = ' + formatNumber(result.steadyStateError) + "</strong></div>" +
        '<div class="metric-strip four"><div><span>系统型别</span><strong>' + result.systemType + ' 型</strong></div><div><span>Kp</span><strong>' + formatNumber(result.constants.kp) + '</strong></div><div><span>Kv</span><strong>' + formatNumber(result.constants.kv) + '</strong></div><div><span>Ka</span><strong>' + formatNumber(result.constants.ka) + "</strong></div></div>" +
        '<div class="derivation-steps"><span class="block-label">判定步骤</span>' +
          '<p><b>1.</b> 开环原点净极点数为 ' + result.netIntegratorCount + "，所以系统为 " + result.systemType + " 型。</p>" +
          '<p><b>2.</b> 当前为 ' + inputNames[result.inputOrder] + "，幅值 A = " + formatNumber(result.amplitude) + "。</p>" +
          '<p><b>3.</b> ' + result.formula + "，代入得到 e<sub>ss</sub> = " + formatNumber(result.steadyStateError) + "。</p>" +
        "</div>";
    } catch (error) {
      showMessage(elements.steadyMessage, error instanceof Error ? error.message : "无法计算稳态误差");
    }
  }

  function complexText(value) {
    if (Math.abs(value.imaginary) < 1e-10) {
      return formatNumber(value.real);
    }
    const sign = value.imaginary >= 0 ? "+" : "−";
    return formatNumber(value.real) + " " + sign + " j" + formatNumber(Math.abs(value.imaginary));
  }

  function stepResponseSvg(metrics) {
    const width = 620;
    const height = 220;
    const left = 44;
    const right = 606;
    const top = 18;
    const bottom = 190;
    let maximumTime;
    if (Number.isFinite(metrics.settlingTime2)) {
      maximumTime = Math.max(5 / metrics.naturalFrequency, metrics.settlingTime2 * 1.35);
    } else {
      maximumTime = 4 * Math.PI / metrics.naturalFrequency;
    }
    const samples = Array.from({ length: 181 }, (_, index) => {
      const time = maximumTime * index / 180;
      return { time, value: Core.secondOrderStepValue(metrics, time) };
    });
    const maxValue = Math.max(1.15, ...samples.map((point) => point.value)) * 1.08;
    const minValue = Math.min(0, ...samples.map((point) => point.value));
    const mapX = (time) => left + time / maximumTime * (right - left);
    const mapY = (value) => bottom - (value - minValue) / (maxValue - minValue) * (bottom - top);
    const path = samples.map((point, index) => (index ? "L" : "M") + mapX(point.time).toFixed(2) + " " + mapY(point.value).toFixed(2)).join(" ");
    const finalY = mapY(1);
    return '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="单位阶跃响应曲线">' +
      '<line x1="' + left + '" y1="' + bottom + '" x2="' + right + '" y2="' + bottom + '" stroke="#9aa49f"/>' +
      '<line x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + bottom + '" stroke="#9aa49f"/>' +
      '<line x1="' + left + '" y1="' + finalY + '" x2="' + right + '" y2="' + finalY + '" stroke="#b76a18" stroke-dasharray="5 4"/>' +
      '<path d="' + path + '" fill="none" stroke="#176b4d" stroke-width="2.4"/>' +
      '<text x="' + (left - 8) + '" y="' + (finalY + 4) + '" text-anchor="end" fill="#66716d" font-size="10">1</text>' +
      '<text x="' + right + '" y="' + (bottom + 18) + '" text-anchor="end" fill="#66716d" font-size="10">t = ' + formatNumber(maximumTime, 4) + " s</text></svg>";
  }

  function calculateSecondOrder() {
    hideMessage(elements.secondError);
    try {
      const metrics = Core.secondOrderMetrics(elements.secondZeta.value, elements.secondWn.value);
      const metricItems = [
        ["阻尼状态", metrics.category],
        ["阻尼频率 ωd", metrics.dampedFrequency === null ? "—" : formatNumber(metrics.dampedFrequency) + " rad/s"],
        ["超调量 σ%", formatNumber(metrics.overshootPercent) + "%"],
        ["峰值时间 tp", metrics.peakTime === null ? "—" : formatNumber(metrics.peakTime) + " s"],
        ["上升时间 tr", metrics.riseTime === null ? "—" : formatNumber(metrics.riseTime) + " s"],
        ["调节时间 ts(2%)", formatNumber(metrics.settlingTime2) + " s"],
        ["调节时间 ts(5%)", formatNumber(metrics.settlingTime5) + " s"]
      ];
      elements.secondResult.innerHTML =
        '<div class="result-summary-band success"><span>闭环极点</span><strong>s₁ = ' + complexText(metrics.poles[0]) + "，s₂ = " + complexText(metrics.poles[1]) + "</strong></div>" +
        '<div class="metric-grid">' + metricItems.map((item) => '<div><span>' + item[0] + '</span><strong>' + item[1] + "</strong></div>").join("") + "</div>" +
        '<div class="response-plot"><span class="block-label">单位阶跃响应</span>' + stepResponseSvg(metrics) + "</div>";
    } catch (error) {
      showMessage(elements.secondError, error instanceof Error ? error.message : "无法计算二阶动态指标");
    }
  }

  const frequencyExamples = {
    "integrator-first": { numerator: "1", denominator: "s(s+1)" },
    "third-order": { numerator: "10", denominator: "s(s+1)(s+2)" },
    "with-zero": { numerator: "s+1", denominator: "s(s+2)(s+5)" }
  };

  function bodeSvg(result) {
    const width = 680;
    const height = 410;
    const left = 58;
    const right = 662;
    const magnitudeTop = 24;
    const magnitudeBottom = 180;
    const phaseTop = 225;
    const phaseBottom = 381;
    const startLog = Math.log10(result.minimumFrequency);
    const endLog = Math.log10(result.maximumFrequency);
    const magnitudeValues = result.points.map((point) => point.magnitudeDb);
    const phaseValues = result.points.map((point) => point.phase);
    let magnitudeMin = Math.floor(Math.min(...magnitudeValues, 0) / 20) * 20;
    let magnitudeMax = Math.ceil(Math.max(...magnitudeValues, 0) / 20) * 20;
    if (magnitudeMax === magnitudeMin) magnitudeMax += 20;
    let phaseMin = Math.floor(Math.min(...phaseValues, -180) / 45) * 45;
    let phaseMax = Math.ceil(Math.max(...phaseValues, 0) / 45) * 45;
    if (phaseMax === phaseMin) phaseMax += 45;
    const mapX = (frequency) => left + (Math.log10(frequency) - startLog) / (endLog - startLog) * (right - left);
    const mapMagnitude = (value) => magnitudeBottom - (value - magnitudeMin) / (magnitudeMax - magnitudeMin) * (magnitudeBottom - magnitudeTop);
    const mapPhase = (value) => phaseBottom - (value - phaseMin) / (phaseMax - phaseMin) * (phaseBottom - phaseTop);
    const magnitudePath = result.points.map((point, index) => (index ? "L" : "M") + mapX(point.frequency).toFixed(2) + " " + mapMagnitude(point.magnitudeDb).toFixed(2)).join(" ");
    const phasePath = result.points.map((point, index) => (index ? "L" : "M") + mapX(point.frequency).toFixed(2) + " " + mapPhase(point.phase).toFixed(2)).join(" ");
    const parts = [];

    for (let decade = Math.ceil(startLog); decade <= Math.floor(endLog); decade += 1) {
      const x = mapX(Math.pow(10, decade));
      parts.push('<line x1="' + x + '" y1="' + magnitudeTop + '" x2="' + x + '" y2="' + magnitudeBottom + '" stroke="#e1e6e3"/><line x1="' + x + '" y1="' + phaseTop + '" x2="' + x + '" y2="' + phaseBottom + '" stroke="#e1e6e3"/><text x="' + x + '" y="402" text-anchor="middle" fill="#66716d" font-size="9">10^' + decade + "</text>");
    }
    const zeroMagnitudeY = mapMagnitude(0);
    const minus180Y = mapPhase(-180);
    parts.push('<line x1="' + left + '" y1="' + zeroMagnitudeY + '" x2="' + right + '" y2="' + zeroMagnitudeY + '" stroke="#b76a18" stroke-dasharray="5 4"/>');
    parts.push('<line x1="' + left + '" y1="' + minus180Y + '" x2="' + right + '" y2="' + minus180Y + '" stroke="#b76a18" stroke-dasharray="5 4"/>');
    parts.push('<path d="' + magnitudePath + '" fill="none" stroke="#176b4d" stroke-width="2.3"/><path d="' + phasePath + '" fill="none" stroke="#326ea8" stroke-width="2.3"/>');
    if (result.gainCrossover) {
      const x = mapX(result.gainCrossover);
      parts.push('<circle cx="' + x + '" cy="' + zeroMagnitudeY + '" r="4.5" fill="#176b4d" stroke="#fff" stroke-width="1.5"/>');
    }
    if (result.phaseCrossover) {
      const x = mapX(result.phaseCrossover);
      parts.push('<circle cx="' + x + '" cy="' + minus180Y + '" r="4.5" fill="#326ea8" stroke="#fff" stroke-width="1.5"/>');
    }
    parts.push('<text x="12" y="35" fill="#176b4d" font-size="10" font-weight="700">L/dB</text><text x="12" y="236" fill="#326ea8" font-size="10" font-weight="700">φ/°</text>');
    parts.push('<text x="' + (left - 7) + '" y="' + (zeroMagnitudeY + 4) + '" text-anchor="end" fill="#66716d" font-size="9">0</text><text x="' + (left - 7) + '" y="' + (minus180Y + 4) + '" text-anchor="end" fill="#66716d" font-size="9">−180</text>');
    return '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Bode幅频和相频曲线">' + parts.join("") + "</svg>";
  }

  function calculateFrequency() {
    hideMessage(elements.frequencyError);
    try {
      const transfer = Solver.transferFunctionFromExpressions(
        elements.frequencyNumerator.value,
        elements.frequencyDenominator.value
      );
      const result = Core.bodeAnalysis(
        transfer.numerator,
        transfer.denominator,
        elements.frequencyMinimum.value,
        elements.frequencyMaximum.value,
        360
      );
      const phaseMarginText = result.phaseMargin === null ? "无0 dB交叉" : formatNumber(result.phaseMargin) + "°";
      const gainMarginText = result.gainMarginDb === Infinity ? "∞" : formatNumber(result.gainMarginDb) + " dB";
      const warning = (result.phaseMargin !== null && result.phaseMargin <= 0) || (result.gainMarginDb !== Infinity && result.gainMarginDb <= 0);
      elements.frequencyResult.innerHTML =
        '<div class="result-summary-band ' + (warning ? "warning" : "success") + '"><span>相对稳定性</span><strong>相角裕度 γ = ' + phaseMarginText + "，幅值裕度 h = " + gainMarginText + "</strong></div>" +
        '<div class="metric-strip four"><div><span>增益交叉频率 ωc</span><strong>' + (result.gainCrossover ? formatNumber(result.gainCrossover) + " rad/s" : "—") + '</strong></div><div><span>相位交叉频率 ωg</span><strong>' + (result.phaseCrossover ? formatNumber(result.phaseCrossover) + " rad/s" : "—") + '</strong></div><div><span>幅值裕度倍数</span><strong>' + formatNumber(result.gainMargin) + '</strong></div><div><span>绘图频率范围</span><strong>' + formatNumber(result.minimumFrequency, 4) + " ~ " + formatNumber(result.maximumFrequency, 4) + "</strong></div></div>" +
        '<div class="bode-plot"><span class="block-label">对数频率特性</span>' + bodeSvg(result) + "</div>";
    } catch (error) {
      showMessage(elements.frequencyError, error instanceof Error ? error.message : "无法计算频率响应");
    }
  }

  elements.nav.addEventListener("click", (event) => {
    const button = event.target.closest(".module-link");
    if (button) {
      showTool(button.dataset.tool);
    }
  });
  elements.coverageBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-tool]");
    if (button) {
      showTool(button.dataset.openTool);
    }
  });
  elements.profile.addEventListener("change", applyProfile);
  elements.search.addEventListener("input", renderCoverage);
  elements.statusFilter.addEventListener("change", renderCoverage);
  elements.routhExample.addEventListener("change", () => {
    elements.routhInput.value = elements.routhExample.value;
    calculateRouth();
  });
  elements.routhButton.addEventListener("click", calculateRouth);
  elements.steadyButton.addEventListener("click", calculateSteadyError);
  elements.secondButton.addEventListener("click", calculateSecondOrder);
  elements.secondZeta.addEventListener("input", () => {
    const value = Math.min(2, Math.max(0, Number(elements.secondZeta.value) || 0));
    elements.secondRange.value = String(value);
  });
  elements.secondRange.addEventListener("input", () => {
    elements.secondZeta.value = elements.secondRange.value;
    calculateSecondOrder();
  });
  elements.frequencyExample.addEventListener("change", () => {
    const example = frequencyExamples[elements.frequencyExample.value];
    elements.frequencyNumerator.value = example.numerator;
    elements.frequencyDenominator.value = example.denominator;
    calculateFrequency();
  });
  elements.frequencyButton.addEventListener("click", calculateFrequency);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) {
      return;
    }
    const view = event.target.closest(".tool-view");
    if (!view) {
      return;
    }
    if (view.id === "tool-routh") calculateRouth();
    if (view.id === "tool-steady-error") calculateSteadyError();
    if (view.id === "tool-second-order") calculateSecondOrder();
    if (view.id === "tool-frequency") calculateFrequency();
  });

  applyProfile();
  calculateRouth();
  calculateSteadyError();
  calculateSecondOrder();
  calculateFrequency();
})();
