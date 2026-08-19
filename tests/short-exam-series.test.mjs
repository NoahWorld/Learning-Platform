import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { archiveLongExams, LONG_EXAM_IDS } from "../server/archive-long-exams.mjs";
import { contentSchema } from "../server/content-schema.mjs";
import { openDatabase } from "../server/db.mjs";
import { importContent } from "../server/import-content.mjs";

const electronicPack = JSON.parse(
  await readFile(
    new URL("../data/hr-electronic-study-pack-questions-2026.json", import.meta.url),
    "utf8",
  ),
);
const masterCollection = JSON.parse(
  await readFile(new URL("../data/hr-600-master-collection.json", import.meta.url), "utf8"),
);
const shortSeries = JSON.parse(
  await readFile(new URL("../data/hr-short-exam-series-2026.json", import.meta.url), "utf8"),
);

const expectedSeries = {
  "hr-truth-series-2026": { papers: [25, 25, 25, 25], questions: 100 },
  "hr-knowledge-series-2026": { papers: [29, 29, 29, 28, 28, 28, 28], questions: 199 },
  "hr-classic-master-series-2026": { papers: [29, 29, 29, 29, 28, 28, 28], questions: 200 },
  "hr-master-collection-series-2026": { papers: [26, 26, 26, 26, 25, 25], questions: 154 },
};

test("long question banks are split into complete 25-minute short-exam series", () => {
  const parsed = contentSchema.parse(shortSeries);
  const grouped = Object.groupBy(parsed.exams, (exam) => exam.seriesId);

  assert.equal(parsed.exams.length, 24);
  assert.equal(parsed.exams.flatMap((exam) => exam.questions).length, 653);

  for (const [seriesId, expected] of Object.entries(expectedSeries)) {
    const exams = grouped[seriesId];
    assert.ok(exams, `${seriesId} should exist`);
    assert.deepEqual(exams.map((exam) => exam.questions.length), expected.papers);
    assert.equal(exams.reduce((total, exam) => total + exam.questions.length, 0), expected.questions);
    assert.ok(exams.every((exam) => exam.durationMinutes === 25));
    assert.ok(exams.every((exam) => exam.questions.length <= 30));
  }

  const sourceQuestionIds = new Set(
    [...electronicPack.exams, ...masterCollection.exams]
      .flatMap((exam) => exam.questions)
      .map((question) => question.id),
  );
  const generatedSourceIds = parsed.exams
    .flatMap((exam) => exam.questions)
    .map((question) => question.id.replace(/__s\d{2}$/, ""));

  assert.equal(new Set(generatedSourceIds).size, sourceQuestionIds.size);
  assert.deepEqual(new Set(generatedSourceIds), sourceQuestionIds);
});

test("archiving long exams is gated by complete short series and preserves attempts", () => {
  const db = openDatabase(":memory:");
  try {
    importContent(db, electronicPack);
    importContent(db, masterCollection);
    importContent(db, shortSeries);

    db.prepare(
      `INSERT INTO attempts (
         id, device_id, user_id, exam_id, score, correct_count, wrong_count,
         total_questions, duration_seconds, started_at, submitted_at
       ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "historical-long-attempt",
      "legacy-test-device",
      LONG_EXAM_IDS[0],
      80,
      80,
      20,
      100,
      1200,
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:20:00.000Z",
    );

    const result = archiveLongExams(db);
    assert.equal(result.archived, 4);
    assert.equal(result.preservedAttempts, 1);
    assert.equal(result.series.length, 4);
    assert.equal(result.series.reduce((total, series) => total + series.papers, 0), 24);
    assert.equal(result.series.reduce((total, series) => total + series.questions, 0), 653);

    const placeholders = LONG_EXAM_IDS.map(() => "?").join(", ");
    assert.equal(
      db
        .prepare(`SELECT COUNT(*) AS count FROM exams WHERE id IN (${placeholders}) AND status = 'draft'`)
        .get(...LONG_EXAM_IDS).count,
      4,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM attempts WHERE id = ?").get(
        "historical-long-attempt",
      ).count,
      1,
    );
  } finally {
    db.close();
  }
});
