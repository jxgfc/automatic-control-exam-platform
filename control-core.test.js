"use strict";

const assert = require("node:assert/strict");
const Core = require("./control-core.js");

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

{
  const coefficients = Core.parsePolynomial("s^4+2s^3+3s^2+4s+5");
  assert.deepEqual(coefficients, [1, 2, 3, 4, 5]);
  const result = Core.buildRouthTable(coefficients);
  assert.equal(result.degree, 4);
  assert.equal(result.signChanges, 2);
}

{
  const stable = Core.buildRouthTable([1, 6, 11, 6]);
  assert.equal(stable.stable, true);
  assert.equal(stable.rightHalfPlanePoles, 0);
}

{
  const zeroRow = Core.buildRouthTable([1, 0, 2, 0, 1]);
  assert.ok(zeroRow.events.some((event) => event.type === "zero-row"));
  assert.equal(zeroRow.stable, false);
}

{
  const zeroFirst = Core.buildRouthTable([1, 0, 2, 1]);
  assert.ok(zeroFirst.events.some((event) => event.type === "zero-first-column"));
}

{
  const typeOne = Core.staticErrorAnalysis([10], [1, 2, 0], 1, 1);
  assert.equal(typeOne.systemType, 1);
  assert.equal(typeOne.constants.kp, Infinity);
  closeTo(typeOne.constants.kv, 5);
  closeTo(typeOne.steadyStateError, 0.2);
}

{
  const typeZero = Core.staticErrorAnalysis([10], [1, 2], 0, 1);
  assert.equal(typeZero.systemType, 0);
  closeTo(typeZero.constants.kp, 5);
  closeTo(typeZero.steadyStateError, 1 / 6);
}

{
  const metrics = Core.secondOrderMetrics(0.5, 4);
  assert.equal(metrics.category, "欠阻尼");
  closeTo(metrics.dampedFrequency, 2 * Math.sqrt(3));
  closeTo(metrics.overshootPercent, 16.30335348);
  closeTo(metrics.peakTime, Math.PI / (2 * Math.sqrt(3)));
  closeTo(metrics.settlingTime2, 2);
  closeTo(Core.secondOrderStepValue(metrics, 0), 0);
}

{
  const metrics = Core.firstOrderMetrics(2, 0.5);
  closeTo(metrics.pole, -2);
  closeTo(metrics.settlingTime2, -Math.log(0.02) * 0.5);
  closeTo(metrics.valueAtTime(0), 0);
}

{
  const analysis = Core.higherOrderAnalysis([1], [1, 3, 7, 5]);
  assert.equal(analysis.stable, true);
  assert.equal(analysis.dominantPoles.length, 2);
  assert.equal(analysis.equivalent.order, 2);
}

{
  const bode = Core.bodeAnalysis([1], [1, 1, 0], 0.001, 1000, 500);
  closeTo(bode.gainCrossover, 0.786151, 2e-4);
  closeTo(bode.phaseMargin, 51.8273, 2e-3);
  assert.equal(bode.phaseCrossover, null);
  assert.equal(bode.gainMarginDb, Infinity);
}

{
  const bode = Core.bodeAnalysis([10], [1, 3, 2, 0], 0.001, 1000, 500);
  assert.ok(bode.gainCrossover > 0);
  assert.ok(bode.phaseCrossover > 0);
  assert.ok(Number.isFinite(bode.gainMarginDb));
}

{
  const nyquist = Core.nyquistAnalysis([1], [1, 1], 0.001, 1000, 400);
  assert.equal(nyquist.closedLoopStable, true);
  assert.equal(nyquist.openLoopRightHalfPlanePoles, 0);
  assert.equal(nyquist.clockwiseEncirclements, 0);
  assert.ok(nyquist.bandwidth > 0);
}

{
  const lead = Core.leadCompensatorDesign([1], [1, 1, 0], 65, 5);
  assert.ok(lead.alpha > 0 && lead.alpha < 1);
  assert.ok(lead.compensated.phaseMargin > lead.original.phaseMargin);
  const pid = Core.zieglerNicholsPid(10, 2, "PID");
  closeTo(pid.kp, 6);
  closeTo(pid.ki, 6);
  closeTo(pid.kd, 1.5);
}

console.log("control core tests passed");
