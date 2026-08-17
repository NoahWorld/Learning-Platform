import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../server/app.mjs";
import { openDatabase } from "../server/db.mjs";
import { importContent } from "../server/import-content.mjs";

const fixture = JSON.parse(
  await readFile(new URL("../data/content.example.json", import.meta.url), "utf8"),
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
