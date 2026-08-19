import { pathToFileURL } from "node:url";
import { openDatabase } from "./db.mjs";

export const SHORT_EXAM_SERIES = [
  { id: "hr-truth-series-2026", expectedPapers: 4 },
  { id: "hr-knowledge-series-2026", expectedPapers: 7 },
  { id: "hr-classic-master-series-2026", expectedPapers: 7 },
  { id: "hr-master-collection-series-2026", expectedPapers: 6 },
];

export const LONG_EXAM_IDS = [
  "hr-truth-100-2026-v1",
  "hr-knowledge-practice-199-2026-v1",
  "hr-master-200-2026-v1",
  "hr-600-master-collection-v1",
];

export function archiveLongExams(db) {
  const seriesSummary = SHORT_EXAM_SERIES.map((series) => {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS paper_count,
                COALESCE(SUM(question_count), 0) AS question_count,
                COALESCE(MAX(question_count), 0) AS max_questions,
                COALESCE(MIN(duration_minutes), 0) AS min_duration,
                COALESCE(MAX(duration_minutes), 0) AS max_duration
         FROM (
           SELECT e.id, e.duration_minutes, COUNT(q.id) AS question_count
           FROM exams e
           LEFT JOIN questions q ON q.exam_id = e.id
           WHERE e.series_id = ? AND e.status = 'published'
           GROUP BY e.id
         )`,
      )
      .get(series.id);

    if (row.paper_count !== series.expectedPapers) {
      throw new Error(
        `Series ${series.id} has ${row.paper_count} published paper(s); ` +
          `expected ${series.expectedPapers}. Long exams were not changed.`,
      );
    }
    if (row.max_questions > 30 || row.min_duration !== 25 || row.max_duration !== 25) {
      throw new Error(
        `Series ${series.id} failed short-paper validation: ` +
          `${row.max_questions} max question(s), duration ${row.min_duration}–${row.max_duration}.`,
      );
    }

    return { id: series.id, papers: row.paper_count, questions: row.question_count };
  });

  const placeholders = LONG_EXAM_IDS.map(() => "?").join(", ");
  const sourceRows = db
    .prepare(
      `SELECT e.id, e.status, COUNT(a.id) AS attempt_count
       FROM exams e
       LEFT JOIN attempts a ON a.exam_id = e.id
       WHERE e.id IN (${placeholders})
       GROUP BY e.id`,
    )
    .all(...LONG_EXAM_IDS);

  if (sourceRows.length !== LONG_EXAM_IDS.length) {
    const foundIds = new Set(sourceRows.map((row) => row.id));
    const missingIds = LONG_EXAM_IDS.filter((id) => !foundIds.has(id));
    throw new Error(`Long source exam(s) are missing: ${missingIds.join(", ")}`);
  }

  const now = new Date().toISOString();
  const result = db.transaction(() =>
    db
      .prepare(
        `UPDATE exams
         SET status = 'draft', updated_at = ?
         WHERE id IN (${placeholders})`,
      )
      .run(now, ...LONG_EXAM_IDS),
  )();

  if (result.changes !== LONG_EXAM_IDS.length) {
    throw new Error(
      `Archived ${result.changes} long exam(s); expected ${LONG_EXAM_IDS.length}`,
    );
  }

  return {
    archived: result.changes,
    preservedAttempts: sourceRows.reduce((sum, row) => sum + row.attempt_count, 0),
    series: seriesSummary,
  };
}

function runFromCommandLine() {
  const db = openDatabase(process.env.DATABASE_PATH ?? "./data/study-workbench.sqlite");
  try {
    const result = archiveLongExams(db);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runFromCommandLine();
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
