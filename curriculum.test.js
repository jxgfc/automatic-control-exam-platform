"use strict";

const assert = require("node:assert/strict");
const Advanced = require("./advanced-core.js");

require("./question-bank-data.js");
require("./knowledge-tree-data.js");
require("./syllabus-data.js");

function closeTo(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, String(actual) + " != " + String(expected));
}

function matrixClose(actual, expected, tolerance = 1e-7) {
  assert.deepEqual(actual.map((row) => row.length), expected.map((row) => row.length));
  actual.forEach((row, i) => row.forEach((value, j) => closeTo(value, expected[i][j], tolerance)));
}

const modernQuestions = globalThis.ControlPracticeQuestions.filter((item) => /^P0(3[1-9]|40)$/.test(item.id));
assert.equal(modernQuestions.length, 10);
assert.equal(new Set(modernQuestions.map((item) => item.id)).size, 10);
const knowledgeIds = new Set(globalThis.ControlKnowledgeTree.chapters.flatMap((chapter) => chapter.nodes).map((node) => node.id));
modernQuestions.forEach((item) => assert.ok(knowledgeIds.has(item.knowledgeId), item.id + " 缺少有效 knowledgeId"));
assert.equal(globalThis.ControlSyllabus.length, 37);
const poleCoverage = globalThis.ControlSyllabus.find((item) => item.topic.indexOf("极点分布") >= 0);
assert.ok(poleCoverage && poleCoverage.coverage && poleCoverage.coverage["828"] && poleCoverage.coverage["861"]);

{
  const e = Advanced.matrixExponential([[1, 1], [0, 1]], 2);
  const scale = Math.exp(2);
  matrixClose(e, [[scale, 2 * scale], [0, scale]], 1e-7);
}

{
  const model = Advanced.transferToControllableCanonical([1, 3], [1, 4, 5]);
  matrixClose(model.a, [[0, 1], [-5, -4]]);
  matrixClose(model.b, [[0], [1]]);
  matrixClose(model.c, [[3, 1]]);
  matrixClose(model.d, [[0]]);
  const transfer = Advanced.stateSpaceToTransfer(model.a, model.b, model.c, model.d);
  assert.deepEqual(transfer.numerator, [1, 3]);
  assert.deepEqual(transfer.denominator, [1, 4, 5]);
}

{
  const transfer = Advanced.stateSpaceToTransfer([[-1, 0], [0, -2]], [[1], [1]], [[1, -1]], [[0]]);
  assert.deepEqual(transfer.numerator, [1]);
  assert.deepEqual(transfer.denominator, [1, 3, 2]);
}

{
  const observability = Advanced.observabilityMatrix([[1, 0], [0, -2]], [[1, 0]]);
  assert.equal(Advanced.matrixRank(observability), 1);
}

{
  const a = [[0, 1], [-2, -3]];
  const b = [[0], [1]];
  const c = [[1, 0]];
  const ab = Advanced.matrixMultiply(a, b);
  const stateControllability = Advanced.controllabilityMatrix(a, b);
  assert.equal(Advanced.matrixRank(stateControllability), 2);
  const outputControllability = [[0, 0, 1]];
  assert.equal(Advanced.matrixRank(outputControllability), 1);
  assert.equal(c[0][0] * ab[0][0] + c[0][1] * ab[1][0], 1);
}

{
  const a = [[0, 1], [-2, -3]];
  const b = [[0], [1]];
  const c = [[1, 0]];
  const acl = [
    [a[0][0] - b[0][0] * 2 * c[0][0], a[0][1] - b[0][0] * 2 * c[0][1]],
    [a[1][0] - b[1][0] * 2 * c[0][0], a[1][1] - b[1][0] * 2 * c[0][1]]
  ];
  assert.deepEqual(Advanced.characteristicPolynomial(acl), [1, 3, 4]);
  assert.notDeepEqual(Advanced.characteristicPolynomial(acl), [1, 5, 4]);
}

{
  const observer = Advanced.observerPlacement(
    [[0, 1], [-2, -3]],
    [[1, 0]],
    [{ real: -5, imaginary: 0 }, { real: -6, imaginary: 0 }]
  );
  matrixClose(observer.gain, [[8], [4]], 1e-6);
}

{
  const p = Advanced.lyapunovSolve([[-1, 1], [0, -2]], [[1, 0], [0, 1]]);
  matrixClose(p, [[0.5, 1 / 6], [1 / 6, 1 / 3]], 1e-7);
  closeTo(p[0][0] * p[1][1] - p[0][1] * p[1][0], 5 / 36);
}

{
  const expected = [1, 16, 91, 216, 180];
  const first = [1, 5, 6];
  const second = [1, 11, 30];
  const result = Array(expected.length).fill(0);
  first.forEach((a, i) => second.forEach((b, j) => { result[i + j] += a * b; }));
  assert.deepEqual(result, expected);
}

{
  const transfer = Advanced.stateSpaceToTransfer([[-1, 0], [0, -2]], [[1], [0]], [[1, 0]], [[0]]);
  assert.deepEqual(transfer.numerator, [1, 2]);
  assert.deepEqual(transfer.denominator, [1, 3, 2]);
}

console.log("Curriculum calculation tests passed (P031-P040)");
