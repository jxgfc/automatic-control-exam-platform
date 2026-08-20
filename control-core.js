(function (root, factory) {
  const solver = typeof module === "object" && module.exports
    ? require("./solver.js")
    : root.RootLocusSolver;
  const api = factory(solver);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ControlExamCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Solver) {
  "use strict";

  const EPSILON = 1e-10;

  function parsePolynomial(expression) {
    const parsed = Solver.parseRationalExpression(String(expression));
    const denominator = Solver.normalizePolynomial(parsed.denominator);
    if (denominator.length !== 1 || Math.abs(denominator[0]) <= EPSILON) {
      throw new Error("这里需要输入多项式，不能含有关于 s 的分母");
    }
    return Solver.normalizePolynomial(
      parsed.numerator.map((value) => value / denominator[0])
    );
  }

  function buildRouthTable(inputCoefficients) {
    const coefficients = Solver.normalizePolynomial(inputCoefficients);
    if (coefficients.length < 2) {
      throw new Error("特征多项式至少需要一次项");
    }
    if (Math.abs(coefficients[0]) <= EPSILON) {
      throw new Error("特征多项式最高次项系数不能为零");
    }

    const degree = coefficients.length - 1;
    const rowCount = degree + 1;
    const columnCount = Math.ceil((degree + 1) / 2);
    const table = Array.from({ length: rowCount }, () => Array(columnCount).fill(0));
    const events = [];
    const numericalEpsilon = 1e-8 * Math.max(1, ...coefficients.map(Math.abs));

    coefficients.forEach((coefficient, index) => {
      const row = index % 2;
      const column = Math.floor(index / 2);
      table[row][column] = coefficient;
    });

    function replaceZeroRow(rowIndex) {
      const previousPower = degree - rowIndex + 1;
      for (let column = 0; column < columnCount; column += 1) {
        const power = previousPower - 2 * column;
        table[rowIndex][column] = power > 0
          ? power * table[rowIndex - 1][column]
          : 0;
      }
      events.push({
        type: "zero-row",
        row: rowIndex,
        power: degree - rowIndex,
        message: "s^" + (degree - rowIndex) + " 行全零，已用上一行辅助多项式的导数替换"
      });
    }

    if (table[1].every((value) => Math.abs(value) <= EPSILON)) {
      replaceZeroRow(1);
    }

    for (let row = 2; row < rowCount; row += 1) {
      if (Math.abs(table[row - 1][0]) <= EPSILON) {
        table[row - 1][0] = numericalEpsilon;
        events.push({
          type: "zero-first-column",
          row: row - 1,
          power: degree - row + 1,
          message: "s^" + (degree - row + 1) + " 行首项为零，已用 ε 代替并取 ε→0+"
        });
      }

      for (let column = 0; column < columnCount - 1; column += 1) {
        const upperFirst = table[row - 1][0];
        table[row][column] = (
          upperFirst * table[row - 2][column + 1] -
          table[row - 2][0] * table[row - 1][column + 1]
        ) / upperFirst;
      }

      if (table[row].every((value) => Math.abs(value) <= EPSILON)) {
        replaceZeroRow(row);
      }
    }

    const firstColumn = table.map((row) => row[0]);
    let signChanges = 0;
    let previousSign = 0;
    for (const value of firstColumn) {
      const sign = value > EPSILON ? 1 : value < -EPSILON ? -1 : previousSign;
      if (previousSign && sign && sign !== previousSign) {
        signChanges += 1;
      }
      if (sign) {
        previousSign = sign;
      }
    }

    const hasZeroRow = events.some((event) => event.type === "zero-row");
    return {
      coefficients,
      degree,
      table,
      firstColumn,
      signChanges,
      rightHalfPlanePoles: signChanges,
      events,
      stable: signChanges === 0 && !hasZeroRow,
      conclusion: signChanges > 0
        ? "不稳定：右半平面有 " + signChanges + " 个根"
        : hasZeroRow
          ? "出现全零行：存在关于原点对称的根，需结合辅助方程判断虚轴根"
          : "稳定：全部特征根位于左半平面"
    };
  }

  function countTrailingZeros(coefficients) {
    let count = 0;
    for (let index = coefficients.length - 1; index >= 0; index -= 1) {
      if (Math.abs(coefficients[index]) > EPSILON) {
        break;
      }
      count += 1;
    }
    return count;
  }

  function staticErrorAnalysis(numeratorInput, denominatorInput, inputOrder, amplitude) {
    const numerator = Solver.normalizePolynomial(numeratorInput);
    const denominator = Solver.normalizePolynomial(denominatorInput);
    const order = Number(inputOrder);
    const inputAmplitude = Number(amplitude);
    if (![0, 1, 2].includes(order)) {
      throw new Error("输入信号只能选择阶跃、斜坡或抛物线");
    }
    if (!Number.isFinite(inputAmplitude)) {
      throw new Error("输入幅值必须是有限数字");
    }

    const numeratorZeros = countTrailingZeros(numerator);
    const denominatorZeros = countTrailingZeros(denominator);
    const netIntegratorCount = denominatorZeros - numeratorZeros;
    const systemType = Math.max(0, netIntegratorCount);
    const numeratorReduced = numerator.slice(0, numerator.length - numeratorZeros || numerator.length);
    const denominatorReduced = denominator.slice(0, denominator.length - denominatorZeros || denominator.length);
    const finiteConstant = numeratorReduced[numeratorReduced.length - 1] /
      denominatorReduced[denominatorReduced.length - 1];

    function limitForPower(power) {
      const exponent = power - netIntegratorCount;
      if (exponent < 0) {
        return Infinity;
      }
      if (exponent > 0) {
        return 0;
      }
      return finiteConstant;
    }

    const constants = {
      kp: limitForPower(0),
      kv: limitForPower(1),
      ka: limitForPower(2)
    };

    let steadyStateError;
    let formula;
    if (systemType > order) {
      steadyStateError = 0;
      formula = "系统型别高于输入阶次，e_ss = 0";
    } else if (systemType < order) {
      steadyStateError = Infinity;
      formula = "系统型别低于输入阶次，e_ss = ∞";
    } else if (order === 0) {
      steadyStateError = inputAmplitude / (1 + constants.kp);
      formula = "e_ss = A / (1 + Kp)";
    } else {
      const selectedConstant = order === 1 ? constants.kv : constants.ka;
      steadyStateError = inputAmplitude / selectedConstant;
      formula = order === 1 ? "e_ss = A / Kv" : "e_ss = A / Ka";
    }

    return {
      numerator,
      denominator,
      systemType,
      netIntegratorCount,
      inputOrder: order,
      amplitude: inputAmplitude,
      constants,
      steadyStateError,
      formula
    };
  }

  function secondOrderMetrics(dampingRatioInput, naturalFrequencyInput) {
    const dampingRatio = Number(dampingRatioInput);
    const naturalFrequency = Number(naturalFrequencyInput);
    if (!Number.isFinite(dampingRatio) || dampingRatio < 0) {
      throw new Error("阻尼比 ζ 必须是大于或等于零的数字");
    }
    if (!Number.isFinite(naturalFrequency) || naturalFrequency <= 0) {
      throw new Error("自然频率 ωn 必须大于零");
    }

    let category;
    let poles;
    let dampedFrequency = null;
    let overshootPercent = 0;
    let peakTime = null;
    let riseTime = null;

    if (dampingRatio === 0) {
      category = "无阻尼振荡";
      poles = [
        { real: 0, imaginary: naturalFrequency },
        { real: 0, imaginary: -naturalFrequency }
      ];
      dampedFrequency = naturalFrequency;
      overshootPercent = 100;
      peakTime = Math.PI / naturalFrequency;
      riseTime = Math.PI / (2 * naturalFrequency);
    } else if (dampingRatio < 1) {
      category = "欠阻尼";
      dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
      poles = [
        { real: -dampingRatio * naturalFrequency, imaginary: dampedFrequency },
        { real: -dampingRatio * naturalFrequency, imaginary: -dampedFrequency }
      ];
      overshootPercent = Math.exp(
        -Math.PI * dampingRatio / Math.sqrt(1 - dampingRatio * dampingRatio)
      ) * 100;
      peakTime = Math.PI / dampedFrequency;
      riseTime = (Math.PI - Math.acos(dampingRatio)) / dampedFrequency;
    } else if (Math.abs(dampingRatio - 1) <= EPSILON) {
      category = "临界阻尼";
      poles = [
        { real: -naturalFrequency, imaginary: 0 },
        { real: -naturalFrequency, imaginary: 0 }
      ];
    } else {
      category = "过阻尼";
      const offset = naturalFrequency * Math.sqrt(dampingRatio * dampingRatio - 1);
      poles = [
        { real: -dampingRatio * naturalFrequency + offset, imaginary: 0 },
        { real: -dampingRatio * naturalFrequency - offset, imaginary: 0 }
      ];
    }

    return {
      dampingRatio,
      naturalFrequency,
      category,
      poles,
      dampedFrequency,
      overshootPercent,
      peakTime,
      riseTime,
      settlingTime2: dampingRatio > 0 ? 4 / (dampingRatio * naturalFrequency) : Infinity,
      settlingTime5: dampingRatio > 0 ? 3 / (dampingRatio * naturalFrequency) : Infinity
    };
  }

  function secondOrderStepValue(metrics, time) {
    const zeta = metrics.dampingRatio;
    const wn = metrics.naturalFrequency;
    if (zeta < 1) {
      const root = Math.sqrt(1 - zeta * zeta);
      const wd = wn * root;
      const phase = Math.acos(zeta);
      return 1 - Math.exp(-zeta * wn * time) * Math.sin(wd * time + phase) / root;
    }
    if (Math.abs(zeta - 1) <= EPSILON) {
      return 1 - Math.exp(-wn * time) * (1 + wn * time);
    }
    const p1 = metrics.poles[0].real;
    const p2 = metrics.poles[1].real;
    return 1 + (p2 * Math.exp(p1 * time) - p1 * Math.exp(p2 * time)) / (p1 - p2);
  }

  function firstOrderMetrics(gainInput, timeConstantInput) {
    const gain = Number(gainInput);
    const timeConstant = Number(timeConstantInput);
    if (!Number.isFinite(gain) || !(timeConstant > 0)) throw new Error("一阶系统要求有限增益K且时间常数T>0");
    return {
      gain,
      timeConstant,
      pole: -1 / timeConstant,
      riseTime10To90: Math.log(9) * timeConstant,
      settlingTime2: -Math.log(0.02) * timeConstant,
      settlingTime5: -Math.log(0.05) * timeConstant,
      valueAtTime: (time) => gain * (1 - Math.exp(-Math.max(0, time) / timeConstant))
    };
  }

  function higherOrderAnalysis(numeratorInput, denominatorInput) {
    const numerator = Solver.normalizePolynomial(numeratorInput);
    const denominator = Solver.normalizePolynomial(denominatorInput);
    if (denominator.length < 2) throw new Error("高阶系统分母至少为一次多项式");
    const poles = Solver.complexPolynomialRoots(denominator).sort((left, right) => right.real - left.real || Math.abs(right.imaginary) - Math.abs(left.imaginary));
    const zeros = numerator.length > 1 ? Solver.complexPolynomialRoots(numerator) : [];
    const unstablePoles = poles.filter((pole) => pole.real >= -1e-8);
    const first = poles[0];
    let dominantPoles = [first];
    if (Math.abs(first.imaginary) > 1e-7) {
      const conjugate = poles.find((pole, index) => index > 0 && Math.abs(pole.real - first.real) < 1e-5 && Math.abs(pole.imaginary + first.imaginary) < 1e-5);
      if (conjugate) dominantPoles.push(conjugate);
    }
    const dominantDecay = Math.max(1e-12, -first.real);
    const nonDominant = poles.filter((pole) => !dominantPoles.includes(pole));
    const separationRatio = nonDominant.length
      ? Math.min(...nonDominant.map((pole) => Math.max(0, -pole.real))) / dominantDecay
      : Infinity;
    const cancellations = [];
    zeros.forEach((zero) => {
      poles.forEach((pole) => {
        const distance = Math.hypot(zero.real - pole.real, zero.imaginary - pole.imaginary);
        if (distance <= 0.05 * Math.max(1, Math.hypot(pole.real, pole.imaginary))) cancellations.push({ zero, pole, distance });
      });
    });
    let equivalent = null;
    if (dominantPoles.length === 2) {
      const naturalFrequency = Math.hypot(first.real, first.imaginary);
      equivalent = {
        order: 2,
        naturalFrequency,
        dampingRatio: naturalFrequency > 0 ? -first.real / naturalFrequency : 0,
        metrics: naturalFrequency > 0 && first.real < 0 ? secondOrderMetrics(-first.real / naturalFrequency, naturalFrequency) : null
      };
    } else if (first.real < 0 && Math.abs(first.imaginary) <= 1e-7) {
      equivalent = { order: 1, timeConstant: -1 / first.real };
    }
    return {
      numerator,
      denominator,
      poles,
      zeros,
      stable: unstablePoles.length === 0,
      unstablePoles,
      dominantPoles,
      separationRatio,
      approximationReliable: separationRatio >= 5,
      cancellations,
      equivalent
    };
  }

  function automaticFrequencyRange(numerator, denominator) {
    const roots = [
      ...Solver.complexPolynomialRoots(numerator),
      ...Solver.complexPolynomialRoots(denominator)
    ];
    const breakFrequencies = roots
      .map((rootValue) => Math.hypot(rootValue.real, rootValue.imaginary))
      .filter((value) => value > 1e-8 && Number.isFinite(value));
    if (!breakFrequencies.length) {
      return { minimum: 0.01, maximum: 100 };
    }
    return {
      minimum: Math.max(1e-4, Math.min(...breakFrequencies) / 100),
      maximum: Math.min(1e6, Math.max(...breakFrequencies) * 100)
    };
  }

  function interpolateLogCrossing(left, right, leftValue, rightValue, target) {
    const ratio = (target - leftValue) / (rightValue - leftValue);
    const logFrequency = Math.log10(left.frequency) + ratio * (
      Math.log10(right.frequency) - Math.log10(left.frequency)
    );
    return {
      ratio,
      frequency: Math.pow(10, logFrequency)
    };
  }

  function bodeAnalysis(numeratorInput, denominatorInput, minimumInput, maximumInput, pointCountInput) {
    const numerator = Solver.normalizePolynomial(numeratorInput);
    const denominator = Solver.normalizePolynomial(denominatorInput);
    const automaticRange = automaticFrequencyRange(numerator, denominator);
    const minimum = Number(minimumInput) > 0 ? Number(minimumInput) : automaticRange.minimum;
    const maximum = Number(maximumInput) > minimum ? Number(maximumInput) : automaticRange.maximum;
    const pointCount = Math.max(80, Math.min(800, Number(pointCountInput) || 320));
    if (!(minimum > 0) || !(maximum > minimum)) {
      throw new Error("频率范围必须满足 0 < ωmin < ωmax");
    }

    const startLog = Math.log10(minimum);
    const endLog = Math.log10(maximum);
    const points = [];
    let previousPhase = null;

    for (let index = 0; index < pointCount; index += 1) {
      const ratio = index / (pointCount - 1);
      const frequency = Math.pow(10, startLog + ratio * (endLog - startLog));
      const s = { real: 0, imaginary: frequency };
      const numeratorValue = Solver.evaluateComplexPolynomial(numerator, s);
      const denominatorValue = Solver.evaluateComplexPolynomial(denominator, s);
      const denominatorMagnitudeSquared = denominatorValue.real * denominatorValue.real +
        denominatorValue.imaginary * denominatorValue.imaginary;
      if (denominatorMagnitudeSquared <= 1e-30) {
        continue;
      }
      const responseReal = (
        numeratorValue.real * denominatorValue.real +
        numeratorValue.imaginary * denominatorValue.imaginary
      ) / denominatorMagnitudeSquared;
      const responseImaginary = (
        numeratorValue.imaginary * denominatorValue.real -
        numeratorValue.real * denominatorValue.imaginary
      ) / denominatorMagnitudeSquared;
      const magnitude = Math.hypot(responseReal, responseImaginary);
      const magnitudeDb = 20 * Math.log10(Math.max(magnitude, 1e-300));
      let phase = Math.atan2(responseImaginary, responseReal) * 180 / Math.PI;
      if (previousPhase !== null) {
        while (phase - previousPhase > 180) phase -= 360;
        while (phase - previousPhase < -180) phase += 360;
      }
      previousPhase = phase;
      points.push({ frequency, magnitude, magnitudeDb, phase, real: responseReal, imaginary: responseImaginary });
    }

    let gainCrossover = null;
    let phaseMargin = null;
    let phaseCrossover = null;
    let gainMarginDb = Infinity;
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      if (!gainCrossover && left.magnitudeDb * right.magnitudeDb <= 0 && left.magnitudeDb !== right.magnitudeDb) {
        const crossing = interpolateLogCrossing(left, right, left.magnitudeDb, right.magnitudeDb, 0);
        const phaseAtCrossing = left.phase + crossing.ratio * (right.phase - left.phase);
        gainCrossover = crossing.frequency;
        phaseMargin = 180 + phaseAtCrossing;
      }
      const leftPhaseOffset = left.phase + 180;
      const rightPhaseOffset = right.phase + 180;
      if (!phaseCrossover && leftPhaseOffset * rightPhaseOffset <= 0 && left.phase !== right.phase) {
        const crossing = interpolateLogCrossing(left, right, left.phase, right.phase, -180);
        const magnitudeAtCrossing = left.magnitudeDb + crossing.ratio * (right.magnitudeDb - left.magnitudeDb);
        phaseCrossover = crossing.frequency;
        gainMarginDb = -magnitudeAtCrossing;
      }
    }

    return {
      numerator,
      denominator,
      minimumFrequency: minimum,
      maximumFrequency: maximum,
      points,
      gainCrossover,
      phaseMargin,
      phaseCrossover,
      gainMarginDb,
      gainMargin: gainMarginDb === Infinity ? Infinity : Math.pow(10, gainMarginDb / 20)
    };
  }

  function rightHalfPlaneRootCount(coefficients) {
    const roots = Solver.complexPolynomialRoots(coefficients);
    return {
      roots,
      rightHalfPlane: roots.filter((root) => root.real > 1e-8).length,
      imaginaryAxis: roots.filter((root) => Math.abs(root.real) <= 1e-8).length
    };
  }

  function nyquistAnalysis(numeratorInput, denominatorInput, minimumInput, maximumInput, pointCountInput) {
    const bode = bodeAnalysis(numeratorInput, denominatorInput, minimumInput, maximumInput, pointCountInput || 420);
    const openLoop = rightHalfPlaneRootCount(bode.denominator);
    const closedLoopPolynomial = Solver.add(bode.denominator, bode.numerator);
    const closedLoop = rightHalfPlaneRootCount(closedLoopPolynomial);
    const clockwiseEncirclements = openLoop.rightHalfPlane - closedLoop.rightHalfPlane;
    const closedLoopPoints = bode.points.map((point) => {
      const denominatorReal = 1 + point.real;
      const denominatorImaginary = point.imaginary;
      const denominatorMagnitude = denominatorReal * denominatorReal + denominatorImaginary * denominatorImaginary;
      const real = (point.real * denominatorReal + point.imaginary * denominatorImaginary) / denominatorMagnitude;
      const imaginary = (point.imaginary * denominatorReal - point.real * denominatorImaginary) / denominatorMagnitude;
      return { frequency: point.frequency, real, imaginary, magnitude: Math.hypot(real, imaginary) };
    });
    const resonantPoint = closedLoopPoints.reduce((best, point) => point.magnitude > best.magnitude ? point : best, closedLoopPoints[0]);
    const lowFrequencyMagnitude = closedLoopPoints[0].magnitude;
    const bandwidthTarget = lowFrequencyMagnitude / Math.sqrt(2);
    let bandwidth = null;
    for (let index = 1; index < closedLoopPoints.length; index += 1) {
      const left = closedLoopPoints[index - 1];
      const right = closedLoopPoints[index];
      if (left.magnitude >= bandwidthTarget && right.magnitude <= bandwidthTarget) {
        const ratio = (bandwidthTarget - left.magnitude) / (right.magnitude - left.magnitude);
        bandwidth = Math.pow(10, Math.log10(left.frequency) + ratio * (Math.log10(right.frequency) - Math.log10(left.frequency)));
        break;
      }
    }
    return {
      ...bode,
      openLoopPoles: openLoop.roots,
      closedLoopPoles: closedLoop.roots,
      openLoopRightHalfPlanePoles: openLoop.rightHalfPlane,
      imaginaryAxisOpenLoopPoles: openLoop.imaginaryAxis,
      closedLoopRightHalfPlanePoles: closedLoop.rightHalfPlane,
      clockwiseEncirclements,
      closedLoopStable: closedLoop.rightHalfPlane === 0 && closedLoop.imaginaryAxis === 0,
      closedLoopPoints,
      resonantPeak: resonantPoint.magnitude,
      resonantFrequency: resonantPoint.frequency,
      bandwidth
    };
  }

  function interpolatePointByValue(points, property, target) {
    for (let index = 1; index < points.length; index += 1) {
      const left = points[index - 1];
      const right = points[index];
      const leftValue = left[property];
      const rightValue = right[property];
      if ((leftValue - target) * (rightValue - target) <= 0 && leftValue !== rightValue) {
        const crossing = interpolateLogCrossing(left, right, leftValue, rightValue, target);
        return { ...crossing, left, right };
      }
    }
    return null;
  }

  function leadCompensatorDesign(numerator, denominator, desiredPhaseMarginInput, safetyInput) {
    const desiredPhaseMargin = Number(desiredPhaseMarginInput);
    const safety = Number.isFinite(Number(safetyInput)) ? Number(safetyInput) : 5;
    if (!(desiredPhaseMargin > 0 && desiredPhaseMargin < 90)) throw new Error("期望相角裕度应在0°到90°之间");
    const original = bodeAnalysis(numerator, denominator, null, null, 520);
    const currentMargin = original.phaseMargin == null ? 0 : original.phaseMargin;
    const requiredPhase = desiredPhaseMargin - currentMargin + safety;
    if (requiredPhase <= 0) throw new Error("原系统已满足期望相角裕度，无需超前校正");
    if (requiredPhase >= 85) throw new Error("单级超前网络所需补偿相角过大，请采用多级校正");
    const radians = requiredPhase * Math.PI / 180;
    const alpha = (1 - Math.sin(radians)) / (1 + Math.sin(radians));
    const targetMagnitudeDb = 10 * Math.log10(alpha);
    const crossing = interpolatePointByValue(original.points, "magnitudeDb", targetMagnitudeDb);
    if (!crossing) throw new Error("自动频率范围内找不到超前网络设计频率");
    const maximumPhaseFrequency = crossing.frequency;
    const timeConstant = 1 / (maximumPhaseFrequency * Math.sqrt(alpha));
    const compensator = { numerator: [timeConstant, 1], denominator: [alpha * timeConstant, 1] };
    const compensatedNumerator = Solver.multiply(numerator, compensator.numerator);
    const compensatedDenominator = Solver.multiply(denominator, compensator.denominator);
    const compensated = bodeAnalysis(compensatedNumerator, compensatedDenominator, original.minimumFrequency, original.maximumFrequency, 520);
    return { original, compensated, desiredPhaseMargin, safety, requiredPhase, alpha, timeConstant, maximumPhaseFrequency, compensator };
  }

  function lagCompensatorDesign(numerator, denominator, desiredPhaseMarginInput, betaInput, safetyInput) {
    const desiredPhaseMargin = Number(desiredPhaseMarginInput);
    const beta = Number(betaInput);
    const safety = Number.isFinite(Number(safetyInput)) ? Number(safetyInput) : 6;
    if (!(desiredPhaseMargin > 0 && desiredPhaseMargin < 90) || !(beta > 1)) throw new Error("滞后校正要求0°<期望裕度<90°且低频增益倍率β>1");
    const original = bodeAnalysis(numerator, denominator, null, null, 520);
    const targetPhase = -180 + desiredPhaseMargin + safety;
    const crossing = interpolatePointByValue(original.points, "phase", targetPhase);
    if (!crossing) throw new Error("自动频率范围内找不到满足目标相角的频率");
    const crossover = crossing.frequency;
    const timeConstant = 10 / crossover;
    const compensatorWithoutGain = { numerator: [beta * timeConstant, beta], denominator: [beta * timeConstant, 1] };
    const provisionalNumerator = Solver.multiply(numerator, compensatorWithoutGain.numerator);
    const provisionalDenominator = Solver.multiply(denominator, compensatorWithoutGain.denominator);
    const provisional = bodeAnalysis(provisionalNumerator, provisionalDenominator, crossover / 1.02, crossover * 1.02, 80);
    const middlePoint = provisional.points[Math.floor(provisional.points.length / 2)];
    const gain = 1 / middlePoint.magnitude;
    const compensator = { numerator: compensatorWithoutGain.numerator.map((value) => value * gain), denominator: compensatorWithoutGain.denominator };
    const compensatedNumerator = Solver.multiply(numerator, compensator.numerator);
    const compensatedDenominator = Solver.multiply(denominator, compensator.denominator);
    const compensated = bodeAnalysis(compensatedNumerator, compensatedDenominator, original.minimumFrequency, original.maximumFrequency, 520);
    return { original, compensated, desiredPhaseMargin, safety, beta, crossover, timeConstant, gain, compensator };
  }

  function zieglerNicholsPid(ultimateGainInput, ultimatePeriodInput, controllerType) {
    const ultimateGain = Number(ultimateGainInput);
    const ultimatePeriod = Number(ultimatePeriodInput);
    if (!(ultimateGain > 0) || !(ultimatePeriod > 0)) throw new Error("临界增益Ku和临界周期Tu必须大于零");
    let kp;
    let ti = Infinity;
    let td = 0;
    if (controllerType === "P") kp = 0.5 * ultimateGain;
    else if (controllerType === "PI") {
      kp = 0.45 * ultimateGain;
      ti = ultimatePeriod / 1.2;
    } else {
      kp = 0.6 * ultimateGain;
      ti = ultimatePeriod / 2;
      td = ultimatePeriod / 8;
    }
    return {
      type: controllerType === "P" || controllerType === "PI" ? controllerType : "PID",
      kp,
      ti,
      td,
      ki: ti === Infinity ? 0 : kp / ti,
      kd: kp * td
    };
  }

  return {
    parsePolynomial,
    buildRouthTable,
    staticErrorAnalysis,
    firstOrderMetrics,
    secondOrderMetrics,
    secondOrderStepValue,
    higherOrderAnalysis,
    automaticFrequencyRange,
    bodeAnalysis,
    nyquistAnalysis,
    leadCompensatorDesign,
    lagCompensatorDesign,
    zieglerNicholsPid
  };
});
