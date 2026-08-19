import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { hashPassword } from "../server/auth.mjs";
import { createApp } from "../server/app.mjs";
import { openDatabase } from "../server/db.mjs";
import { importContent } from "../server/import-content.mjs";

const fixture = JSON.parse(
  await readFile(new URL("../data/content.example.json", import.meta.url), "utf8"),
);
const hrEconomistFixture = JSON.parse(
  await readFile(new URL("../data/hr-economist-sample.json", import.meta.url), "utf8"),
);
const hrMasterCollectionFixture = JSON.parse(
  await readFile(new URL("../data/hr-600-master-collection.json", import.meta.url), "utf8"),
);
const testUsername = "13000000001";
const testPassword = "TestPass1!";

async function provisionUser(db, {
  username = testUsername,
  password = testPassword,
  displayName = "测试用户",
} = {}) {
  const passwordRecord = await hashPassword(password);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (
       id, username, display_name, password_hash, password_salt, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(username, username, displayName, passwordRecord.hash, passwordRecord.salt, now, now);
}

async function loginAs(app, username = testUsername, password = testPassword) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password },
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.headers["set-cookie"].split(";")[0];
}

function authenticated(cookie) {
  return { cookie };
}

async function createTestApp() {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-test-"));
  const databasePath = join(directory, "test.sqlite");
  const db = openDatabase(databasePath);
  importContent(db, fixture);
  await provisionUser(db);
  db.close();

  const app = await createApp({
    databasePath,
    logger: false,
    serveStatic: false,
    storage: null,
  });
  const cookie = await loginAs(app);

  return {
    app,
    cookie,
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

test("pre-provisioned phone accounts can log in and registration stays closed", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const registration = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { username: "13000000002", password: "AnotherPass1!" },
  });
  assert.equal(registration.statusCode, 404);

  const unauthenticatedDashboard = await testApp.app.inject({
    method: "GET",
    url: "/api/dashboard",
  });
  assert.equal(unauthenticatedDashboard.statusCode, 401);

  const wrongPassword = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: testUsername, password: "wrong-password" },
  });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(wrongPassword.json().error, "用户名或密码错误");

  const me = await testApp.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().user.id, testUsername);
  assert.equal(me.json().user.username, testUsername);
  assert.equal(me.json().user.displayName, "测试用户");

  const logout = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(logout.statusCode, 204);
  assert.match(logout.headers["set-cookie"], /Max-Age=0/);

  const expiredSession = await testApp.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(expiredSession.statusCode, 401);
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
  assert.equal(exam.seriesId, "");
  assert.equal(exam.seriesOrder, 999);
  for (const question of exam.questions) {
    assert.equal(Object.hasOwn(question, "explanation"), false);
    for (const option of question.options) {
      assert.equal(Object.hasOwn(option, "correct"), false);
    }
  }
});

test("HR master collection imports all source questions and reveals answers only after submission", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-hr-master-"));
  const databasePath = join(directory, "test.sqlite");
  const db = openDatabase(databasePath);
  const imported = importContent(db, hrMasterCollectionFixture);
  await provisionUser(db);
  db.close();

  assert.deepEqual(imported, { materials: 0, exams: 1, questions: 154, assets: 0 });

  const app = await createApp({
    databasePath,
    logger: false,
    serveStatic: false,
    storage: null,
  });
  const cookie = await loginAs(app);
  context.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  const examId = hrMasterCollectionFixture.exams[0].id;
  const examResponse = await app.inject({ method: "GET", url: `/api/exams/${examId}` });
  assert.equal(examResponse.statusCode, 200);
  const publicExam = examResponse.json();
  assert.equal(publicExam.questionCount, 154);
  assert.equal(publicExam.totalPoints, 246);
  assert.match(publicExam.title, /母题集锦/);
  for (const question of publicExam.questions) {
    assert.equal(Object.hasOwn(question, "explanation"), false);
    for (const option of question.options) {
      assert.equal(Object.hasOwn(option, "correct"), false);
    }
  }

  const sourceQuestions = hrMasterCollectionFixture.exams[0].questions;
  const submission = await app.inject({
    method: "POST",
    url: `/api/exams/${examId}/submissions`,
    headers: authenticated(cookie),
    payload: {
      durationSeconds: 154,
      answers: sourceQuestions.map((question) => ({
        questionId: question.id,
        optionIds: question.options.filter((option) => option.correct).map((option) => option.id),
      })),
    },
  });

  assert.equal(submission.statusCode, 201);
  const result = submission.json();
  assert.equal(result.score, 100);
  assert.equal(result.correctCount, 154);
  assert.equal(result.wrongCount, 0);
  assert.equal(result.answers.length, 154);
  assert.deepEqual(
    result.answers.at(-1).options.filter((option) => option.correct).map((option) => option.label),
    ["A", "D"],
  );
});

test("submissions persist results and mark a later-correct mistake as corrected", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const firstSubmission = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    headers: authenticated(testApp.cookie),
    payload: {
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
    url: "/api/mistakes",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(initialMistakes.statusCode, 200);
  assert.equal(initialMistakes.json().mistakes.length, 1);
  assert.equal(initialMistakes.json().mistakes[0].corrected, false);

  const secondSubmission = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    headers: authenticated(testApp.cookie),
    payload: {
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
    url: "/api/mistakes",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(correctedMistakes.json().mistakes[0].corrected, true);

  const dashboard = await testApp.app.inject({
    method: "GET",
    url: "/api/dashboard",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(dashboard.statusCode, 200);
  assert.equal(dashboard.json().attemptCount, 2);
  assert.equal(dashboard.json().recentAttempt.score, 100);
  assert.equal(dashboard.json().recentAttempt.passingScore, 60);
  assert.equal(dashboard.json().recentAttempt.durationSeconds, 30);

  const secondUsername = "13000000002";
  const secondPassword = "AnotherPass1!";
  await provisionUser(testApp.app.db, {
    username: secondUsername,
    password: secondPassword,
    displayName: "另一个用户",
  });
  const secondUserCookie = await loginAs(testApp.app, secondUsername, secondPassword);
  const otherUserResult = await testApp.app.inject({
    method: "GET",
    url: `/api/results/${firstResult.id}`,
    headers: authenticated(secondUserCookie),
  });
  assert.equal(otherUserResult.statusCode, 404);

  const otherUserResults = await testApp.app.inject({
    method: "GET",
    url: "/api/results",
    headers: authenticated(secondUserCookie),
  });
  assert.equal(otherUserResults.statusCode, 200);
  assert.deepEqual(otherUserResults.json().results, []);

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

  const unauthenticated = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    payload: {
      durationSeconds: 10,
      answers: [],
    },
  });
  assert.equal(unauthenticated.statusCode, 401);

  const invalid = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    headers: authenticated(testApp.cookie),
    payload: {
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
    headers: authenticated(testApp.cookie),
    payload: {
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
    CREATE TABLE exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL,
      passing_score INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO exams (
      id, title, description, duration_minutes, passing_score,
      status, created_at, updated_at
    ) VALUES (
      'legacy-exam', '旧版试卷', '', 30, 60,
      'published', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    );

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

    CREATE TABLE attempts (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      exam_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    );
    INSERT INTO attempts (
      id, device_id, exam_id, score, correct_count, wrong_count,
      total_questions, duration_seconds, started_at, submitted_at
    ) VALUES (
      'legacy-attempt', 'legacy-device', 'legacy-exam', 80, 1, 0,
      1, 30, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:30.000Z'
    );
    PRAGMA user_version = 1;
  `);
  legacyDb.close();

  const migratedDb = openDatabase(databasePath);
  context.after(() => migratedDb.close());
  assert.equal(migratedDb.pragma("user_version", { simple: true }), 4);
  assert.deepEqual(
    migratedDb.prepare("SELECT id, section, passage FROM questions WHERE id = ?").get("legacy-q"),
    { id: "legacy-q", section: "standard", passage: "" },
  );
  assert.deepEqual(
    migratedDb.prepare("SELECT id, device_id, user_id FROM attempts WHERE id = ?").get(
      "legacy-attempt",
    ),
    { id: "legacy-attempt", device_id: "legacy-device", user_id: null },
  );
  assert.equal(
    migratedDb.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    0,
  );
  assert.deepEqual(
    migratedDb
      .prepare("SELECT series_id, series_order, paper_order FROM exams WHERE id = ?")
      .get("legacy-exam"),
    { series_id: "", series_order: 999, paper_order: 1 },
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
