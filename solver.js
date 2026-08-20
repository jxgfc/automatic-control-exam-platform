(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RootLocusSolver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ZERO_EPSILON = 1e-12;

  function normalizePolynomial(coefficients) {
    if (!Array.isArray(coefficients) || coefficients.length === 0) {
      return [0];
    }

    const values = coefficients.map(Number);
    if (values.some((value) => !Number.isFinite(value))) {
      throw new Error("多项式系数必须是有限数字");
    }

    const scale = Math.max(1, ...values.map(Math.abs));
    let first = 0;
    while (first < values.length - 1 && Math.abs(values[first]) <= ZERO_EPSILON * scale) {
      first += 1;
    }
    return values.slice(first);
  }

  function isZeroPolynomial(coefficients) {
    return normalizePolynomial(coefficients).every((value) => Math.abs(value) <= ZERO_EPSILON);
  }

  function derivative(coefficients) {
    const values = normalizePolynomial(coefficients);
    const degree = values.length - 1;
    if (degree <= 0) {
      return [0];
    }
    return values.slice(0, -1).map((value, index) => value * (degree - index));
  }

  function multiply(left, right) {
    const a = normalizePolynomial(left);
    const b = normalizePolynomial(right);
    const product = Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
      for (let j = 0; j < b.length; j += 1) {
        product[i + j] += a[i] * b[j];
      }
    }
    return normalizePolynomial(product);
  }

  function add(left, right) {
    const length = Math.max(left.length, right.length);
    const a = Array(length - left.length).fill(0).concat(left);
    const b = Array(length - right.length).fill(0).concat(right);
    return normalizePolynomial(a.map((value, index) => value + b[index]));
  }

  function scale(coefficients, factor) {
    return normalizePolynomial(coefficients.map((value) => value * factor));
  }

  function subtract(left, right) {
    const length = Math.max(left.length, right.length);
    const a = Array(length - left.length).fill(0).concat(left);
    const b = Array(length - right.length).fill(0).concat(right);
    return normalizePolynomial(a.map((value, index) => value - b[index]));
  }

  function evaluate(coefficients, x) {
    return normalizePolynomial(coefficients).reduce((result, coefficient) => result * x + coefficient, 0);
  }

  function evaluationScale(coefficients, x) {
    const magnitude = Math.max(1, Math.abs(x));
    return normalizePolynomial(coefficients).reduce(
      (result, coefficient) => result * magnitude + Math.abs(coefficient),
      0
    );
  }

  function cauchyBound(coefficients) {
    const values = normalizePolynomial(coefficients);
    if (values.length <= 1) {
      return 1;
    }
    const leading = Math.abs(values[0]);
    return 1 + Math.max(...values.slice(1).map((value) => Math.abs(value) / leading));
  }

  function isNearZero(value, scale) {
    return Math.abs(value) <= 2e-9 * Math.max(1, scale);
  }

  function bisectRoot(coefficients, left, right) {
    let a = left;
    let b = right;
    let fa = evaluate(coefficients, a);

    for (let iteration = 0; iteration < 120; iteration += 1) {
      const middle = (a + b) / 2;
      const fm = evaluate(coefficients, middle);
      if (fm === 0) {
        return middle;
      }
      if (Math.sign(fa) === Math.sign(fm)) {
        a = middle;
        fa = fm;
      } else {
        b = middle;
      }
      if (Math.abs(b - a) <= 1e-14 * Math.max(1, Math.abs(middle))) {
        break;
      }
    }
    return (a + b) / 2;
  }

  function uniqueSorted(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const unique = [];
    for (const value of sorted) {
      const previous = unique[unique.length - 1];
      if (previous === undefined || Math.abs(value - previous) > 2e-7 * Math.max(1, Math.abs(value), Math.abs(previous))) {
        unique.push(value);
      } else {
        unique[unique.length - 1] = (previous + value) / 2;
      }
    }
    return unique;
  }

  function realRoots(coefficients) {
    const values = normalizePolynomial(coefficients);
    const degree = values.length - 1;
    if (degree <= 0 || isZeroPolynomial(values)) {
      return [];
    }
    if (degree === 1) {
      return [-values[1] / values[0]];
    }

    const bound = cauchyBound(values);
    const criticalPoints = realRoots(derivative(values)).filter(
      (value) => value > -bound && value < bound
    );
    const points = uniqueSorted([-bound, ...criticalPoints, bound]);
    const roots = [];

    for (const point of criticalPoints) {
      const value = evaluate(values, point);
      if (isNearZero(value, evaluationScale(values, point))) {
        roots.push(point);
      }
    }

    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      const leftValue = evaluate(values, left);
      const rightValue = evaluate(values, right);

      if (Math.sign(leftValue) !== 0 && Math.sign(rightValue) !== 0 && Math.sign(leftValue) !== Math.sign(rightValue)) {
        roots.push(bisectRoot(values, left, right));
      }
    }

    return uniqueSorted(roots);
  }

  function polynomialFromRoots(roots) {
    return roots.reduce(
      (polynomial, value) => multiply(polynomial, [1, -Number(value)]),
      [1]
    );
  }

  function tokenizeExpression(rawExpression) {
    if (typeof rawExpression !== "string" || !rawExpression.trim()) {
      throw new Error("公式不能为空");
    }

    let expression = rawExpression
      .trim()
      .replace(/[−–—]/g, "-")
      .replace(/[×·]/g, "*")
      .replace(/÷/g, "/")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/[\[\{]/g, "(")
      .replace(/[\]\}]/g, ")")
      .replace(/\s+/g, "");

    const equalsIndex = expression.lastIndexOf("=");
    if (equalsIndex >= 0) {
      expression = expression.slice(equalsIndex + 1);
    }

    const tokens = [];
    let index = 0;
    while (index < expression.length) {
      const rest = expression.slice(index);
      const numberMatch = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
      if (numberMatch) {
        tokens.push({ type: "number", value: Number(numberMatch[0]), text: numberMatch[0] });
        index += numberMatch[0].length;
        continue;
      }

      const character = expression[index];
      if (character === "s" || character === "S") {
        tokens.push({ type: "variable", value: "s", text: character });
        index += 1;
        continue;
      }
      if (character === "k" || character === "K") {
        tokens.push({ type: "gain", value: "K", text: character });
        index += 1;
        continue;
      }
      if (character === "j" || character === "J" || character === "i" || character === "I") {
        tokens.push({ type: "imaginary", value: "j", text: character });
        index += 1;
        continue;
      }
      if ("+-*/^()".includes(character)) {
        tokens.push({ type: character, value: character, text: character });
        index += 1;
        continue;
      }
      throw new Error("公式中含有无法识别的字符：“" + character + "”");
    }

    const expanded = [];
    for (const token of tokens) {
      const previous = expanded[expanded.length - 1];
      const previousCanMultiply = previous && ["number", "variable", "gain", "imaginary", ")"].includes(previous.type);
      const currentCanMultiply = ["number", "variable", "gain", "imaginary", "("].includes(token.type);
      const adjacentNumbers = previous && previous.type === "number" && token.type === "number";
      if (previousCanMultiply && currentCanMultiply && !adjacentNumbers) {
        expanded.push({ type: "*", value: "*", text: "*" });
      }
      expanded.push(token);
    }
    return expanded;
  }

  function rational(num, den) {
    const numerator = normalizePolynomial(num);
    const denominator = normalizePolynomial(den);
    if (isZeroPolynomial(denominator)) {
      throw new Error("公式中出现除以零");
    }
    return { numerator, denominator };
  }

  function addRational(left, right) {
    return rational(
      add(multiply(left.numerator, right.denominator), multiply(right.numerator, left.denominator)),
      multiply(left.denominator, right.denominator)
    );
  }

  function subtractRational(left, right) {
    return rational(
      subtract(multiply(left.numerator, right.denominator), multiply(right.numerator, left.denominator)),
      multiply(left.denominator, right.denominator)
    );
  }

  function multiplyRational(left, right) {
    return rational(
      multiply(left.numerator, right.numerator),
      multiply(left.denominator, right.denominator)
    );
  }

  function divideRational(left, right) {
    if (isZeroPolynomial(right.numerator)) {
      throw new Error("公式中出现除以零");
    }
    return rational(
      multiply(left.numerator, right.denominator),
      multiply(left.denominator, right.numerator)
    );
  }

  function powerRational(base, exponent) {
    if (!Number.isInteger(exponent) || Math.abs(exponent) > 20) {
      throw new Error("幂指数必须是 -20 到 20 之间的整数");
    }
    if (exponent === 0) {
      return rational([1], [1]);
    }

    let result = rational([1], [1]);
    const positiveBase = exponent > 0
      ? base
      : rational(base.denominator, base.numerator);
    for (let count = 0; count < Math.abs(exponent); count += 1) {
      result = multiplyRational(result, positiveBase);
    }
    return result;
  }

  function parseRationalExpression(rawExpression) {
    const tokens = tokenizeExpression(rawExpression);
    let position = 0;

    function current() {
      return tokens[position];
    }

    function consume(type) {
      if (!current() || current().type !== type) {
        throw new Error("公式格式不完整，请检查运算符和括号");
      }
      const token = current();
      position += 1;
      return token;
    }

    function parsePrimary() {
      const token = current();
      if (!token) {
        throw new Error("公式结尾缺少数字、s 或右括号");
      }
      if (token.type === "number") {
        position += 1;
        return rational([token.value], [1]);
      }
      if (token.type === "variable") {
        position += 1;
        return rational([1, 0], [1]);
      }
      if (token.type === "gain") {
        position += 1;
        return rational([1], [1]);
      }
      if (token.type === "(") {
        position += 1;
        const value = parseExpression();
        consume(")");
        return value;
      }
      throw new Error("“" + token.text + "”前缺少数字、s 或左括号");
    }

    function parsePower() {
      let value = parsePrimary();
      while (current() && current().type === "^") {
        position += 1;
        let sign = 1;
        if (current() && (current().type === "+" || current().type === "-")) {
          sign = current().type === "-" ? -1 : 1;
          position += 1;
        }
        const exponent = consume("number").value * sign;
        value = powerRational(value, exponent);
      }
      return value;
    }

    function parseUnary() {
      if (current() && current().type === "+") {
        position += 1;
        return parseUnary();
      }
      if (current() && current().type === "-") {
        position += 1;
        const value = parseUnary();
        return rational(scale(value.numerator, -1), value.denominator);
      }
      return parsePower();
    }

    function parseTerm() {
      let value = parseUnary();
      while (current() && (current().type === "*" || current().type === "/")) {
        const operator = current().type;
        position += 1;
        const right = parseUnary();
        value = operator === "*" ? multiplyRational(value, right) : divideRational(value, right);
      }
      return value;
    }

    function parseExpression() {
      let value = parseTerm();
      while (current() && (current().type === "+" || current().type === "-")) {
        const operator = current().type;
        position += 1;
        const right = parseTerm();
        value = operator === "+" ? addRational(value, right) : subtractRational(value, right);
      }
      return value;
    }

    const parsed = parseExpression();
    if (position !== tokens.length) {
      const token = current();
      throw new Error("公式在“" + (token ? token.text : "结尾") + "”附近格式不正确");
    }
    return parsed;
  }

  function complex(real, imaginary) {
    return { real: Number(real), imaginary: Number(imaginary) };
  }

  function complexMagnitude(value) {
    return Math.hypot(value.real, value.imaginary);
  }

  function addComplex(left, right) {
    return complex(left.real + right.real, left.imaginary + right.imaginary);
  }

  function subtractComplex(left, right) {
    return complex(left.real - right.real, left.imaginary - right.imaginary);
  }

  function multiplyComplex(left, right) {
    return complex(
      left.real * right.real - left.imaginary * right.imaginary,
      left.real * right.imaginary + left.imaginary * right.real
    );
  }

  function divideComplex(left, right) {
    const denominator = right.real * right.real + right.imaginary * right.imaginary;
    if (denominator <= 1e-30) {
      throw new Error("复数计算出现除以零");
    }
    return complex(
      (left.real * right.real + left.imaginary * right.imaginary) / denominator,
      (left.imaginary * right.real - left.real * right.imaginary) / denominator
    );
  }

  function negateComplex(value) {
    return complex(-value.real, -value.imaginary);
  }

  function normalizeComplexPolynomial(coefficients) {
    const values = coefficients.map((value) => (
      typeof value === "number" ? complex(value, 0) : complex(value.real, value.imaginary)
    ));
    const scaleValue = Math.max(1, ...values.map(complexMagnitude));
    let first = 0;
    while (first < values.length - 1 && complexMagnitude(values[first]) <= ZERO_EPSILON * scaleValue) {
      first += 1;
    }
    return values.slice(first);
  }

  function isZeroComplexPolynomial(coefficients) {
    return normalizeComplexPolynomial(coefficients).every(
      (value) => complexMagnitude(value) <= ZERO_EPSILON
    );
  }

  function addComplexPolynomials(left, right) {
    const length = Math.max(left.length, right.length);
    const zero = () => complex(0, 0);
    const a = Array.from({ length: length - left.length }, zero).concat(normalizeComplexPolynomial(left));
    const b = Array.from({ length: length - right.length }, zero).concat(normalizeComplexPolynomial(right));
    return normalizeComplexPolynomial(a.map((value, index) => addComplex(value, b[index])));
  }

  function subtractComplexPolynomials(left, right) {
    const length = Math.max(left.length, right.length);
    const zero = () => complex(0, 0);
    const a = Array.from({ length: length - left.length }, zero).concat(normalizeComplexPolynomial(left));
    const b = Array.from({ length: length - right.length }, zero).concat(normalizeComplexPolynomial(right));
    return normalizeComplexPolynomial(a.map((value, index) => subtractComplex(value, b[index])));
  }

  function multiplyComplexPolynomials(left, right) {
    const a = normalizeComplexPolynomial(left);
    const b = normalizeComplexPolynomial(right);
    const product = Array.from({ length: a.length + b.length - 1 }, () => complex(0, 0));
    for (let leftIndex = 0; leftIndex < a.length; leftIndex += 1) {
      for (let rightIndex = 0; rightIndex < b.length; rightIndex += 1) {
        product[leftIndex + rightIndex] = addComplex(
          product[leftIndex + rightIndex],
          multiplyComplex(a[leftIndex], b[rightIndex])
        );
      }
    }
    return normalizeComplexPolynomial(product);
  }

  function scaleComplexPolynomial(coefficients, factor) {
    return normalizeComplexPolynomial(
      coefficients.map((value) => multiplyComplex(value, factor))
    );
  }

  function complexRational(numerator, denominator) {
    const normalizedNumerator = normalizeComplexPolynomial(numerator);
    const normalizedDenominator = normalizeComplexPolynomial(denominator);
    if (isZeroComplexPolynomial(normalizedDenominator)) {
      throw new Error("公式中出现除以零");
    }
    return { numerator: normalizedNumerator, denominator: normalizedDenominator };
  }

  function addComplexRational(left, right) {
    return complexRational(
      addComplexPolynomials(
        multiplyComplexPolynomials(left.numerator, right.denominator),
        multiplyComplexPolynomials(right.numerator, left.denominator)
      ),
      multiplyComplexPolynomials(left.denominator, right.denominator)
    );
  }

  function subtractComplexRational(left, right) {
    return complexRational(
      subtractComplexPolynomials(
        multiplyComplexPolynomials(left.numerator, right.denominator),
        multiplyComplexPolynomials(right.numerator, left.denominator)
      ),
      multiplyComplexPolynomials(left.denominator, right.denominator)
    );
  }

  function multiplyComplexRational(left, right) {
    return complexRational(
      multiplyComplexPolynomials(left.numerator, right.numerator),
      multiplyComplexPolynomials(left.denominator, right.denominator)
    );
  }

  function divideComplexRational(left, right) {
    if (isZeroComplexPolynomial(right.numerator)) {
      throw new Error("公式中出现除以零");
    }
    return complexRational(
      multiplyComplexPolynomials(left.numerator, right.denominator),
      multiplyComplexPolynomials(left.denominator, right.numerator)
    );
  }

  function powerComplexRational(base, exponent) {
    if (!Number.isInteger(exponent) || Math.abs(exponent) > 20) {
      throw new Error("幂指数必须是 -20 到 20 之间的整数");
    }
    if (exponent === 0) {
      return complexRational([complex(1, 0)], [complex(1, 0)]);
    }
    const positiveBase = exponent > 0
      ? base
      : complexRational(base.denominator, base.numerator);
    let result = complexRational([complex(1, 0)], [complex(1, 0)]);
    for (let count = 0; count < Math.abs(exponent); count += 1) {
      result = multiplyComplexRational(result, positiveBase);
    }
    return result;
  }

  function parseComplexRationalExpression(rawExpression) {
    const tokens = tokenizeExpression(rawExpression);
    let position = 0;

    function current() {
      return tokens[position];
    }

    function consume(type) {
      if (!current() || current().type !== type) {
        throw new Error("公式格式不完整，请检查运算符和括号");
      }
      const token = current();
      position += 1;
      return token;
    }

    function constant(value) {
      return complexRational([value], [complex(1, 0)]);
    }

    function parsePrimary() {
      const token = current();
      if (!token) {
        throw new Error("公式结尾缺少数字、s、j 或右括号");
      }
      if (token.type === "number") {
        position += 1;
        return constant(complex(token.value, 0));
      }
      if (token.type === "variable") {
        position += 1;
        return complexRational([complex(1, 0), complex(0, 0)], [complex(1, 0)]);
      }
      if (token.type === "gain") {
        position += 1;
        return constant(complex(1, 0));
      }
      if (token.type === "imaginary") {
        position += 1;
        return constant(complex(0, 1));
      }
      if (token.type === "(") {
        position += 1;
        const value = parseExpression();
        consume(")");
        return value;
      }
      throw new Error("“" + token.text + "”前缺少数字、s、j 或左括号");
    }

    function parsePower() {
      let value = parsePrimary();
      while (current() && current().type === "^") {
        position += 1;
        let sign = 1;
        if (current() && (current().type === "+" || current().type === "-")) {
          sign = current().type === "-" ? -1 : 1;
          position += 1;
        }
        value = powerComplexRational(value, consume("number").value * sign);
      }
      return value;
    }

    function parseUnary() {
      if (current() && current().type === "+") {
        position += 1;
        return parseUnary();
      }
      if (current() && current().type === "-") {
        position += 1;
        const value = parseUnary();
        return complexRational(
          scaleComplexPolynomial(value.numerator, complex(-1, 0)),
          value.denominator
        );
      }
      return parsePower();
    }

    function parseTerm() {
      let value = parseUnary();
      while (current() && (current().type === "*" || current().type === "/")) {
        const operator = current().type;
        position += 1;
        const right = parseUnary();
        value = operator === "*"
          ? multiplyComplexRational(value, right)
          : divideComplexRational(value, right);
      }
      return value;
    }

    function parseExpression() {
      let value = parseTerm();
      while (current() && (current().type === "+" || current().type === "-")) {
        const operator = current().type;
        position += 1;
        const right = parseTerm();
        value = operator === "+"
          ? addComplexRational(value, right)
          : subtractComplexRational(value, right);
      }
      return value;
    }

    const parsed = parseExpression();
    if (position !== tokens.length) {
      const token = current();
      throw new Error("公式在“" + (token ? token.text : "结尾") + "”附近格式不正确");
    }
    return parsed;
  }

  function complexPolynomialToReal(coefficients, label) {
    const values = normalizeComplexPolynomial(coefficients);
    const scaleValue = Math.max(1, ...values.map(complexMagnitude));
    const tolerance = 1e-9 * scaleValue;
    if (values.some((value) => Math.abs(value.imaginary) > tolerance)) {
      throw new Error((label || "复数") + "没有形成实系数，请将共轭复数成对输入");
    }
    return normalizePolynomial(values.map((value) => (
      Math.abs(value.real) <= tolerance ? 0 : value.real
    )));
  }

  function parseComplexNumber(rawValue) {
    const value = String(rawValue)
      .trim()
      .replace(/[−–—]/g, "-")
      .replace(/\s+/g, "")
      .replace(/i/gi, "j")
      .toLowerCase();
    if (!value) {
      throw new Error("复数不能为空");
    }
    if (!value.includes("j")) {
      const realValue = Number(value);
      if (!Number.isFinite(realValue)) {
        throw new Error("无法识别复数“" + rawValue + "”");
      }
      return complex(realValue, 0);
    }
    if (!value.endsWith("j") || value.slice(0, -1).includes("j")) {
      throw new Error("无法识别复数“" + rawValue + "”");
    }

    const body = value.slice(0, -1);
    let splitIndex = -1;
    for (let index = 1; index < body.length; index += 1) {
      if ((body[index] === "+" || body[index] === "-") && body[index - 1] !== "e") {
        splitIndex = index;
      }
    }
    const realText = splitIndex >= 0 ? body.slice(0, splitIndex) : "0";
    const imaginaryText = splitIndex >= 0 ? body.slice(splitIndex) : body;
    const realValue = Number(realText);
    const imaginaryValue = imaginaryText === "" || imaginaryText === "+"
      ? 1
      : imaginaryText === "-" ? -1 : Number(imaginaryText);
    if (!Number.isFinite(realValue) || !Number.isFinite(imaginaryValue)) {
      throw new Error("无法识别复数“" + rawValue + "”");
    }
    return complex(realValue, imaginaryValue);
  }

  function parseComplexList(rawValue, allowBlank) {
    const cleaned = String(rawValue).trim();
    if (!cleaned) {
      if (allowBlank) {
        return [];
      }
      throw new Error("输入不能为空");
    }
    let parts = cleaned.split(/[,，;；\n]+/).map((value) => value.trim()).filter(Boolean);
    if (parts.length === 1 && !/[ij]/i.test(cleaned)) {
      parts = cleaned.split(/\s+/).filter(Boolean);
    }
    return parts.map(parseComplexNumber);
  }

  function polynomialFromComplexRoots(roots, label) {
    const coefficients = roots.reduce(
      (polynomial, rootValue) => multiplyComplexPolynomials(
        polynomial,
        [complex(1, 0), negateComplex(rootValue)]
      ),
      [complex(1, 0)]
    );
    return complexPolynomialToReal(coefficients, label || "复数根");
  }

  function evaluateComplexPolynomial(coefficients, value) {
    return normalizePolynomial(coefficients).reduce(
      (result, coefficient) => addComplex(
        multiplyComplex(result, value),
        complex(coefficient, 0)
      ),
      complex(0, 0)
    );
  }

  function complexPolynomialRoots(inputCoefficients) {
    let coefficients = normalizePolynomial(inputCoefficients);
    if (coefficients.length <= 1) {
      return [];
    }

    let originMultiplicity = 0;
    while (coefficients.length > 1 && Math.abs(coefficients[coefficients.length - 1]) <= ZERO_EPSILON) {
      originMultiplicity += 1;
      coefficients = coefficients.slice(0, -1);
    }

    const degree = coefficients.length - 1;
    let roots = [];
    if (degree === 1) {
      roots = [complex(-coefficients[1] / coefficients[0], 0)];
    } else if (degree > 1) {
      const monic = coefficients.map((value) => value / coefficients[0]);
      const radius = 1 + Math.max(...monic.slice(1).map(Math.abs));
      roots = Array.from({ length: degree }, (_, index) => {
        const angle = 2 * Math.PI * index / degree + 0.37;
        const adjustedRadius = radius * (1 + index * 0.013);
        return complex(adjustedRadius * Math.cos(angle), adjustedRadius * Math.sin(angle));
      });

      for (let iteration = 0; iteration < 2000; iteration += 1) {
        let maximumDelta = 0;
        const previous = roots.map((rootValue) => complex(rootValue.real, rootValue.imaginary));
        roots = previous.map((rootValue, rootIndex) => {
          let denominator = complex(1, 0);
          for (let otherIndex = 0; otherIndex < previous.length; otherIndex += 1) {
            if (otherIndex !== rootIndex) {
              denominator = multiplyComplex(
                denominator,
                subtractComplex(rootValue, previous[otherIndex])
              );
            }
          }
          if (complexMagnitude(denominator) < 1e-20) {
            denominator = addComplex(denominator, complex(1e-12, 1e-12));
          }
          const delta = divideComplex(evaluateComplexPolynomial(monic, rootValue), denominator);
          maximumDelta = Math.max(maximumDelta, complexMagnitude(delta));
          return subtractComplex(rootValue, delta);
        });
        if (maximumDelta <= 1e-12) {
          break;
        }
      }
    }

    for (let count = 0; count < originMultiplicity; count += 1) {
      roots.push(complex(0, 0));
    }
    return roots.map((rootValue) => complex(
      Math.abs(rootValue.real) < 1e-10 ? 0 : rootValue.real,
      Math.abs(rootValue.imaginary) < 1e-10 ? 0 : rootValue.imaginary
    )).sort((left, right) => left.real - right.real || left.imaginary - right.imaginary);
  }

  function closedLoopPolynomial(numerator, denominator, gain) {
    return add(denominator, scale(numerator, gain));
  }

  function matchRootSets(previousRoots, currentRoots) {
    const pairs = [];
    previousRoots.forEach((previousRoot, previousIndex) => {
      currentRoots.forEach((currentRoot, currentIndex) => {
        pairs.push({
          previousIndex,
          currentIndex,
          distance: Math.hypot(
            previousRoot.real - currentRoot.real,
            previousRoot.imaginary - currentRoot.imaginary
          )
        });
      });
    });
    pairs.sort((left, right) => left.distance - right.distance);
    const assignedPrevious = new Set();
    const assignedCurrent = new Set();
    const matched = Array(previousRoots.length);
    for (const pair of pairs) {
      if (!assignedPrevious.has(pair.previousIndex) && !assignedCurrent.has(pair.currentIndex)) {
        matched[pair.previousIndex] = currentRoots[pair.currentIndex];
        assignedPrevious.add(pair.previousIndex);
        assignedCurrent.add(pair.currentIndex);
      }
    }
    return matched;
  }

  function rootLocusBranches(numeratorInput, denominatorInput, maximumGainInput, sampleCountInput) {
    const numerator = normalizePolynomial(numeratorInput);
    const denominator = normalizePolynomial(denominatorInput);
    const maximumGain = Number(maximumGainInput);
    const sampleCount = Math.max(20, Math.min(500, Number(sampleCountInput) || 180));
    if (!Number.isFinite(maximumGain) || maximumGain <= 0) {
      throw new Error("根轨迹最大增益必须大于零");
    }
    if (denominator.length < numerator.length) {
      throw new Error("根轨迹要求分母次数不低于分子次数");
    }

    const exponentialScale = 5;
    const denominatorScale = Math.exp(exponentialScale) - 1;
    const gains = Array.from({ length: sampleCount }, (_, index) => {
      if (index === 0) return 0;
      const ratio = index / (sampleCount - 1);
      return maximumGain * (Math.exp(exponentialScale * ratio) - 1) / denominatorScale;
    });
    const initialRoots = complexPolynomialRoots(denominator);
    const branches = initialRoots.map((rootValue) => [{ gain: 0, ...rootValue }]);
    let previousRoots = initialRoots;

    for (let index = 1; index < gains.length; index += 1) {
      const gain = gains[index];
      const rootsAtGain = complexPolynomialRoots(closedLoopPolynomial(numerator, denominator, gain));
      const matchedRoots = matchRootSets(previousRoots, rootsAtGain);
      matchedRoots.forEach((rootValue, branchIndex) => {
        branches[branchIndex].push({ gain, ...rootValue });
      });
      previousRoots = matchedRoots;
    }

    return { gains, branches, maximumGain };
  }

  function normalizeAngle(angle) {
    let value = angle % 360;
    if (value > 180) value -= 360;
    if (value <= -180) value += 360;
    return value;
  }

  function angleBetween(origin, target) {
    return Math.atan2(
      origin.imaginary - target.imaginary,
      origin.real - target.real
    ) * 180 / Math.PI;
  }

  function rootLocusGeometry(numeratorInput, denominatorInput) {
    const numerator = normalizePolynomial(numeratorInput);
    const denominator = normalizePolynomial(denominatorInput);
    const poles = complexPolynomialRoots(denominator);
    const zeros = complexPolynomialRoots(numerator);
    const asymptoteCount = poles.length - zeros.length;
    let centroid = null;
    let asymptoteAngles = [];
    if (asymptoteCount > 0) {
      const poleSum = poles.reduce((sum, value) => addComplex(sum, value), complex(0, 0));
      const zeroSum = zeros.reduce((sum, value) => addComplex(sum, value), complex(0, 0));
      centroid = (poleSum.real - zeroSum.real) / asymptoteCount;
      asymptoteAngles = Array.from(
        { length: asymptoteCount },
        (_, index) => (2 * index + 1) * 180 / asymptoteCount
      );
    }

    const departureAngles = poles
      .map((pole, index) => {
        if (Math.abs(pole.imaginary) < 1e-9) return null;
        const zeroAngles = zeros.reduce((sum, zero) => sum + angleBetween(pole, zero), 0);
        const otherPoleAngles = poles.reduce(
          (sum, otherPole, otherIndex) => otherIndex === index ? sum : sum + angleBetween(pole, otherPole),
          0
        );
        return { point: pole, angle: normalizeAngle(180 + zeroAngles - otherPoleAngles) };
      })
      .filter(Boolean);

    const arrivalAngles = zeros
      .map((zero, index) => {
        if (Math.abs(zero.imaginary) < 1e-9) return null;
        const poleAngles = poles.reduce((sum, pole) => sum + angleBetween(zero, pole), 0);
        const otherZeroAngles = zeros.reduce(
          (sum, otherZero, otherIndex) => otherIndex === index ? sum : sum + angleBetween(zero, otherZero),
          0
        );
        return { point: zero, angle: normalizeAngle(180 - otherZeroAngles + poleAngles) };
      })
      .filter(Boolean);

    return {
      poles,
      zeros,
      asymptoteCount,
      centroid,
      asymptoteAngles,
      departureAngles,
      arrivalAngles
    };
  }

  function transferFunctionFromExpressions(numeratorExpression, denominatorExpression) {
    if (/[ij]/i.test(String(numeratorExpression) + String(denominatorExpression))) {
      const numeratorPart = parseComplexRationalExpression(numeratorExpression || "1");
      const denominatorPart = parseComplexRationalExpression(denominatorExpression);
      if (isZeroComplexPolynomial(denominatorPart.numerator)) {
        throw new Error("分母公式不能为零");
      }
      return {
        numerator: complexPolynomialToReal(
          multiplyComplexPolynomials(numeratorPart.numerator, denominatorPart.denominator),
          "分子中的复数"
        ),
        denominator: complexPolynomialToReal(
          multiplyComplexPolynomials(numeratorPart.denominator, denominatorPart.numerator),
          "分母中的复数"
        )
      };
    }
    const numeratorPart = parseRationalExpression(numeratorExpression || "1");
    const denominatorPart = parseRationalExpression(denominatorExpression);
    if (isZeroPolynomial(denominatorPart.numerator)) {
      throw new Error("分母公式不能为零");
    }
    return {
      numerator: multiply(numeratorPart.numerator, denominatorPart.denominator),
      denominator: multiply(numeratorPart.denominator, denominatorPart.numerator)
    };
  }

  function classifyStationaryPoint(numerator, denominator, coordinate) {
    const n = evaluate(numerator, coordinate);
    const d = evaluate(denominator, coordinate);
    const n2 = evaluate(derivative(derivative(numerator)), coordinate);
    const d2 = evaluate(derivative(derivative(denominator)), coordinate);
    const secondDerivative = -(d2 * n - d * n2) / (n * n);
    const tolerance = 1e-7 * Math.max(1, Math.abs(secondDerivative));

    if (secondDerivative < -tolerance) {
      return { kind: "breakaway", label: "分离点", secondDerivative };
    }
    if (secondDerivative > tolerance) {
      return { kind: "breakin", label: "汇合点", secondDerivative };
    }
    return { kind: "higher-order", label: "高阶驻点", secondDerivative };
  }

  function solveBreakPoints(numeratorInput, denominatorInput) {
    const numerator = normalizePolynomial(numeratorInput);
    const denominator = normalizePolynomial(denominatorInput);

    if (isZeroPolynomial(numerator)) {
      throw new Error("分子 N(s) 不能为零多项式");
    }
    if (isZeroPolynomial(denominator)) {
      throw new Error("分母 D(s) 不能为零多项式");
    }

    const equation = subtract(
      multiply(derivative(denominator), numerator),
      multiply(denominator, derivative(numerator))
    );

    if (isZeroPolynomial(equation)) {
      return { numerator, denominator, equation, candidates: [], validPoints: [], constantGain: true };
    }

    const candidates = realRoots(equation).map((coordinate) => {
      const numeratorValue = evaluate(numerator, coordinate);
      const denominatorValue = evaluate(denominator, coordinate);
      const numeratorScale = Math.max(evaluationScale(numerator, coordinate), 1);

      if (Math.abs(numeratorValue) <= 1e-9 * numeratorScale) {
        return {
          coordinate,
          gain: null,
          valid: false,
          reason: "该点使 N(s)=0，K(s) 无定义"
        };
      }

      const gain = -denominatorValue / numeratorValue;
      if (!Number.isFinite(gain) || gain <= 1e-9) {
        return {
          coordinate,
          gain,
          valid: false,
          reason: "对应 K≤0，不在正增益根轨迹上"
        };
      }

      return {
        coordinate,
        gain,
        valid: true,
        ...classifyStationaryPoint(numerator, denominator, coordinate)
      };
    });

    return {
      numerator,
      denominator,
      equation,
      candidates,
      validPoints: candidates.filter((candidate) => candidate.valid),
      constantGain: false
    };
  }

  return {
    normalizePolynomial,
    derivative,
    add,
    multiply,
    subtract,
    evaluate,
    realRoots,
    polynomialFromRoots,
    parseComplexNumber,
    parseComplexList,
    polynomialFromComplexRoots,
    evaluateComplexPolynomial,
    complexPolynomialRoots,
    closedLoopPolynomial,
    rootLocusBranches,
    rootLocusGeometry,
    parseRationalExpression,
    transferFunctionFromExpressions,
    solveBreakPoints
  };
});
