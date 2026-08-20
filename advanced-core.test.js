"use strict";

const assert = require("node:assert/strict");
const Advanced = require("./advanced-core.js");

function closeTo(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function matrixClose(actual, expected, tolerance = 1e-7) {
  assert.equal(actual.length, expected.length);
  actual.forEach((row, i) => row.forEach((value, j) => closeTo(value, expected[i][j], tolerance)));
}

assert.deepEqual(Advanced.parseMatrix("1,2; 3,4"), [[1, 2], [3, 4]]);
matrixClose(Advanced.matrixInverse([[1, 2], [3, 4]]), [[-2, 1], [1.5, -0.5]]);
assert.equal(Advanced.matrixRank([[1, 2], [2, 4]]), 1);
assert.deepEqual(Advanced.characteristicPolynomial([[0, 1], [-2, -3]]), [1, 3, 2]);

{
  const exponential = Advanced.matrixExponential([[0, 1], [-1, 0]], Math.PI / 2);
  matrixClose(exponential, [[0, 1], [-1, 0]], 1e-7);
}

{
  const model = Advanced.transferToControllableCanonical([1], [1, 3, 2]);
  const transfer = Advanced.stateSpaceToTransfer(model.a, model.b, model.c, model.d);
  assert.deepEqual(transfer.numerator, [1]);
  assert.deepEqual(transfer.denominator, [1, 3, 2]);
  assert.equal(Advanced.matrixRank(Advanced.controllabilityMatrix(model.a, model.b)), 2);
  assert.equal(Advanced.matrixRank(Advanced.observabilityMatrix(model.a, model.c)), 2);
}

{
  const placement = Advanced.polePlacement(
    [[0, 1], [0, 0]],
    [[0], [1]],
    [{ real: -2, imaginary: 0 }, { real: -3, imaginary: 0 }]
  );
  matrixClose(placement.gain, [[6, 5]]);
}

{
  const p = Advanced.lyapunovSolve([[-1, 0], [0, -2]], [[1, 0], [0, 1]]);
  matrixClose(p, [[0.5, 0], [0, 0.25]]);
}

{
  const decomposition = Advanced.partialFractionDistinct([1], [1, 3, 2]);
  assert.equal(decomposition.residues.length, 2);
  const sorted = decomposition.residues.sort((a, b) => a.pole.real - b.pole.real);
  closeTo(sorted[0].pole.real, -2);
  closeTo(sorted[0].residue.real, -1);
  closeTo(sorted[1].pole.real, -1);
  closeTo(sorted[1].residue.real, 1);
}

{
  const decomposition = Advanced.partialFraction([1], [1, 3, 3, 1]);
  assert.equal(decomposition.terms.length, 3);
  const cubicTerm = decomposition.terms.find((term) => term.power === 3);
  closeTo(cubicTerm.pole.real, -1, 1e-4);
  closeTo(cubicTerm.coefficient.real, 1, 1e-6);
  decomposition.terms.filter((term) => term.power < 3).forEach((term) => closeTo(term.coefficient.real, 0, 1e-6));
}

{
  closeTo(Advanced.limitAtZero([1, 0], [1]), 0);
  assert.equal(Advanced.limitAtZero([1], [1, 0]), Infinity);
  const errorTransfer = Advanced.rational([-1], [1, 1]);
  closeTo(Advanced.finalValueForPolynomialInput(errorTransfer, 0, 2), -2);
}

{
  const result = Advanced.masonGain(
    "R,A,1\nA,Y,1/(s+1)\nY,A,-2",
    "R",
    "Y"
  );
  assert.equal(result.paths.length, 1);
  assert.equal(result.loops.length, 1);
  assert.deepEqual(result.transfer.numerator, [1]);
  assert.deepEqual(result.transfer.denominator, [1, 3]);
}

{
  const stable = Advanced.juryStability([1, -0.7, 0.1]);
  assert.equal(stable.stable, true);
  const unstable = Advanced.juryStability([1, -1.2]);
  assert.equal(unstable.stable, false);
}

{
  const response = Advanced.simulateDifferenceEquation([1, -0.5], [1], "step", 5);
  [1, 1.5, 1.75, 1.875, 1.9375].forEach((expected, index) => closeTo(response.output[index], expected));
}

{
  const discrete = Advanced.discretizeStateSpace([[0]], [[1]], 0.2);
  matrixClose(discrete.ad, [[1]]);
  matrixClose(discrete.bd, [[0.2]]);
}

{
  const relay = Advanced.describingFunction("relay", { gain: 1 }, 2);
  closeTo(relay.real, 2 / Math.PI);
  const cycle = Advanced.findLimitCycle(
    [1],
    [1, 3, 2, 0],
    "relay",
    { gain: 1 },
    { amplitudeMin: 0.05, amplitudeMax: 2, frequencyMin: 0.1, frequencyMax: 10 }
  );
  closeTo(cycle.frequency, Math.sqrt(2), 2e-3);
  closeTo(cycle.amplitude, 2 / (3 * Math.PI), 2e-3);
  assert.equal(cycle.converged, true);
}

console.log("advanced core tests passed");
