import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { contentSchema } from "../server/content-schema.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL("../data/hr-electronic-study-pack-questions-2026.json", import.meta.url),
    "utf8",
  ),
);

test("2026 electronic study pack remains schema-valid and complete", () => {
  const parsed = contentSchema.parse(fixture);
  const counts = Object.fromEntries(
    parsed.exams.map((exam) => [exam.id, exam.questions.length]),
  );

  assert.deepEqual(counts, {
    "hr-truth-100-2026-v1": 100,
    "hr-knowledge-practice-199-2026-v1": 199,
    "hr-master-200-2026-v1": 200,
  });
  assert.equal(parsed.exams.flatMap((exam) => exam.questions).length, 499);
  assert.deepEqual(parsed.materials, []);
  assert.deepEqual(parsed.assets, []);
});

test("source-specific repairs and missing explanations stay explicit", () => {
  const questions = new Map(
    fixture.exams.flatMap((exam) =>
      exam.questions.map((question) => [question.id, question]),
    ),
  );

  for (const number of [85, 86, 87, 88]) {
    assert.match(
      questions.get(`hrtruth100v1-q${String(number).padStart(3, "0")}`).passage,
      /原 PDF 缺失表格的可核对摘要/,
    );
  }

  for (const number of [34, 74]) {
    assert.equal(
      questions.get(`hrmaster200v1-q${String(number).padStart(3, "0")}`).explanation,
      "原始资料未提供文字解析。",
    );
  }

  assert.notEqual(
    questions.get("hrmaster200v1-q064").explanation,
    "原始资料未提供文字解析。",
  );
});
