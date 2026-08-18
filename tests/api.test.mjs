import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { createApp } from "../server/app.mjs";
import { openDatabase } from "../server/db.mjs";
import { importContent } from "../server/import-content.mjs";

const fixture = JSON.parse(
  await readFile(new URL("../data/content.example.json", import.meta.url), "utf8"),
);
const hrEconomistFixture = JSON.parse(
  await readFile(new URL("../data/hr-economist-sample.json", import.meta.url), "utf8"),
);
const deviceId = "device-test-123";

async function createTestApp() {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-test-"));
  const databasePath = join(directory, "test.sqlite");
  const db = openDatabase(databasePath);
  importContent(db, fixture);
  db.close();

  const app = await createApp({
    databasePath,
    logger: false,
    serveStatic: false,
    storage: null,
  });

  return {
    app,
    databasePath,
    async cleanup() {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("web pages are mounted under /study and legacy links redirect", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-routes-"));
  const databasePath = join(directory, "test.sqlite");
  const staticDir = join(directory, "dist");
  await mkdir(staticDir);
  await writeFile(
    join(staticDir, "index.html"),
    "<!doctype html><html><body><div id=\"root\">study-route-fixture</div></body></html>",
  );

  const app = await createApp({
    databasePath,
    logger: false,
    serveStatic: true,
    staticDir,
    storage: null,
  });
  context.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  const root = await app.inject({ method: "GET", url: "/?from=bookmark" });
  assert.equal(root.statusCode, 302);
  assert.equal(root.headers.location, "/study?from=bookmark");

  const studyHome = await app.inject({ method: "GET", url: "/study" });
  assert.equal(studyHome.statusCode, 200);
  assert.match(studyHome.headers["content-type"], /^text\/html/);
  assert.match(studyHome.body, /study-route-fixture/);

  const studyDeepLink = await app.inject({
    method: "GET",
    url: "/study/exams/sample-learning-check",
  });
  assert.equal(studyDeepLink.statusCode, 200);
  assert.match(studyDeepLink.body, /study-route-fixture/);

  const legacyDeepLink = await app.inject({
    method: "GET",
    url: "/exams/sample-learning-check?mode=review",
  });
  assert.equal(legacyDeepLink.statusCode, 302);
  assert.equal(
    legacyDeepLink.headers.location,
    "/study/exams/sample-learning-check?mode=review",
  );

  const unknownPage = await app.inject({ method: "GET", url: "/outside-study" });
  assert.equal(unknownPage.statusCode, 404);
  assert.equal(unknownPage.body, "页面不存在");

  const unknownApi = await app.inject({ method: "GET", url: "/api/not-found" });
  assert.equal(unknownApi.statusCode, 404);
  assert.equal(unknownApi.json().error, "接口不存在");
});

test("published materials and exams are readable without leaking answer keys", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const health = await testApp.app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json().status, "ok");

  const materials = await testApp.app.inject({ method: "GET", url: "/api/materials" });
  assert.equal(materials.statusCode, 200);
  assert.equal(materials.json().materials.length, 1);
  assert.equal(materials.json().categories[0].category, "学习方法");

  const material = await testApp.app.inject({
    method: "GET",
    url: "/api/materials/sample-learning-method",
  });
  assert.equal(material.statusCode, 200);
  assert.match(material.json().content, /主动回忆/);

  const examResponse = await testApp.app.inject({
    method: "GET",
    url: "/api/exams/sample-learning-check",
  });
  assert.equal(examResponse.statusCode, 200);
  const exam = examResponse.json();
  assert.equal(exam.questionCount, 2);
  assert.equal(exam.totalPoints, 3);
  for (const question of exam.questions) {
    assert.equal(Object.hasOwn(question, "explanation"), false);
    for (const option of question.options) {
      assert.equal(Object.hasOwn(option, "correct"), false);
    }
  }
});

test("submissions persist results and mark a later-correct mistake as corrected", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const firstSubmission = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    payload: {
      deviceId,
      durationSeconds: 42,
      answers: [
        { questionId: "sample-q-active-recall", optionIds: ["sample-q1-a"] },
        { questionId: "sample-q-review", optionIds: ["sample-q2-a", "sample-q2-c"] },
      ],
    },
  });
  assert.equal(firstSubmission.statusCode, 201);
  const firstResult = firstSubmission.json();
  assert.equal(firstResult.score, 67);
  assert.equal(firstResult.correctCount, 1);
  assert.equal(firstResult.wrongCount, 1);
  assert.equal(firstResult.answers[0].isCorrect, false);

  const initialMistakes = await testApp.app.inject({
    method: "GET",
    url: `/api/mistakes?deviceId=${deviceId}`,
  });
  assert.equal(initialMistakes.statusCode, 200);
  assert.equal(initialMistakes.json().mistakes.length, 1);
  assert.equal(initialMistakes.json().mistakes[0].corrected, false);

  const secondSubmission = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    payload: {
      deviceId,
      durationSeconds: 30,
      answers: [
        { questionId: "sample-q-active-recall", optionIds: ["sample-q1-b"] },
        { questionId: "sample-q-review", optionIds: ["sample-q2-a", "sample-q2-c"] },
      ],
    },
  });
  assert.equal(secondSubmission.statusCode, 201);
  assert.equal(secondSubmission.json().score, 100);

  const correctedMistakes = await testApp.app.inject({
    method: "GET",
    url: `/api/mistakes?deviceId=${deviceId}`,
  });
  assert.equal(correctedMistakes.json().mistakes[0].corrected, true);

  const dashboard = await testApp.app.inject({
    method: "GET",
    url: `/api/dashboard?deviceId=${deviceId}`,
  });
  assert.equal(dashboard.statusCode, 200);
  assert.equal(dashboard.json().attemptCount, 2);
  assert.equal(dashboard.json().recentAttempt.score, 100);
  assert.equal(dashboard.json().recentAttempt.passingScore, 60);
  assert.equal(dashboard.json().recentAttempt.durationSeconds, 30);

  const otherDeviceResult = await testApp.app.inject({
    method: "GET",
    url: `/api/results/${firstResult.id}?deviceId=another-device-456`,
  });
  assert.equal(otherDeviceResult.statusCode, 404);

  const db = testApp.app.db;
  assert.throws(
    () => importContent(db, fixture),
    /already has 2 attempt\(s\)/,
    "historical exams must be immutable after attempts exist",
  );
});

test("invalid submissions fail clearly and do not create attempts", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const invalid = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    payload: {
      deviceId,
      durationSeconds: 10,
      answers: [
        { questionId: "sample-q-active-recall", optionIds: ["sample-q1-b"] },
        { questionId: "sample-q-active-recall", optionIds: ["sample-q1-b"] },
      ],
    },
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.json().error, /重复题目/);
  assert.equal(testApp.app.db.prepare("SELECT COUNT(*) AS count FROM attempts").get().count, 0);
});

test("multiple-choice omissions receive official-style partial credit", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    payload: {
      deviceId,
      durationSeconds: 20,
      answers: [
        { questionId: "sample-q-active-recall", optionIds: ["sample-q1-b"] },
        { questionId: "sample-q-review", optionIds: ["sample-q2-a"] },
      ],
    },
  });

  assert.equal(response.statusCode, 201);
  const result = response.json();
  assert.equal(result.score, 50);
  assert.equal(result.correctCount, 1);
  assert.equal(result.wrongCount, 1);
  assert.equal(result.answers[1].earnedPoints, 0.5);
  assert.equal(result.answers[1].isCorrect, false);
});

test("version 1 databases migrate case-question fields without losing rows", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-migration-"));
  const databasePath = join(directory, "version-1.sqlite");
  context.after(() => rm(directory, { recursive: true, force: true }));

  const legacyDb = new Database(databasePath);
  legacyDb.exec(`
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('single', 'multiple')),
      prompt TEXT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL CHECK (position >= 0),
      points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0)
    );
    INSERT INTO questions (id, exam_id, type, prompt, explanation, position, points)
      VALUES ('legacy-q', 'legacy-exam', 'single', '旧题目', '旧解析', 0, 1);
    PRAGMA user_version = 1;
  `);
  legacyDb.close();

  const migratedDb = openDatabase(databasePath);
  context.after(() => migratedDb.close());
  assert.equal(migratedDb.pragma("user_version", { simple: true }), 2);
  assert.deepEqual(
    migratedDb.prepare("SELECT id, section, passage FROM questions WHERE id = ?").get("legacy-q"),
    { id: "legacy-q", section: "standard", passage: "" },
  );
});

test("HR economist sample imports its exact exam structure and asset metadata", () => {
  const db = openDatabase(":memory:");
  const uploadedAssets = hrEconomistFixture.assets.map((asset, index) => ({
    ...asset,
    objectKey: `test/${asset.id}`,
    fileName: asset.source.split("/").at(-1),
    contentType: index === 0 ? "image/svg+xml" : "text/markdown",
    sizeBytes: 100 + index,
  }));

  try {
    assert.deepEqual(importContent(db, hrEconomistFixture, uploadedAssets), {
      materials: 1,
      exams: 1,
      questions: 20,
      assets: 2,
    });
    assert.deepEqual(
      db.prepare(
        `SELECT
           SUM(CASE WHEN section = 'standard' AND type = 'single' THEN 1 ELSE 0 END) AS singles,
           SUM(CASE WHEN section = 'standard' AND type = 'multiple' THEN 1 ELSE 0 END) AS multiples,
           SUM(CASE WHEN section = 'case' THEN 1 ELSE 0 END) AS cases,
           SUM(points) AS total_points
         FROM questions
         WHERE exam_id = ?`,
      ).get("hr-economist-practice-2026-a"),
      { singles: 12, multiples: 4, cases: 4, total_points: 28 },
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM assets WHERE material_id = ?").get(
        "hr-economist-exam-guide-2026",
      ).count,
      2,
    );
  } finally {
    db.close();
  }
});
