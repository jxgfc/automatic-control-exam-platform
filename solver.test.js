"use strict";

const assert = require("node:assert/strict");
const Solver = require("./solver.js");

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

{
  const result = Solver.solveBreakPoints([1], [1, 6, 8, 0]);
  assert.equal(result.validPoints.length, 1);
  assert.equal(result.validPoints[0].kind, "breakaway");
  closeTo(result.validPoints[0].coordinate, (-6 + 2 * Math.sqrt(3)) / 3);
  closeTo(result.validPoints[0].gain, 3.0792014357);
  assert.equal(result.candidates.length, 2);
}

{
  const numerator = Solver.polynomialFromRoots([-1]);
  const denominator = Solver.polynomialFromRoots([0, -2, -4]);
  const result = Solver.solveBreakPoints(numerator, denominator);
  assert.ok(result.candidates.length >= 1);
  for (const point of result.validPoints) {
    assert.ok(point.gain > 0);
    closeTo(
      Solver.evaluate(denominator, point.coordinate) + point.gain * Solver.evaluate(numerator, point.coordinate),
      0,
      1e-5
    );
  }
}

{
  const roots = Solver.realRoots([1, 0, -5, 0, 4]);
  assert.equal(roots.length, 4);
  [-2, -1, 1, 2].forEach((expected, index) => closeTo(roots[index], expected));
}

{
  const repeatedRoots = Solver.realRoots([1, 4, 6, 4, 1]);
  assert.equal(repeatedRoots.length, 1);
  closeTo(repeatedRoots[0], -1);
}

{
  const rootsWithOrigin = Solver.realRoots([1, 6, 8, 0]);
  closeTo(rootsWithOrigin[rootsWithOrigin.length - 1], 0, 1e-10);
}

{
  const transfer = Solver.transferFunctionFromExpressions("s+1", "s(s+2)(s+4)");
  assert.deepEqual(transfer.numerator, [1, 1]);
  assert.deepEqual(transfer.denominator, [1, 6, 8, 0]);
  const result = Solver.solveBreakPoints(transfer.numerator, transfer.denominator);
  assert.equal(result.validPoints.length, 1);
}

{
  const transfer = Solver.transferFunctionFromExpressions("2s(s+3)", "(s+1)^3");
  assert.deepEqual(transfer.numerator, [2, 6, 0]);
  assert.deepEqual(transfer.denominator, [1, 3, 3, 1]);
}

{
  const transfer = Solver.transferFunctionFromExpressions("(s+1)/2", "s(s+2)");
  assert.deepEqual(transfer.numerator, [1, 1]);
  assert.deepEqual(transfer.denominator, [2, 4, 0]);
}

assert.throws(
  () => Solver.transferFunctionFromExpressions("1", "s(s+2"),
  /括号|格式/
);

{
  const roots = Solver.parseComplexList("0, -4, -1+2j, -1-2j");
  assert.deepEqual(roots[2], { real: -1, imaginary: 2 });
  assert.deepEqual(roots[3], { real: -1, imaginary: -2 });
  const denominator = Solver.polynomialFromComplexRoots(roots);
  assert.deepEqual(denominator, [1, 6, 13, 20, 0]);
  const result = Solver.solveBreakPoints([1], denominator);
  assert.equal(result.validPoints.length, 1);
  closeTo(result.validPoints[0].coordinate, -2.8260051791);
  closeTo(result.validPoints[0].gain, 24.3331035081);
}

{
  const transfer = Solver.transferFunctionFromExpressions(
    "1",
    "s(s+4)(s+1-2j)(s+1+2j)"
  );
  assert.deepEqual(transfer.numerator, [1]);
  assert.deepEqual(transfer.denominator, [1, 6, 13, 20, 0]);
}

assert.throws(
  () => Solver.transferFunctionFromExpressions("1", "s(s+1+2j)"),
  /共轭复数/
);

assert.throws(
  () => Solver.polynomialFromComplexRoots(Solver.parseComplexList("-1+2j")),
  /共轭复数/
);

{
  const roots = Solver.complexPolynomialRoots([1, 6, 11, 6]);
  assert.equal(roots.length, 3);
  [-3, -2, -1].forEach((expected, index) => {
    closeTo(roots[index].real, expected, 1e-7);
    closeTo(roots[index].imaginary, 0, 1e-7);
  });
}

{
  const roots = Solver.complexPolynomialRoots([1, 2, 5]);
  assert.equal(roots.length, 2);
  closeTo(roots[0].real, -1, 1e-7);
  closeTo(Math.abs(roots[0].imaginary), 2, 1e-7);
  closeTo(roots[1].real, -1, 1e-7);
  closeTo(Math.abs(roots[1].imaginary), 2, 1e-7);
}

{
  const geometry = Solver.rootLocusGeometry([1], [1, 6, 8, 0]);
  assert.equal(geometry.asymptoteCount, 3);
  closeTo(geometry.centroid, -2);
  assert.deepEqual(geometry.asymptoteAngles, [60, 180, 300]);
  const locus = Solver.rootLocusBranches([1], [1, 6, 8, 0], 100, 50);
  assert.equal(locus.branches.length, 3);
  assert.equal(locus.branches[0].length, 50);
  locus.branches.forEach((branch) => {
    const point = branch[branch.length - 1];
    const polynomial = Solver.closedLoopPolynomial([1], [1, 6, 8, 0], point.gain);
    const residual = Solver.evaluateComplexPolynomial(polynomial, point);
    assert.ok(Math.hypot(residual.real, residual.imaginary) < 1e-5);
  });
}

console.log("solver tests passed");
