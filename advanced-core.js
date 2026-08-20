(function (root, factory) {
  const solver = typeof module === "object" && module.exports
    ? require("./solver.js")
    : root.RootLocusSolver;
  const api = factory(solver);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ControlAdvancedCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Solver) {
  "use strict";

  const EPSILON = 1e-10;

  function rational(numerator, denominator) {
    let num = Solver.normalizePolynomial(numerator);
    let den = Solver.normalizePolynomial(denominator);
    if (den.every((value) => Math.abs(value) <= EPSILON)) throw new Error("有理式分母不能为零");
    const leading = den[0];
    num = num.map((value) => value / leading);
    den = den.map((value) => value / leading);
    if (num.length > 1 && den.length > 1 && !num.every((value) => Math.abs(value) <= EPSILON)) {
      try {
        const numeratorRoots = Solver.complexPolynomialRoots(num);
        const denominatorRoots = Solver.complexPolynomialRoots(den);
        const usedDenominatorRoots = new Set();
        const remainingNumeratorRoots = [];
        let cancellationCount = 0;
        numeratorRoots.forEach((numeratorRoot) => {
          let matchIndex = -1;
          let matchDistance = Infinity;
          denominatorRoots.forEach((denominatorRoot, index) => {
            if (usedDenominatorRoots.has(index)) return;
            const distance = Math.hypot(
              numeratorRoot.real - denominatorRoot.real,
              numeratorRoot.imaginary - denominatorRoot.imaginary
            );
            if (distance < matchDistance) {
              matchDistance = distance;
              matchIndex = index;
            }
          });
          if (matchIndex >= 0 && matchDistance <= 1e-7 * Math.max(1, Math.hypot(numeratorRoot.real, numeratorRoot.imaginary))) {
            usedDenominatorRoots.add(matchIndex);
            cancellationCount += 1;
          } else {
            remainingNumeratorRoots.push(numeratorRoot);
          }
        });
        if (cancellationCount > 0) {
          const remainingDenominatorRoots = denominatorRoots.filter((_, index) => !usedDenominatorRoots.has(index));
          const gain = num[0];
          const numeratorBase = remainingNumeratorRoots.length
            ? Solver.polynomialFromComplexRoots(remainingNumeratorRoots)
            : [1];
          num = numeratorBase.map((value) => value * gain);
          den = remainingDenominatorRoots.length
            ? Solver.polynomialFromComplexRoots(remainingDenominatorRoots)
            : [1];
        }
      } catch (_) {
        // Keep the unsimplified ratio when numerical root cancellation is inconclusive.
      }
    }
    return { numerator: num, denominator: den };
  }

  function rationalAdd(left, right) {
    return rational(
      Solver.add(
        Solver.multiply(left.numerator, right.denominator),
        Solver.multiply(right.numerator, left.denominator)
      ),
      Solver.multiply(left.denominator, right.denominator)
    );
  }

  function rationalSubtract(left, right) {
    return rational(
      Solver.subtract(
        Solver.multiply(left.numerator, right.denominator),
        Solver.multiply(right.numerator, left.denominator)
      ),
      Solver.multiply(left.denominator, right.denominator)
    );
  }

  function rationalMultiply(left, right) {
    return rational(
      Solver.multiply(left.numerator, right.numerator),
      Solver.multiply(left.denominator, right.denominator)
    );
  }

  function rationalDivide(left, right) {
    if (right.numerator.every((value) => Math.abs(value) <= EPSILON)) throw new Error("有理式除以零");
    return rational(
      Solver.multiply(left.numerator, right.denominator),
      Solver.multiply(left.denominator, right.numerator)
    );
  }

  function rationalNegate(value) {
    return rational(value.numerator.map((coefficient) => -coefficient), value.denominator);
  }

  function parseMatrix(rawValue) {
    const rows = String(rawValue).trim().split(/[;；\n]+/).map((row) => row.trim()).filter(Boolean);
    if (!rows.length) throw new Error("矩阵不能为空");
    const matrix = rows.map((row) => row.split(/[\s,，]+/).filter(Boolean).map(Number));
    const columnCount = matrix[0].length;
    if (!columnCount || matrix.some((row) => row.length !== columnCount)) throw new Error("矩阵每行的列数必须相同");
    if (matrix.flat().some((value) => !Number.isFinite(value))) throw new Error("矩阵中含有无法识别的数字");
    return matrix;
  }

  function matrixShape(matrix) {
    if (!Array.isArray(matrix) || !matrix.length || !Array.isArray(matrix[0])) throw new Error("矩阵格式不正确");
    const columns = matrix[0].length;
    if (!columns || matrix.some((row) => row.length !== columns)) throw new Error("矩阵每行的列数必须相同");
    return { rows: matrix.length, columns };
  }

  function zeroMatrix(rows, columns) {
    return Array.from({ length: rows }, () => Array(columns).fill(0));
  }

  function identityMatrix(size) {
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => row === column ? 1 : 0));
  }

  function matrixAdd(left, right) {
    const a = matrixShape(left);
    const b = matrixShape(right);
    if (a.rows !== b.rows || a.columns !== b.columns) throw new Error("矩阵加法要求维数相同");
    return left.map((row, rowIndex) => row.map((value, columnIndex) => value + right[rowIndex][columnIndex]));
  }

  function matrixScale(matrix, factor) {
    return matrix.map((row) => row.map((value) => value * factor));
  }

  function matrixMultiply(left, right) {
    const a = matrixShape(left);
    const b = matrixShape(right);
    if (a.columns !== b.rows) throw new Error("矩阵乘法维数不匹配");
    const result = zeroMatrix(a.rows, b.columns);
    for (let row = 0; row < a.rows; row += 1) {
      for (let column = 0; column < b.columns; column += 1) {
        for (let index = 0; index < a.columns; index += 1) result[row][column] += left[row][index] * right[index][column];
      }
    }
    return result;
  }

  function matrixTranspose(matrix) {
    const shape = matrixShape(matrix);
    return Array.from({ length: shape.columns }, (_, column) => Array.from({ length: shape.rows }, (_, row) => matrix[row][column]));
  }

  function matrixTrace(matrix) {
    const shape = matrixShape(matrix);
    if (shape.rows !== shape.columns) throw new Error("只有方阵可以求迹");
    return matrix.reduce((sum, row, index) => sum + row[index], 0);
  }

  function rowReduce(inputMatrix, augmentedColumns) {
    const matrix = inputMatrix.map((row) => row.slice());
    const shape = matrixShape(matrix);
    const pivotLimit = shape.columns - (augmentedColumns || 0);
    let pivotRow = 0;
    const pivots = [];
    for (let column = 0; column < pivotLimit && pivotRow < shape.rows; column += 1) {
      let bestRow = pivotRow;
      for (let row = pivotRow + 1; row < shape.rows; row += 1) {
        if (Math.abs(matrix[row][column]) > Math.abs(matrix[bestRow][column])) bestRow = row;
      }
      if (Math.abs(matrix[bestRow][column]) <= EPSILON) continue;
      [matrix[pivotRow], matrix[bestRow]] = [matrix[bestRow], matrix[pivotRow]];
      const pivot = matrix[pivotRow][column];
      matrix[pivotRow] = matrix[pivotRow].map((value) => value / pivot);
      for (let row = 0; row < shape.rows; row += 1) {
        if (row === pivotRow) continue;
        const factor = matrix[row][column];
        if (Math.abs(factor) <= EPSILON) continue;
        matrix[row] = matrix[row].map((value, index) => value - factor * matrix[pivotRow][index]);
      }
      pivots.push(column);
      pivotRow += 1;
    }
    return { matrix, pivots, rank: pivots.length };
  }

  function matrixRank(matrix) {
    return rowReduce(matrix, 0).rank;
  }

  function matrixInverse(matrix) {
    const shape = matrixShape(matrix);
    if (shape.rows !== shape.columns) throw new Error("只有方阵可以求逆");
    const augmented = matrix.map((row, index) => row.concat(identityMatrix(shape.rows)[index]));
    const reduced = rowReduce(augmented, shape.rows);
    if (reduced.rank !== shape.rows) throw new Error("矩阵奇异，不存在逆矩阵");
    return reduced.matrix.map((row) => row.slice(shape.rows));
  }

  function solveLinearSystem(matrix, vector) {
    const shape = matrixShape(matrix);
    if (shape.rows !== shape.columns || vector.length !== shape.rows) throw new Error("线性方程组维数不匹配");
    const augmented = matrix.map((row, index) => row.concat([vector[index]]));
    const reduced = rowReduce(augmented, 1);
    if (reduced.rank !== shape.rows) throw new Error("线性方程组无唯一解");
    return reduced.matrix.map((row) => row[shape.columns]);
  }

  function matrixPower(matrix, exponent) {
    const shape = matrixShape(matrix);
    if (shape.rows !== shape.columns || !Number.isInteger(exponent) || exponent < 0) throw new Error("矩阵幂要求方阵和非负整数指数");
    let result = identityMatrix(shape.rows);
    let base = matrix.map((row) => row.slice());
    let power = exponent;
    while (power > 0) {
      if (power % 2 === 1) result = matrixMultiply(result, base);
      base = matrixMultiply(base, base);
      power = Math.floor(power / 2);
    }
    return result;
  }

  function matrixNormInfinity(matrix) {
    return Math.max(...matrix.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0)));
  }

  function matrixExponential(matrix, timeInput) {
    const shape = matrixShape(matrix);
    const time = Number(timeInput);
    if (shape.rows !== shape.columns || !Number.isFinite(time)) throw new Error("矩阵指数要求方阵和有限时间");
    const scaledMatrix = matrixScale(matrix, time);
    const norm = matrixNormInfinity(scaledMatrix);
    const scaling = Math.max(0, Math.ceil(Math.log2(Math.max(1, norm))));
    const divisor = Math.pow(2, scaling);
    const base = matrixScale(scaledMatrix, 1 / divisor);
    let result = identityMatrix(shape.rows);
    let term = identityMatrix(shape.rows);
    for (let order = 1; order <= 80; order += 1) {
      term = matrixScale(matrixMultiply(term, base), 1 / order);
      result = matrixAdd(result, term);
      if (matrixNormInfinity(term) < 1e-13) break;
    }
    for (let count = 0; count < scaling; count += 1) result = matrixMultiply(result, result);
    return result;
  }

  function characteristicPolynomial(matrix) {
    const shape = matrixShape(matrix);
    if (shape.rows !== shape.columns) throw new Error("特征多项式要求方阵");
    const size = shape.rows;
    const identity = identityMatrix(size);
    let b = identityMatrix(size);
    const coefficients = [1];
    for (let order = 1; order <= size; order += 1) {
      const product = matrixMultiply(matrix, b);
      const coefficient = -matrixTrace(product) / order;
      coefficients.push(Math.abs(coefficient) < EPSILON ? 0 : coefficient);
      b = matrixAdd(product, matrixScale(identity, coefficient));
    }
    return coefficients;
  }

  function matrixPolynomial(matrix, coefficients) {
    const shape = matrixShape(matrix);
    if (shape.rows !== shape.columns) throw new Error("矩阵多项式要求方阵");
    let result = zeroMatrix(shape.rows, shape.rows);
    for (const coefficient of coefficients) {
      result = matrixAdd(matrixMultiply(result, matrix), matrixScale(identityMatrix(shape.rows), coefficient));
    }
    return result;
  }

  function horizontalJoin(blocks) {
    if (!blocks.length) return [];
    const rowCount = blocks[0].length;
    if (blocks.some((block) => block.length !== rowCount)) throw new Error("矩阵横向拼接行数不一致");
    return Array.from({ length: rowCount }, (_, row) => blocks.flatMap((block) => block[row]));
  }

  function verticalJoin(blocks) {
    if (!blocks.length) return [];
    const columnCount = blocks[0][0].length;
    if (blocks.some((block) => block[0].length !== columnCount)) throw new Error("矩阵纵向拼接列数不一致");
    return blocks.flatMap((block) => block.map((row) => row.slice()));
  }

  function controllabilityMatrix(a, b) {
    const aShape = matrixShape(a);
    const bShape = matrixShape(b);
    if (aShape.rows !== aShape.columns || bShape.rows !== aShape.rows) throw new Error("A、B矩阵维数不匹配");
    const blocks = [];
    let current = b.map((row) => row.slice());
    for (let order = 0; order < aShape.rows; order += 1) {
      blocks.push(current);
      current = matrixMultiply(a, current);
    }
    return horizontalJoin(blocks);
  }

  function observabilityMatrix(a, c) {
    const aShape = matrixShape(a);
    const cShape = matrixShape(c);
    if (aShape.rows !== aShape.columns || cShape.columns !== aShape.rows) throw new Error("A、C矩阵维数不匹配");
    const blocks = [];
    let current = c.map((row) => row.slice());
    for (let order = 0; order < aShape.rows; order += 1) {
      blocks.push(current);
      current = matrixMultiply(current, a);
    }
    return verticalJoin(blocks);
  }

  function transferToControllableCanonical(numeratorInput, denominatorInput) {
    const denominator = Solver.normalizePolynomial(denominatorInput);
    let numerator = Solver.normalizePolynomial(numeratorInput);
    const order = denominator.length - 1;
    if (order < 1 || numerator.length > denominator.length) throw new Error("传递函数阶次不正确");
    const leading = denominator[0];
    const den = denominator.map((value) => value / leading);
    numerator = Array(den.length - numerator.length).fill(0).concat(numerator.map((value) => value / leading));
    const d = numerator[0];
    const strictlyProper = numerator.slice(1).map((value, index) => value - d * den[index + 1]);
    const a = zeroMatrix(order, order);
    for (let row = 0; row < order - 1; row += 1) a[row][row + 1] = 1;
    a[order - 1] = den.slice(1).reverse().map((value) => -value);
    const b = Array.from({ length: order }, (_, row) => [row === order - 1 ? 1 : 0]);
    const c = [strictlyProper.slice().reverse()];
    return { a, b, c, d: [[d]] };
  }

  function stateSpaceToTransfer(a, b, c, dInput) {
    const size = matrixShape(a).rows;
    if (matrixShape(a).columns !== size || matrixShape(b).rows !== size || matrixShape(b).columns !== 1 || matrixShape(c).rows !== 1 || matrixShape(c).columns !== size) throw new Error("当前转换器要求SISO状态空间模型");
    const d = Array.isArray(dInput) ? Number(dInput[0][0]) : Number(dInput || 0);
    const denominator = characteristicPolynomial(a);
    const markov = [];
    let powerB = b.map((row) => row.slice());
    for (let order = 1; order <= size; order += 1) {
      markov.push(matrixMultiply(c, powerB)[0][0]);
      powerB = matrixMultiply(a, powerB);
    }
    const numerator = [d];
    for (let order = 1; order <= size; order += 1) {
      let coefficient = denominator[order] * d;
      for (let index = 1; index <= order; index += 1) coefficient += denominator[order - index] * markov[index - 1];
      numerator.push(Math.abs(coefficient) < EPSILON ? 0 : coefficient);
    }
    return { numerator: Solver.normalizePolynomial(numerator), denominator };
  }

  function polePlacement(a, b, desiredPoles) {
    const size = matrixShape(a).rows;
    if (matrixShape(a).columns !== size || matrixShape(b).rows !== size || matrixShape(b).columns !== 1 || desiredPoles.length !== size) throw new Error("极点数量必须等于系统阶数，且当前要求单输入系统");
    const controllability = controllabilityMatrix(a, b);
    if (matrixRank(controllability) !== size) throw new Error("系统不完全能控，无法任意配置极点");
    const desiredPolynomial = Solver.polynomialFromComplexRoots(desiredPoles, "期望极点");
    const phiA = matrixPolynomial(a, desiredPolynomial);
    const selector = [Array(size).fill(0)];
    selector[0][size - 1] = 1;
    const gain = matrixMultiply(matrixMultiply(selector, matrixInverse(controllability)), phiA);
    return { gain, desiredPolynomial, controllability };
  }

  function observerPlacement(a, c, desiredPoles) {
    const dual = polePlacement(matrixTranspose(a), matrixTranspose(c), desiredPoles);
    return { gain: matrixTranspose(dual.gain), desiredPolynomial: dual.desiredPolynomial, observability: matrixTranspose(dual.controllability) };
  }

  function lyapunovSolve(a, q) {
    const size = matrixShape(a).rows;
    if (matrixShape(a).columns !== size || matrixShape(q).rows !== size || matrixShape(q).columns !== size) throw new Error("Lyapunov方程要求A、Q为同阶方阵");
    const variables = size * size;
    const system = zeroMatrix(variables, variables);
    const right = Array(variables).fill(0);
    const indexOf = (row, column) => row * size + column;
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const equation = indexOf(row, column);
        right[equation] = -q[row][column];
        for (let index = 0; index < size; index += 1) {
          system[equation][indexOf(index, column)] += a[index][row];
          system[equation][indexOf(row, index)] += a[index][column];
        }
      }
    }
    const vector = solveLinearSystem(system, right);
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => vector[indexOf(row, column)]));
  }

  function polynomialDivide(numeratorInput, denominatorInput) {
    let remainder = Solver.normalizePolynomial(numeratorInput).slice();
    const denominator = Solver.normalizePolynomial(denominatorInput);
    if (remainder.length < denominator.length) return { quotient: [0], remainder };
    const quotient = Array(remainder.length - denominator.length + 1).fill(0);
    while (remainder.length >= denominator.length && !remainder.every((value) => Math.abs(value) <= EPSILON)) {
      const degreeDifference = remainder.length - denominator.length;
      const factor = remainder[0] / denominator[0];
      const quotientIndex = quotient.length - degreeDifference - 1;
      quotient[quotientIndex] = factor;
      const subtractor = denominator.map((value) => value * factor).concat(Array(degreeDifference).fill(0));
      remainder = Solver.normalizePolynomial(Solver.subtract(remainder, subtractor));
    }
    return { quotient: Solver.normalizePolynomial(quotient), remainder };
  }

  function complexAdd(left, right) {
    return { real: left.real + right.real, imaginary: left.imaginary + right.imaginary };
  }

  function complexSubtract(left, right) {
    return { real: left.real - right.real, imaginary: left.imaginary - right.imaginary };
  }

  function complexMultiply(left, right) {
    return {
      real: left.real * right.real - left.imaginary * right.imaginary,
      imaginary: left.real * right.imaginary + left.imaginary * right.real
    };
  }

  function complexDivide(left, right) {
    const magnitude = right.real * right.real + right.imaginary * right.imaginary;
    if (magnitude <= 1e-24) throw new Error("部分分式线性方程奇异，请检查分母多项式");
    return {
      real: (left.real * right.real + left.imaginary * right.imaginary) / magnitude,
      imaginary: (left.imaginary * right.real - left.real * right.imaginary) / magnitude
    };
  }

  function syntheticDivideComplex(coefficients, pole) {
    if (coefficients.length < 2) throw new Error("无法继续提取极点因子");
    const quotient = [coefficients[0]];
    for (let index = 1; index < coefficients.length - 1; index += 1) {
      quotient.push(complexAdd(coefficients[index], complexMultiply(quotient[index - 1], pole)));
    }
    return quotient;
  }

  function solveComplexLinearSystem(matrixInput, vectorInput) {
    const size = matrixInput.length;
    const matrix = matrixInput.map((row, index) => row.map((value) => ({ ...value })).concat({ ...vectorInput[index] }));
    for (let column = 0; column < size; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < size; row += 1) {
        if (Math.hypot(matrix[row][column].real, matrix[row][column].imaginary) > Math.hypot(matrix[pivot][column].real, matrix[pivot][column].imaginary)) pivot = row;
      }
      if (Math.hypot(matrix[pivot][column].real, matrix[pivot][column].imaginary) <= 1e-10) throw new Error("部分分式系数方程病态，请展开或约去公共因子后重试");
      [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
      const pivotValue = matrix[column][column];
      for (let entry = column; entry <= size; entry += 1) matrix[column][entry] = complexDivide(matrix[column][entry], pivotValue);
      for (let row = 0; row < size; row += 1) {
        if (row === column) continue;
        const factor = matrix[row][column];
        for (let entry = column; entry <= size; entry += 1) {
          matrix[row][entry] = complexSubtract(matrix[row][entry], complexMultiply(factor, matrix[column][entry]));
        }
      }
    }
    return matrix.map((row) => row[size]);
  }

  function clusterPolynomialRoots(roots) {
    const clusters = [];
    roots.forEach((root) => {
      const match = clusters.find((cluster) => {
        const scale = Math.max(1, Math.hypot(root.real, root.imaginary), Math.hypot(cluster.pole.real, cluster.pole.imaginary));
        return Math.hypot(root.real - cluster.pole.real, root.imaginary - cluster.pole.imaginary) <= 1e-4 * scale;
      });
      if (match) {
        match.roots.push(root);
        const count = match.roots.length;
        match.pole = {
          real: match.roots.reduce((sum, value) => sum + value.real, 0) / count,
          imaginary: match.roots.reduce((sum, value) => sum + value.imaginary, 0) / count
        };
      } else {
        clusters.push({ pole: { ...root }, roots: [root] });
      }
    });
    return clusters;
  }

  function partialFraction(numeratorInput, denominatorInput) {
    const denominator = Solver.normalizePolynomial(denominatorInput);
    const division = polynomialDivide(numeratorInput, denominator);
    if (denominator.length < 2) return { quotient: division.quotient, terms: [], residues: [] };
    const degree = denominator.length - 1;
    const clusters = clusterPolynomialRoots(Solver.complexPolynomialRoots(denominator));
    const bases = [];
    const descriptors = [];
    clusters.forEach((cluster) => {
      let quotient = denominator.map((value) => ({ real: value, imaginary: 0 }));
      for (let power = 1; power <= cluster.roots.length; power += 1) {
        quotient = syntheticDivideComplex(quotient, cluster.pole);
        bases.push(Array(power - 1).fill(null).map(() => ({ real: 0, imaginary: 0 })).concat(quotient));
        descriptors.push({ pole: cluster.pole, power, multiplicity: cluster.roots.length });
      }
    });
    const target = Array(degree - division.remainder.length).fill(0).concat(division.remainder)
      .map((value) => ({ real: value, imaginary: 0 }));
    const matrix = Array.from({ length: degree }, (_, row) => bases.map((basis) => basis[row] || { real: 0, imaginary: 0 }));
    const coefficients = solveComplexLinearSystem(matrix, target);
    const terms = descriptors.map((descriptor, index) => ({ ...descriptor, coefficient: coefficients[index] }));
    const residues = terms.filter((term) => term.power === 1).map((term) => ({ pole: term.pole, residue: term.coefficient }));
    return { quotient: division.quotient, terms, residues };
  }

  function partialFractionDistinct(numeratorInput, denominatorInput) {
    const result = partialFraction(numeratorInput, denominatorInput);
    if (result.terms.some((term) => term.multiplicity > 1)) throw new Error("分母含有重极点，请改用完整部分分式函数");
    return result;
  }

  function limitAtZero(numeratorInput, denominatorInput) {
    const numerator = Solver.normalizePolynomial(numeratorInput);
    const denominator = Solver.normalizePolynomial(denominatorInput);
    let numeratorZeros = 0;
    let denominatorZeros = 0;
    for (let index = numerator.length - 1; index >= 0 && Math.abs(numerator[index]) <= EPSILON; index -= 1) numeratorZeros += 1;
    for (let index = denominator.length - 1; index >= 0 && Math.abs(denominator[index]) <= EPSILON; index -= 1) denominatorZeros += 1;
    if (numeratorZeros > denominatorZeros) return 0;
    if (numeratorZeros < denominatorZeros) return Infinity;
    return numerator[numerator.length - 1 - numeratorZeros] / denominator[denominator.length - 1 - denominatorZeros];
  }

  function finalValueForPolynomialInput(transfer, inputOrder, amplitudeInput) {
    const order = Number(inputOrder);
    const amplitude = Number(amplitudeInput);
    if (![0, 1, 2].includes(order) || !Number.isFinite(amplitude)) throw new Error("终值计算仅支持有限幅值的阶跃、斜坡或抛物线输入");
    const denominator = Solver.multiply(transfer.denominator, [1].concat(Array(order).fill(0)));
    return amplitude * limitAtZero(transfer.numerator, denominator);
  }

  function parseSignalFlowEdges(rawValue) {
    const lines = String(rawValue).split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error("信号流图支路不能为空");
    if (lines.length > 24) throw new Error("当前工具最多支持24条支路");
    return lines.map((line, index) => {
      const parts = line.split(/[,，]/).map((part) => part.trim());
      if (parts.length < 3) throw new Error("第" + (index + 1) + "行格式应为：起点,终点,增益");
      const from = parts[0];
      const to = parts[1];
      const gainText = parts.slice(2).join(",");
      if (!from || !to || !gainText) throw new Error("第" + (index + 1) + "行缺少节点或增益");
      const parsed = Solver.parseRationalExpression(gainText);
      return { id: index, from, to, gainText, gain: rational(parsed.numerator, parsed.denominator) };
    });
  }

  function enumerateForwardPaths(edges, source, target) {
    const outgoing = new Map();
    edges.forEach((edge) => {
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      outgoing.get(edge.from).push(edge);
    });
    const paths = [];
    function visit(node, visitedNodes, usedEdges) {
      if (node === target) {
        paths.push({
          edges: usedEdges.slice(),
          nodes: new Set(visitedNodes),
          gain: usedEdges.reduce((value, edge) => rationalMultiply(value, edge.gain), rational([1], [1]))
        });
        return;
      }
      for (const edge of outgoing.get(node) || []) {
        if (!visitedNodes.has(edge.to)) {
          visitedNodes.add(edge.to);
          usedEdges.push(edge);
          visit(edge.to, visitedNodes, usedEdges);
          usedEdges.pop();
          visitedNodes.delete(edge.to);
        }
      }
    }
    visit(source, new Set([source]), []);
    return paths;
  }

  function canonicalCycleKey(edgeIds) {
    const rotations = edgeIds.map((_, index) => edgeIds.slice(index).concat(edgeIds.slice(0, index)).join("-"));
    return rotations.sort()[0];
  }

  function enumerateLoops(edges) {
    const outgoing = new Map();
    const nodes = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))];
    edges.forEach((edge) => {
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      outgoing.get(edge.from).push(edge);
    });
    const seen = new Set();
    const loops = [];
    for (const start of nodes) {
      function visit(node, visitedNodes, usedEdges) {
        for (const edge of outgoing.get(node) || []) {
          if (edge.to === start) {
            const cycleEdges = usedEdges.concat(edge);
            const key = canonicalCycleKey(cycleEdges.map((item) => item.id));
            if (!seen.has(key)) {
              seen.add(key);
              loops.push({
                edges: cycleEdges,
                nodes: new Set(cycleEdges.flatMap((item) => [item.from, item.to])),
                gain: cycleEdges.reduce((value, item) => rationalMultiply(value, item.gain), rational([1], [1]))
              });
            }
          } else if (!visitedNodes.has(edge.to) && usedEdges.length < nodes.length) {
            visitedNodes.add(edge.to);
            usedEdges.push(edge);
            visit(edge.to, visitedNodes, usedEdges);
            usedEdges.pop();
            visitedNodes.delete(edge.to);
          }
        }
      }
      visit(start, new Set([start]), []);
    }
    return loops;
  }

  function nonTouchingLoopGroups(loops) {
    const groups = [];
    function build(startIndex, chosen, occupiedNodes) {
      for (let index = startIndex; index < loops.length; index += 1) {
        const loop = loops[index];
        if ([...loop.nodes].some((node) => occupiedNodes.has(node))) continue;
        const nextChosen = chosen.concat(loop);
        const nextNodes = new Set(occupiedNodes);
        loop.nodes.forEach((node) => nextNodes.add(node));
        groups.push(nextChosen);
        build(index + 1, nextChosen, nextNodes);
      }
    }
    build(0, [], new Set());
    return groups;
  }

  function masonDeterminant(loops) {
    let determinant = rational([1], [1]);
    const groups = nonTouchingLoopGroups(loops);
    groups.forEach((group) => {
      const product = group.reduce((value, loop) => rationalMultiply(value, loop.gain), rational([1], [1]));
      determinant = group.length % 2 === 1
        ? rationalSubtract(determinant, product)
        : rationalAdd(determinant, product);
    });
    return { determinant, groups };
  }

  function masonGain(edgesInput, source, target) {
    const edges = Array.isArray(edgesInput) ? edgesInput : parseSignalFlowEdges(edgesInput);
    const paths = enumerateForwardPaths(edges, source, target);
    if (!paths.length) throw new Error("从输入节点到输出节点不存在前向通路");
    const loops = enumerateLoops(edges);
    if (loops.length > 14) throw new Error("独立回路过多，请简化信号流图后再计算");
    const overall = masonDeterminant(loops);
    let numerator = rational([0], [1]);
    const pathTerms = paths.map((path) => {
      const untouchedLoops = loops.filter((loop) => ![...loop.nodes].some((node) => path.nodes.has(node)));
      const delta = masonDeterminant(untouchedLoops).determinant;
      const term = rationalMultiply(path.gain, delta);
      numerator = rationalAdd(numerator, term);
      return { ...path, delta, term, untouchedLoops };
    });
    return {
      edges,
      paths: pathTerms,
      loops,
      nonTouchingGroups: overall.groups.filter((group) => group.length > 1),
      delta: overall.determinant,
      transfer: rationalDivide(numerator, overall.determinant)
    };
  }

  function juryStability(inputCoefficients) {
    let coefficients = Solver.normalizePolynomial(inputCoefficients);
    if (coefficients.length < 2) throw new Error("离散特征多项式至少需要一次项");
    if (coefficients[0] < 0) coefficients = coefficients.map((value) => -value);
    const degree = coefficients.length - 1;
    const pAtOne = Solver.evaluate(coefficients, 1);
    const pAtMinusOne = Solver.evaluate(coefficients, -1);
    const conditions = [
      { label: "F(1) > 0", value: pAtOne, passed: pAtOne > EPSILON },
      { label: "(-1)^n F(-1) > 0", value: Math.pow(-1, degree) * pAtMinusOne, passed: Math.pow(-1, degree) * pAtMinusOne > EPSILON }
    ];
    const rows = [];
    let current = coefficients.slice();
    let stable = conditions.every((condition) => condition.passed);
    while (current.length > 1) {
      const first = current[0];
      const last = current[current.length - 1];
      const reflection = last / first;
      const passed = Math.abs(last) < Math.abs(first) - EPSILON;
      rows.push({ coefficients: current.slice(), first, last, reflection, passed });
      if (!passed) {
        stable = false;
        break;
      }
      const reduced = [];
      for (let index = 0; index < current.length - 1; index += 1) {
        reduced.push(current[index] - reflection * current[current.length - 1 - index]);
      }
      const scale = reduced[0];
      current = reduced.map((value) => Math.abs(value / scale) < EPSILON ? 0 : value / scale);
    }
    return { coefficients, degree, pAtOne, pAtMinusOne, conditions, rows, stable };
  }

  function simulateDifferenceEquation(aInput, bInput, inputType, sampleCountInput) {
    const a = aInput.map(Number);
    const b = bInput.map(Number);
    const sampleCount = Math.max(2, Math.min(500, Number(sampleCountInput) || 30));
    if (!a.length || Math.abs(a[0]) <= EPSILON || !b.length || [...a, ...b].some((value) => !Number.isFinite(value))) throw new Error("差分方程系数格式不正确，且a0不能为零");
    const input = Array.from({ length: sampleCount }, (_, index) => {
      if (inputType === "impulse") return index === 0 ? 1 : 0;
      if (inputType === "ramp") return index;
      return 1;
    });
    const output = Array(sampleCount).fill(0);
    for (let sample = 0; sample < sampleCount; sample += 1) {
      let value = 0;
      for (let index = 0; index < b.length; index += 1) {
        if (sample - index >= 0) value += b[index] * input[sample - index];
      }
      for (let index = 1; index < a.length; index += 1) {
        if (sample - index >= 0) value -= a[index] * output[sample - index];
      }
      output[sample] = value / a[0];
    }
    return { a, b, inputType, input, output, sampleCount };
  }

  function discretizeStateSpace(a, b, sampleTimeInput) {
    const sampleTime = Number(sampleTimeInput);
    const shapeA = matrixShape(a);
    const shapeB = matrixShape(b);
    if (!(sampleTime > 0) || shapeA.rows !== shapeA.columns || shapeB.rows !== shapeA.rows) throw new Error("离散化要求T>0且A、B维数匹配");
    const ad = matrixExponential(a, sampleTime);
    let bd = zeroMatrix(shapeB.rows, shapeB.columns);
    let aPower = identityMatrix(shapeA.rows);
    let factorial = 1;
    let timePower = sampleTime;
    for (let order = 0; order < 80; order += 1) {
      if (order > 0) {
        aPower = matrixMultiply(aPower, a);
        factorial *= order + 1;
        timePower *= sampleTime;
      }
      const term = matrixScale(matrixMultiply(aPower, b), timePower / factorial);
      bd = matrixAdd(bd, term);
      if (matrixNormInfinity(term) < 1e-13) break;
    }
    return { ad, bd, sampleTime };
  }

  function describingFunction(type, parameters, amplitudeInput) {
    const amplitude = Number(amplitudeInput);
    if (!(amplitude > 0)) throw new Error("振幅A必须大于零");
    const gain = Number(parameters.gain == null ? 1 : parameters.gain);
    const width = Number(parameters.width == null ? 1 : parameters.width);
    if (!(gain > 0) || !(width >= 0)) throw new Error("非线性参数必须为有效正数");
    if (type === "relay") return { real: 4 * gain / (Math.PI * amplitude), imaginary: 0 };
    if (type === "hysteresis") {
      if (amplitude <= width) throw new Error("继电器滞环分析要求A大于滞环宽度h");
      const ratio = width / amplitude;
      return {
        real: 4 * gain / (Math.PI * amplitude) * Math.sqrt(1 - ratio * ratio),
        imaginary: -4 * gain * width / (Math.PI * amplitude * amplitude)
      };
    }
    if (type === "saturation") {
      if (amplitude <= width) return { real: gain, imaginary: 0 };
      const ratio = width / amplitude;
      return { real: 2 * gain / Math.PI * (Math.asin(ratio) + ratio * Math.sqrt(1 - ratio * ratio)), imaginary: 0 };
    }
    if (type === "deadzone") {
      if (amplitude <= width) return { real: 0, imaginary: 0 };
      const ratio = width / amplitude;
      return { real: gain * (1 - 2 / Math.PI * (Math.asin(ratio) + ratio * Math.sqrt(1 - ratio * ratio))), imaginary: 0 };
    }
    throw new Error("未知的非线性类型");
  }

  function frequencyResponse(numerator, denominator, frequency) {
    const s = { real: 0, imaginary: frequency };
    const n = Solver.evaluateComplexPolynomial(numerator, s);
    const d = Solver.evaluateComplexPolynomial(denominator, s);
    const magnitudeSquared = d.real * d.real + d.imaginary * d.imaginary;
    return {
      real: (n.real * d.real + n.imaginary * d.imaginary) / magnitudeSquared,
      imaginary: (n.imaginary * d.real - n.real * d.imaginary) / magnitudeSquared
    };
  }

  function findLimitCycle(numerator, denominator, type, parameters, ranges) {
    const amplitudeMin = Number(ranges.amplitudeMin);
    const amplitudeMax = Number(ranges.amplitudeMax);
    const frequencyMin = Number(ranges.frequencyMin);
    const frequencyMax = Number(ranges.frequencyMax);
    if (!(amplitudeMin > 0 && amplitudeMax > amplitudeMin && frequencyMin > 0 && frequencyMax > frequencyMin)) throw new Error("搜索范围必须满足最小值>0且最大值>最小值");
    let best = null;
    const evaluateResidual = (amplitude, frequency) => {
      let n;
      try {
        n = describingFunction(type, parameters, amplitude);
      } catch (_) {
        return Infinity;
      }
      const g = frequencyResponse(numerator, denominator, frequency);
      const productReal = g.real * n.real - g.imaginary * n.imaginary;
      const productImaginary = g.real * n.imaginary + g.imaginary * n.real;
      return Math.hypot(1 + productReal, productImaginary);
    };
    const grid = 90;
    for (let aIndex = 0; aIndex < grid; aIndex += 1) {
      const amplitude = amplitudeMin * Math.pow(amplitudeMax / amplitudeMin, aIndex / (grid - 1));
      for (let wIndex = 0; wIndex < grid; wIndex += 1) {
        const frequency = frequencyMin * Math.pow(frequencyMax / frequencyMin, wIndex / (grid - 1));
        const residual = evaluateResidual(amplitude, frequency);
        if (!best || residual < best.residual) best = { amplitude, frequency, residual };
      }
    }
    let stepA = Math.log(amplitudeMax / amplitudeMin) / grid;
    let stepW = Math.log(frequencyMax / frequencyMin) / grid;
    let logA = Math.log(best.amplitude);
    let logW = Math.log(best.frequency);
    for (let iteration = 0; iteration < 50; iteration += 1) {
      let improved = false;
      for (const da of [-stepA, 0, stepA]) {
        for (const dw of [-stepW, 0, stepW]) {
          const amplitude = Math.exp(logA + da);
          const frequency = Math.exp(logW + dw);
          if (amplitude < amplitudeMin || amplitude > amplitudeMax || frequency < frequencyMin || frequency > frequencyMax) continue;
          const residual = evaluateResidual(amplitude, frequency);
          if (residual < best.residual) {
            best = { amplitude, frequency, residual };
            logA += da;
            logW += dw;
            improved = true;
          }
        }
      }
      if (!improved) {
        stepA *= 0.6;
        stepW *= 0.6;
      }
    }
    return { ...best, describingFunction: describingFunction(type, parameters, best.amplitude), converged: best.residual < 0.02 };
  }

  return {
    rational,
    rationalAdd,
    rationalSubtract,
    rationalMultiply,
    rationalDivide,
    rationalNegate,
    parseMatrix,
    matrixShape,
    zeroMatrix,
    identityMatrix,
    matrixAdd,
    matrixScale,
    matrixMultiply,
    matrixTranspose,
    matrixRank,
    matrixInverse,
    solveLinearSystem,
    matrixPower,
    matrixExponential,
    characteristicPolynomial,
    matrixPolynomial,
    controllabilityMatrix,
    observabilityMatrix,
    transferToControllableCanonical,
    stateSpaceToTransfer,
    polePlacement,
    observerPlacement,
    lyapunovSolve,
    polynomialDivide,
    partialFraction,
    partialFractionDistinct,
    limitAtZero,
    finalValueForPolynomialInput,
    parseSignalFlowEdges,
    enumerateForwardPaths,
    enumerateLoops,
    masonGain,
    juryStability,
    simulateDifferenceEquation,
    discretizeStateSpace,
    describingFunction,
    findLimitCycle
  };
});
