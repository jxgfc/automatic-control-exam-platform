"use strict";

const assert = require("node:assert/strict");
const katex = require("./vendor/katex/node_modules/katex/dist/katex.js");

require("./question-bank-data.js");
require("./theory-data.js");

const collections = [
  ["练习题", globalThis.ControlPracticeQuestions],
  ["理论题", globalThis.ControlTheoryQuestions]
];

let formulaCount = 0;

for (const [collectionName, questions] of collections) {
  assert.ok(Array.isArray(questions) && questions.length > 0, collectionName + "未加载");
  questions.forEach((question, questionIndex) => {
    ["question", "answer", "analysis"].forEach((field) => {
      const content = String(question[field] || "");
      const expressions = [...content.matchAll(/\$([^$]+)\$/g)].map((match) => match[1]);
      expressions.forEach((expression) => {
        assert.doesNotThrow(
          () => katex.renderToString(expression, { throwOnError: true, strict: false }),
          collectionName + "第 " + (questionIndex + 1) + " 题的 " + field + " 公式无效：" + expression
        );
        formulaCount += 1;
      });
    });
  });
}

assert.ok(formulaCount >= 100, "题库中的标准公式数量不足");
console.log("Formula rendering tests passed (" + formulaCount + " expressions)");
