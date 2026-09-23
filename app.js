(function () {
  "use strict";

  const Solver = window.RootLocusSolver;
  const elements = {
    tabFormula: document.querySelector("#tab-formula"),
    tabRoots: document.querySelector("#tab-roots"),
    tabCoefficients: document.querySelector("#tab-coefficients"),
    formulaPanel: document.querySelector("#formula-panel"),
    rootsPanel: document.querySelector("#roots-panel"),
    coefficientsPanel: document.querySelector("#coefficients-panel"),
    formulaNumerator: document.querySelector("#formula-numerator-input"),
    formulaDenominator: document.querySelector("#formula-denominator-input"),
    formulaNumeratorField: document.querySelector("#formula-numerator-field"),
    formulaDenominatorField: document.querySelector("#formula-denominator-field"),
    activeFormulaLabel: document.querySelector("#active-formula-label"),
    formulaKeypad: document.querySelector("#formula-keypad"),
    rootMaxGain: document.querySelector("#root-max-gain"),
    poles: document.querySelector("#poles-input"),
    zeros: document.querySelector("#zeros-input"),
    numerator: document.querySelector("#numerator-input"),
    denominator: document.querySelector("#denominator-input"),
    example: document.querySelector("#example-select"),
    calculate: document.querySelector("#calculate-button"),
    error: document.querySelector("#input-error"),
    resultContent: document.querySelector("#result-content"),
    resultCount: document.querySelector("#result-count")
  };

  const examples = {
    "three-poles": {
      poles: [0, -2, -4],
      zeros: [],
      numeratorExpression: "1",
      denominatorExpression: "s(s+2)(s+4)"
    },
    "two-poles-one-zero": {
      poles: [0, -2, -4],
      zeros: [-1],
      numeratorExpression: "s+1",
      denominatorExpression: "s(s+2)(s+4)"
    },
    "four-poles": {
      poles: [0, -1, -3, -5],
      zeros: [],
      numeratorExpression: "1",
      denominatorExpression: "s(s+1)(s+3)(s+5)"
    },
    "complex-poles": {
      poles: [0, -4, "-1+2j", "-1-2j"],
      zeros: [],
      numeratorExpression: "1",
      denominatorExpression: "s(s+4)(s+1-2j)(s+1+2j)"
    }
  };

  let inputMode = "formula";
  let activeFormulaInput = elements.formulaNumerator;

  function parseNumberList(rawValue, options) {
    const settings = { allowBlank: false, fallback: null, ...options };
    const cleaned = rawValue
      .trim()
      .replace(/[−–—]/g, "-")
      .replace(/[\[\](){}]/g, "");
    if (!cleaned) {
      if (settings.allowBlank) {
        return settings.fallback || [];
      }
      throw new Error(settings.label + "不能为空");
    }

    const tokens = cleaned.split(/[\s,，;；]+/).filter(Boolean);
    const values = tokens.map((token) => Number(token));
    if (values.some((value) => !Number.isFinite(value))) {
      throw new Error(settings.label + "中含有无法识别的数字");
    }
    return values;
  }

  function formatNumber(value, precision) {
    if (!Number.isFinite(value)) {
      return "无定义";
    }
    if (Math.abs(value) < 5e-12) {
      return "0";
    }
    const digits = precision || 6;
    const rounded = Number(value.toPrecision(digits));
    if (Math.abs(rounded) >= 1e7 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-5)) {
      return rounded.toExponential(Math.max(1, digits - 1));
    }
    return String(rounded);
  }

  function polynomialHtml(coefficients) {
    const degree = coefficients.length - 1;
    const terms = [];

    coefficients.forEach((coefficient, index) => {
      if (Math.abs(coefficient) < 1e-10) {
        return;
      }
      const power = degree - index;
      const absolute = Math.abs(coefficient);
      const sign = coefficient < 0 ? "−" : "+";
      let body = "";

      if (power === 0 || Math.abs(absolute - 1) > 1e-10) {
        body += formatNumber(absolute, 7);
      }
      if (power >= 1) {
        body += "s";
      }
      if (power >= 2) {
        body += "<sup>" + power + "</sup>";
      }

      if (terms.length === 0) {
        terms.push((coefficient < 0 ? "−" : "") + body);
      } else {
        terms.push(" " + sign + " " + body);
      }
    });

    return terms.length ? terms.join("") : "0";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function switchMode(mode) {
    inputMode = mode;
    const formulaActive = mode === "formula";
    const rootsActive = mode === "roots";
    const coefficientsActive = mode === "coefficients";
    elements.tabFormula.classList.toggle("active", formulaActive);
    elements.tabRoots.classList.toggle("active", rootsActive);
    elements.tabCoefficients.classList.toggle("active", coefficientsActive);
    elements.tabFormula.setAttribute("aria-selected", String(formulaActive));
    elements.tabRoots.setAttribute("aria-selected", String(rootsActive));
    elements.tabCoefficients.setAttribute("aria-selected", String(coefficientsActive));
    elements.formulaPanel.hidden = !formulaActive;
    elements.rootsPanel.hidden = !rootsActive;
    elements.coefficientsPanel.hidden = !coefficientsActive;
    hideError();
  }

  function getPolynomials() {
    if (inputMode === "formula") {
      const values = Solver.transferFunctionFromExpressions(
        elements.formulaNumerator.value,
        elements.formulaDenominator.value
      );
      if (values.denominator.length < values.numerator.length) {
        throw new Error("分母次数不能低于分子次数，系统才是真有理系统");
      }
      return {
        ...values,
        poles: Solver.realRoots(values.denominator),
        zeros: Solver.realRoots(values.numerator),
        sourceFormula: {
          numerator: elements.formulaNumerator.value,
          denominator: elements.formulaDenominator.value
        }
      };
    }

    if (inputMode === "roots") {
      const complexPoles = Solver.parseComplexList(elements.poles.value, false);
      const complexZeros = Solver.parseComplexList(elements.zeros.value, true);
      if (complexPoles.length < complexZeros.length) {
        throw new Error("极点数量不能少于零点数量，系统才是真有理系统");
      }
      return {
        numerator: Solver.polynomialFromComplexRoots(complexZeros, "零点中的复数"),
        denominator: Solver.polynomialFromComplexRoots(complexPoles, "极点中的复数"),
        poles: complexPoles.filter((value) => Math.abs(value.imaginary) < 1e-10).map((value) => value.real),
        zeros: complexZeros.filter((value) => Math.abs(value.imaginary) < 1e-10).map((value) => value.real)
      };
    }

    const denominator = Solver.normalizePolynomial(parseNumberList(elements.denominator.value, { label: "分母系数" }));
    const numerator = Solver.normalizePolynomial(parseNumberList(elements.numerator.value, {
      label: "分子系数",
      allowBlank: true,
      fallback: [1]
    }));
    if (denominator.length < numerator.length) {
      throw new Error("分母次数不能低于分子次数，系统才是真有理系统");
    }
    return {
      numerator,
      denominator,
      poles: Solver.realRoots(denominator),
      zeros: Solver.realRoots(numerator)
    };
  }

  function createAxisSvg(poles, zeros, validPoints) {
    const allValues = [...poles, ...zeros, ...validPoints.map((point) => point.coordinate)];
    if (!allValues.length) {
      return "";
    }
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const span = Math.max(2, rawMax - rawMin);
    const min = rawMin - span * 0.18;
    const max = rawMax + span * 0.18;
    const width = 620;
    const height = 112;
    const left = 24;
    const right = width - 24;
    const axisY = 57;
    const mapX = (value) => left + ((value - min) / (max - min)) * (right - left);
    const escapeAttribute = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const markers = [];

    poles.forEach((value) => {
      const x = mapX(value);
      markers.push(
        '<g aria-label="极点 ' + escapeAttribute(formatNumber(value)) + '">' +
        '<line x1="' + (x - 5) + '" y1="' + (axisY - 5) + '" x2="' + (x + 5) + '" y2="' + (axisY + 5) + '" stroke="#b3403b" stroke-width="2.5"/>' +
        '<line x1="' + (x + 5) + '" y1="' + (axisY - 5) + '" x2="' + (x - 5) + '" y2="' + (axisY + 5) + '" stroke="#b3403b" stroke-width="2.5"/>' +
        '<text x="' + x + '" y="82" text-anchor="middle" fill="#66716d" font-size="10">' + formatNumber(value, 4) + "</text></g>"
      );
    });

    zeros.forEach((value) => {
      const x = mapX(value);
      markers.push(
        '<g aria-label="零点 ' + escapeAttribute(formatNumber(value)) + '">' +
        '<circle class="plot-hit-point" cx="' + x + '" cy="' + axisY + '" r="6" fill="#fff" stroke="#326ea8" stroke-width="2.5" data-plot-label="零点 s=' + escapeAttribute(formatNumber(value, 6)) + '" data-plot-x="' + escapeAttribute(formatNumber(value, 6)) + '" data-plot-y="0"/>' +
        '<text x="' + x + '" y="82" text-anchor="middle" fill="#66716d" font-size="10">' + formatNumber(value, 4) + "</text></g>"
      );
    });

    validPoints.forEach((point) => {
      const x = mapX(point.coordinate);
      markers.push(
        '<g aria-label="' + point.label + " " + escapeAttribute(formatNumber(point.coordinate)) + '">' +
        '<line x1="' + x + '" y1="24" x2="' + x + '" y2="49" stroke="#176b4d" stroke-width="1.5" stroke-dasharray="3 3"/>' +
        '<circle class="plot-hit-point" cx="' + x + '" cy="' + axisY + '" r="6" fill="#176b4d" stroke="#fff" stroke-width="2" data-plot-label="' + point.label + ' s=' + escapeAttribute(formatNumber(point.coordinate, 6)) + '，K=' + escapeAttribute(formatNumber(point.gain, 6)) + '" data-plot-x="' + escapeAttribute(formatNumber(point.coordinate, 6)) + '" data-plot-y="0"/>' +
        '<text x="' + x + '" y="17" text-anchor="middle" fill="#0f513b" font-size="10" font-weight="700">s=' + formatNumber(point.coordinate, 5) + "</text></g>"
      );
    });

    return (
      '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="实轴上的极点、零点和分离点">' +
      '<defs><marker id="axis-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#89938f"/></marker></defs>' +
      '<line x1="12" y1="' + axisY + '" x2="608" y2="' + axisY + '" stroke="#89938f" stroke-width="1.2" marker-start="url(#axis-arrow)" marker-end="url(#axis-arrow)"/>' +
      markers.join("") +
      "</svg>"
    );
  }

  function createRootLocusPlot(numerator, denominator, validPoints, maximumGain) {
    const locus = Solver.rootLocusBranches(numerator, denominator, maximumGain, 190);
    const geometry = Solver.rootLocusGeometry(numerator, denominator);
    const points = locus.branches.flat();
    const allPoints = [...points, ...geometry.poles, ...geometry.zeros];
    const width = 620;
    const height = 330;
    const paddingX = 35;
    const paddingY = 28;
    let minX = Math.min(0, ...allPoints.map((point) => point.real));
    let maxX = Math.max(0, ...allPoints.map((point) => point.real));
    let minY = Math.min(0, ...allPoints.map((point) => point.imaginary));
    let maxY = Math.max(0, ...allPoints.map((point) => point.imaginary));
    const rawXRange = Math.max(2, maxX - minX);
    const rawYRange = Math.max(2, maxY - minY);
    minX -= rawXRange * 0.1;
    maxX += rawXRange * 0.1;
    minY -= rawYRange * 0.12;
    maxY += rawYRange * 0.12;
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    const scale = Math.min(
      (width - 2 * paddingX) / xRange,
      (height - 2 * paddingY) / yRange
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const mapX = (value) => width / 2 + (value - centerX) * scale;
    const mapY = (value) => height / 2 - (value - centerY) * scale;
    const colors = ["#176b4d", "#326ea8", "#b76a18", "#8b4d85", "#277f89", "#9b554c"];
    const escapeAttribute = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const svgParts = [];

    if (geometry.asymptoteCount > 0 && geometry.centroid !== null) {
      const lineLength = Math.max(xRange, yRange) * 1.5;
      geometry.asymptoteAngles.forEach((angle) => {
        const radians = angle * Math.PI / 180;
        const dx = Math.cos(radians) * lineLength;
        const dy = Math.sin(radians) * lineLength;
        svgParts.push(
          '<line x1="' + mapX(geometry.centroid - dx) + '" y1="' + mapY(-dy) + '" x2="' + mapX(geometry.centroid + dx) + '" y2="' + mapY(dy) + '" stroke="#aeb7b3" stroke-width="1" stroke-dasharray="5 5"/>'
        );
      });
    }

    if (minY <= 0 && maxY >= 0) {
      svgParts.push('<line x1="18" y1="' + mapY(0) + '" x2="602" y2="' + mapY(0) + '" stroke="#89938f" stroke-width="1"/>');
    }
    if (minX <= 0 && maxX >= 0) {
      svgParts.push('<line x1="' + mapX(0) + '" y1="14" x2="' + mapX(0) + '" y2="316" stroke="#89938f" stroke-width="1"/>');
    }

    const complexPointText = (point) => {
      const sign = point.imaginary >= 0 ? "+" : "−";
      return formatNumber(point.real, 5) + sign + "j" + formatNumber(Math.abs(point.imaginary), 5);
    };

    locus.branches.forEach((branch, index) => {
      const path = branch.map((point, pointIndex) => (
        (pointIndex ? "L" : "M") + mapX(point.real).toFixed(2) + " " + mapY(point.imaginary).toFixed(2)
      )).join(" ");
      const hitPoints = branch.filter((point, pointIndex) => pointIndex % 4 === 0 || pointIndex === branch.length - 1).map((point) => '<circle class="plot-hit-point" data-plot-hit="true" cx="' + mapX(point.real).toFixed(2) + '" cy="' + mapY(point.imaginary).toFixed(2) + '" r="6" data-plot-label="根轨迹 s=' + escapeAttribute(complexPointText(point)) + '" data-plot-x="' + escapeAttribute(formatNumber(point.real, 6)) + '" data-plot-y="' + escapeAttribute(formatNumber(point.imaginary, 6)) + 'j"/>').join('');
      svgParts.push('<path d="' + path + '" fill="none" stroke="' + colors[index % colors.length] + '" stroke-width="2"/>' + hitPoints);
    });

    geometry.poles.forEach((pole) => {
      const x = mapX(pole.real);
      const y = mapY(pole.imaginary);
      svgParts.push('<g class="plot-hit-point" data-plot-label="极点 s=' + escapeAttribute(complexPointText(pole)) + '" data-plot-x="' + escapeAttribute(formatNumber(pole.real, 6)) + '" data-plot-y="' + escapeAttribute(formatNumber(pole.imaginary, 6)) + '"><line x1="' + (x - 5) + '" y1="' + (y - 5) + '" x2="' + (x + 5) + '" y2="' + (y + 5) + '" stroke="#b3403b" stroke-width="2.5"/><line x1="' + (x + 5) + '" y1="' + (y - 5) + '" x2="' + (x - 5) + '" y2="' + (y + 5) + '" stroke="#b3403b" stroke-width="2.5"/></g>');
    });
    geometry.zeros.forEach((zero) => {
      svgParts.push('<circle class="plot-hit-point" cx="' + mapX(zero.real) + '" cy="' + mapY(zero.imaginary) + '" r="6" fill="#fff" stroke="#326ea8" stroke-width="2.5" data-plot-label="零点 s=' + escapeAttribute(complexPointText(zero)) + '" data-plot-x="' + escapeAttribute(formatNumber(zero.real, 6)) + '" data-plot-y="' + escapeAttribute(formatNumber(zero.imaginary, 6)) + 'j"/>');
    });
    validPoints.forEach((point) => {
      svgParts.push('<circle class="plot-hit-point" cx="' + mapX(point.coordinate) + '" cy="' + mapY(0) + '" r="6" fill="#176b4d" stroke="#fff" stroke-width="1.5" data-plot-label="' + escapeAttribute(point.label + ' s=' + formatNumber(point.coordinate, 6) + '，K=' + formatNumber(point.gain, 6)) + '" data-plot-x="' + escapeAttribute(formatNumber(point.coordinate, 6)) + '" data-plot-y="0"/>');
    });

    const departureText = geometry.departureAngles.length
      ? geometry.departureAngles.map((item) => complexPointText(item.point) + "：" + formatNumber(item.angle, 5) + "°").join("；")
      : "无复极点";
    const arrivalText = geometry.arrivalAngles.length
      ? geometry.arrivalAngles.map((item) => complexPointText(item.point) + "：" + formatNumber(item.angle, 5) + "°").join("；")
      : "无复零点";

    return {
      svg: '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="完整根轨迹复平面图">' + svgParts.join("") + '<text x="604" y="' + (mapY(0) - 7) + '" text-anchor="end" fill="#66716d" font-size="10">Re</text><text x="' + (mapX(0) + 7) + '" y="18" fill="#66716d" font-size="10">Im</text></svg>',
      geometryHtml: '<div class="root-geometry-grid">' +
        '<div><span>开环极点 / 零点</span><strong>' + geometry.poles.length + " / " + geometry.zeros.length + '</strong></div>' +
        '<div><span>渐近线重心</span><strong>' + (geometry.centroid === null ? "—" : formatNumber(geometry.centroid)) + '</strong></div>' +
        '<div><span>渐近线角度</span><strong>' + (geometry.asymptoteAngles.length ? geometry.asymptoteAngles.map((angle) => formatNumber(angle) + "°").join("，") : "—") + '</strong></div>' +
        '<div><span>复极点出射角</span><strong>' + departureText + '</strong></div>' +
        '<div><span>复零点入射角</span><strong>' + arrivalText + '</strong></div>' +
        '<div><span>绘图增益范围</span><strong>0 ≤ K ≤ ' + formatNumber(maximumGain) + "</strong></div>" +
      "</div>"
    };
  }

  function renderResults(result, poles, zeros, maximumGain) {
    const validPoints = result.validPoints;
    elements.resultCount.textContent = validPoints.length + " 个有效点";
    elements.resultCount.classList.add("ready");

    const answers = validPoints.length
      ? '<div class="answer-list">' + validPoints.map((point, index) => (
        '<div class="answer-row">' +
          '<span class="answer-type ' + (point.kind === "breakin" ? "entry" : "") + '">' + point.label + "</span>" +
          '<div class="answer-value"><strong>s' + (validPoints.length > 1 ? "<sub>" + (index + 1) + "</sub>" : "") + " = " + formatNumber(point.coordinate) + "</strong><span>实轴坐标</span></div>" +
          '<div class="answer-gain"><strong>K = ' + formatNumber(point.gain) + "</strong><span>对应根轨迹增益</span></div>" +
        "</div>"
      )).join("") + "</div>"
      : '<div class="empty-answer">未找到 K &gt; 0 时的有效分离点或汇合点。请检查传递函数；驻点可能只对应负增益。</div>';

    const invalidCandidates = result.candidates.filter((candidate) => !candidate.valid);
    let candidateText = "候选实根：";
    if (result.constantGain) {
      candidateText = "D(s) / N(s) 为常数，无法形成分离点方程。";
    } else if (!result.candidates.length) {
      candidateText += "无实根。";
    } else {
      candidateText += result.candidates.map((candidate) => {
        const base = "s = " + formatNumber(candidate.coordinate);
        return candidate.valid ? base + "（有效）" : base + "（舍去：" + candidate.reason + "）";
      }).join("；") + "。";
    }

    const axis = createAxisSvg(poles, zeros, validPoints);
    const axisBlock = axis
      ? '<div class="axis-block"><span class="block-label">实轴位置</span>' + axis + '<div class="axis-legend"><span class="legend-pole">极点</span><span class="legend-zero">零点</span><span class="legend-point">有效点</span></div></div>'
      : "";
    const rootPlot = createRootLocusPlot(result.numerator, result.denominator, validPoints, maximumGain);
    const rootPlotBlock = '<div class="root-locus-block"><span class="block-label">完整根轨迹</span>' + rootPlot.svg + '<div class="axis-legend"><span class="legend-pole">开环极点</span><span class="legend-zero">开环零点</span><span class="legend-point">分离 / 汇合点</span></div></div>' + rootPlot.geometryHtml;

    const originalFormula = result.sourceFormula
      ? '<span class="transfer-label">输入原式</span>' +
        '<div class="transfer-formula input-formula">G(s)H(s) = K · (' + escapeHtml(result.sourceFormula.numerator) + ") / (" + escapeHtml(result.sourceFormula.denominator) + ")</div>" +
        '<span class="transfer-label expanded-label">自动展开</span>'
      : '<span class="transfer-label">当前传递函数</span>';

    elements.resultContent.innerHTML =
      '<div class="transfer-block">' +
        originalFormula +
        '<div class="transfer-formula">G(s)H(s) = K · (' + polynomialHtml(result.numerator) + ") / (" + polynomialHtml(result.denominator) + ")</div>" +
      "</div>" +
      answers +
      rootPlotBlock +
      axisBlock +
      '<div class="equation-block">' +
        '<span class="block-label">计算方程</span>' +
        '<div class="equation">D′(s)N(s) − D(s)N′(s) = 0</div>' +
        '<div class="equation">' + polynomialHtml(result.equation) + " = 0</div>" +
        '<p class="candidate-note">' + candidateText + (invalidCandidates.length ? " 仅保留 K &gt; 0 的点。" : "") + "</p>" +
      "</div>";
  }

  function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
  }

  function hideError() {
    elements.error.hidden = true;
    elements.error.textContent = "";
  }

  function calculate() {
    hideError();
    try {
      const values = getPolynomials();
      const maximumGain = Number(elements.rootMaxGain.value);
      if (!Number.isFinite(maximumGain) || maximumGain <= 0) {
        throw new Error("绘图最大增益 Kmax 必须大于零");
      }
      const result = Solver.solveBreakPoints(values.numerator, values.denominator);
      result.sourceFormula = values.sourceFormula || null;
      renderResults(result, values.poles, values.zeros, maximumGain);
    } catch (error) {
      showError(error instanceof Error ? error.message : "计算失败，请检查输入");
    }
  }

  function loadExample(key) {
    const example = examples[key];
    if (!example) {
      return;
    }
    elements.poles.value = example.poles.join(", ");
    elements.zeros.value = example.zeros.join(", ");
    elements.formulaNumerator.value = example.numeratorExpression;
    elements.formulaDenominator.value = example.denominatorExpression;
    const expanded = Solver.transferFunctionFromExpressions(
      example.numeratorExpression,
      example.denominatorExpression
    );
    elements.denominator.value = expanded.denominator.join(", ");
    elements.numerator.value = expanded.numerator.join(", ");
    calculate();
  }

  function setActiveFormulaInput(input) {
    activeFormulaInput = input;
    const numeratorActive = input === elements.formulaNumerator;
    elements.formulaNumeratorField.classList.toggle("active", numeratorActive);
    elements.formulaDenominatorField.classList.toggle("active", !numeratorActive);
    elements.activeFormulaLabel.textContent = numeratorActive
      ? "正在输入：分子 N(s)"
      : "正在输入：分母 D(s)";
  }

  function insertAtCursor(input, text) {
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const nextPosition = start + text.length;
    input.focus();
    input.setSelectionRange(nextPosition, nextPosition);
  }

  function backspaceAtCursor(input) {
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    if (start !== end) {
      input.value = input.value.slice(0, start) + input.value.slice(end);
      input.setSelectionRange(start, start);
      return;
    }
    if (start > 0) {
      input.value = input.value.slice(0, start - 1) + input.value.slice(end);
      input.setSelectionRange(start - 1, start - 1);
    }
  }

  elements.tabFormula.addEventListener("click", () => switchMode("formula"));
  elements.tabRoots.addEventListener("click", () => switchMode("roots"));
  elements.tabCoefficients.addEventListener("click", () => switchMode("coefficients"));
  [elements.formulaNumerator, elements.formulaDenominator].forEach((input) => {
    input.addEventListener("focus", () => setActiveFormulaInput(input));
    input.addEventListener("click", () => setActiveFormulaInput(input));
  });
  elements.formulaKeypad.addEventListener("mousedown", (event) => event.preventDefault());
  elements.formulaKeypad.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (action === "calculate") {
      calculate();
      return;
    }
    if (action === "clear") {
      activeFormulaInput.value = "";
      activeFormulaInput.focus();
      return;
    }
    if (action === "backspace") {
      activeFormulaInput.focus();
      backspaceAtCursor(activeFormulaInput);
      return;
    }
    if (button.dataset.value) {
      insertAtCursor(activeFormulaInput, button.dataset.value);
    }
  });
  elements.example.addEventListener("change", (event) => loadExample(event.target.value));
  elements.calculate.addEventListener("click", calculate);
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      event.target instanceof HTMLInputElement &&
      event.target.closest("#tool-root-locus")
    ) {
      calculate();
    }
  });

  calculate();
})();
