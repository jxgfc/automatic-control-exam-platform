"use strict";

const assert = require("node:assert/strict");
const katex = require("./vendor/katex/node_modules/katex/dist/katex.js");

require("./question-bank-data.js");
require("./theory-data.js");
require("./knowledge-tree-data.js");

const collections = [
  ["练习题", globalThis.ControlPracticeQuestions],
  ["理论题", globalThis.ControlTheoryQuestions]
];

let formulaCount = 0;

function renderExpressions(content, context) {
  const expressions = [];
  const text = String(content || "");
  const pattern = /\$\$([\s\S]*?)\$\$|\$(?!\$)([^$\r\n]+)\$/g;
  let match;
  while ((match = pattern.exec(text)) !== null) expressions.push(match[1] || match[2]);
  expressions.forEach((expression) => {
    assert.doesNotThrow(
      () => katex.renderToString(expression, { throwOnError: true, strict: false }),
      context + "公式无效：" + expression
    );
    formulaCount += 1;
  });
}

for (const [collectionName, questions] of collections) {
  assert.ok(Array.isArray(questions) && questions.length > 0, collectionName + "未加载");
  questions.forEach((question, questionIndex) => {
    ["question", "answer", "analysis"].forEach((field) => {
      const content = String(question[field] || "");
      renderExpressions(content, collectionName + "第 " + (questionIndex + 1) + " 题的 " + field);
    });
  });
}

const chapters = globalThis.ControlKnowledgeTree && globalThis.ControlKnowledgeTree.chapters;
assert.ok(Array.isArray(chapters) && chapters.length > 0, "知识树未加载");
let knowledgeNodeCount = 0;
chapters.forEach((chapter) => {
  (chapter.nodes || []).forEach((node) => {
    knowledgeNodeCount += 1;
    (node.formulas || []).forEach((formula, formulaIndex) => {
      assert.ok(formula && typeof formula.latex === "string" && formula.latex.length > 0, "知识树公式缺少 latex：" + node.id);
      assert.doesNotThrow(
        () => katex.renderToString(formula.latex, { throwOnError: true, strict: false }),
        "知识树 " + node.id + " 第 " + (formulaIndex + 1) + " 个公式无效：" + formula.latex
      );
      formulaCount += 1;
      renderExpressions(formula.note || "", "知识树 " + node.id + " 公式说明");
    });
    const examples = [node.example, ...(node.examples || [])].filter(Boolean);
    examples.forEach((example, exampleIndex) => {
      ["title", "problem", "answer"].forEach((field) => renderExpressions(example[field] || "", "知识树 " + node.id + " 例题" + (exampleIndex + 1) + " " + field));
      (example.steps || []).forEach((step, stepIndex) => renderExpressions(step, "知识树 " + node.id + " 例题" + (exampleIndex + 1) + " 步骤" + (stepIndex + 1)));
    });
  });
});
assert.equal(knowledgeNodeCount, 37, "知识树节点数量应保持37");
assert.ok(formulaCount >= 180, "题库与知识树中的标准公式数量不足");
console.log("Formula rendering tests passed (" + formulaCount + " expressions; " + knowledgeNodeCount + " knowledge nodes)");
