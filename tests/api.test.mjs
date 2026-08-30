import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
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
let testCaptchaSequence = 0;

function createTestCaptchaChallenge(nowMs = Date.now()) {
  testCaptchaSequence += 1;
  const suffix = String(testCaptchaSequence);
  return {
    id: `test-captcha-${suffix}`,
    prompt: "请选择「星星」",
    options: [
      { id: `test-wrong-${suffix}`, imageData: "data:image/svg+xml;base64,d3Jvbmc=" },
      { id: `test-correct-${suffix}`, imageData: "data:image/svg+xml;base64,Y29ycmVjdA==" },
    ],
    correctOptionId: `test-correct-${suffix}`,
    expiresAt: nowMs + 3 * 60 * 1000,
  };
}

async function provisionUser(db, {
  username = testUsername,
  password = testPassword,
  displayName = "测试用户",
  isAdmin = false,
  moduleIds = ["human-resources", "economics", "english"],
} = {}) {
  const passwordRecord = await hashPassword(password);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (
       id, username, display_name, password_hash, password_salt,
       is_admin, is_active, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    username,
    username,
    displayName,
    passwordRecord.hash,
    passwordRecord.salt,
    isAdmin ? 1 : 0,
    now,
    now,
  );
  const assignModule = db.prepare(
    `INSERT INTO user_module_access (user_id, module_id, assigned_by, assigned_at)
     VALUES (?, ?, NULL, ?)`,
  );
  for (const moduleId of moduleIds) assignModule.run(username, moduleId, now);
}

async function loginAs(app, username = testUsername, password = testPassword) {
  const captcha = await issueCaptcha(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username,
      password,
      captchaId: captcha.id,
      captchaOptionId: captcha.correctOptionId,
    },
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.headers["set-cookie"].split(";")[0];
}

async function issueCaptcha(app) {
  const response = await app.inject({ method: "GET", url: "/api/auth/captcha" });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers["cache-control"], "no-store");
  const captcha = response.json();
  return {
    ...captcha,
    correctOptionId: captcha.options.find((option) => option.id.startsWith("test-correct-"))
      ?.id,
    wrongOptionId: captcha.options.find((option) => option.id.startsWith("test-wrong-"))?.id,
  };
}

function authenticated(cookie) {
  return { cookie };
}

async function createTestApp({ materialsEnabled = false, storage = null, userOptions = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-test-"));
  const databasePath = join(directory, "test.sqlite");
  const db = openDatabase(databasePath);
  importContent(db, fixture);
  await provisionUser(db, userOptions);
  db.close();

  const app = await createApp({
    databasePath,
    logger: false,
    serveStatic: false,
    storage,
    captchaFactory: createTestCaptchaChallenge,
    materialsEnabled,
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

  const legacyMistakePractice = await app.inject({
    method: "GET",
    url: "/mistakes/practice?questionId=sample-q-active-recall",
  });
  assert.equal(legacyMistakePractice.statusCode, 302);
  assert.equal(
    legacyMistakePractice.headers.location,
    "/study/mistakes/practice?questionId=sample-q-active-recall",
  );

  const hiddenMaterialDeepLink = await app.inject({
    method: "GET",
    url: "/study/materials/sample-learning-method?from=bookmark",
  });
  assert.equal(hiddenMaterialDeepLink.statusCode, 302);
  assert.equal(hiddenMaterialDeepLink.headers.location, "/study?from=bookmark");

  const hiddenLegacyMaterial = await app.inject({
    method: "GET",
    url: "/materials/sample-learning-method",
  });
  assert.equal(hiddenLegacyMaterial.statusCode, 302);
  assert.equal(hiddenLegacyMaterial.headers.location, "/study");

  const unknownPage = await app.inject({ method: "GET", url: "/outside-study" });
  assert.equal(unknownPage.statusCode, 404);
  assert.equal(unknownPage.body, "页面不存在");

  const unknownApi = await app.inject({ method: "GET", url: "/api/not-found" });
  assert.equal(unknownApi.statusCode, 404);
  assert.equal(unknownApi.json().error, "接口不存在");
});

test("pre-provisioned usernames require a one-time image challenge and registration stays closed", async (context) => {
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

  const missingCaptcha = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: testUsername, password: "wrong-password" },
  });
  assert.equal(missingCaptcha.statusCode, 400);

  const incorrectCaptcha = await issueCaptcha(testApp.app);
  const wrongSelection = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: testUsername,
      password: testPassword,
      captchaId: incorrectCaptcha.id,
      captchaOptionId: incorrectCaptcha.wrongOptionId,
    },
  });
  assert.equal(wrongSelection.statusCode, 400);
  assert.equal(
    wrongSelection.json().error,
    "图片选择码已失效或选择不正确，请重新选择",
  );

  const reusedSelection = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: testUsername,
      password: testPassword,
      captchaId: incorrectCaptcha.id,
      captchaOptionId: incorrectCaptcha.correctOptionId,
    },
  });
  assert.equal(reusedSelection.statusCode, 400, "a captcha must be single-use");

  const wrongPasswordCaptcha = await issueCaptcha(testApp.app);
  const wrongPassword = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: testUsername,
      password: "wrong-password",
      captchaId: wrongPasswordCaptcha.id,
      captchaOptionId: wrongPasswordCaptcha.correctOptionId,
    },
  });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(wrongPassword.json().error, "用户名或密码错误");

  await provisionUser(testApp.app.db, {
    username: "study-user",
    password: "AnotherPass1!",
    displayName: "普通用户名",
  });
  const normalizedUsernameCookie = await loginAs(
    testApp.app,
    " study - user ",
    "AnotherPass1!",
  );
  const normalizedUsernameMe = await testApp.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authenticated(normalizedUsernameCookie),
  });
  assert.equal(normalizedUsernameMe.statusCode, 200);
  assert.equal(normalizedUsernameMe.json().user.username, "study-user");

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

test("repeated password failures are rate limited after five attempts", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const captcha = await issueCaptcha(testApp.app);
    const response = await testApp.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: testUsername,
        password: "wrong-password",
        captchaId: captcha.id,
        captchaOptionId: captcha.correctOptionId,
      },
    });
    assert.equal(response.statusCode, 401, `attempt ${attempt} should reject the password`);
  }

  const blockedCaptcha = await issueCaptcha(testApp.app);
  const blocked = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: testUsername,
      password: testPassword,
      captchaId: blockedCaptcha.id,
      captchaOptionId: blockedCaptcha.correctOptionId,
    },
  });
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.json().error, /登录尝试过多/);
  assert.ok(Number(blocked.headers["retry-after"]) > 0);
});

test("a new login invalidates the same user's previous device session", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const firstDeviceCookie = testApp.cookie;
  const secondDeviceCookie = await loginAs(testApp.app);

  const firstDevice = await testApp.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authenticated(firstDeviceCookie),
  });
  assert.equal(firstDevice.statusCode, 401);

  const secondDevice = await testApp.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authenticated(secondDeviceCookie),
  });
  assert.equal(secondDevice.statusCode, 200);
  assert.equal(
    testApp.app.db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?").get(testUsername)
      .count,
    1,
  );
});

test("administrators manage accounts and course access while APIs enforce assignments", async (context) => {
  const testApp = await createTestApp({ userOptions: { isAdmin: true } });
  context.after(() => testApp.cleanup());

  const initial = await testApp.app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(initial.statusCode, 200, initial.body);
  assert.deepEqual(
    initial.json().modules.map((module) => module.id),
    ["human-resources", "economics", "english"],
  );
  assert.equal(initial.json().users[0].isAdmin, true);

  const created = await testApp.app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: authenticated(testApp.cookie),
    payload: {
      username: " course user ",
      displayName: "课程用户",
      password: "Course123",
      moduleIds: ["english"],
      isAdmin: false,
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const managedUser = created.json().user;
  assert.equal(managedUser.username, "courseuser");
  assert.deepEqual(managedUser.moduleIds, ["english"]);

  const courseUserCookie = await loginAs(testApp.app, "courseuser", "Course123");
  const forbiddenAdmin = await testApp.app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: authenticated(courseUserCookie),
  });
  assert.equal(forbiddenAdmin.statusCode, 403);

  const forbiddenHr = await testApp.app.inject({
    method: "GET",
    url: "/api/exams",
    headers: authenticated(courseUserCookie),
  });
  assert.equal(forbiddenHr.statusCode, 403);
  assert.match(forbiddenHr.json().error, /未开通这门课程/);

  const allowedEnglish = await testApp.app.inject({
    method: "GET",
    url: "/api/english/listening",
    headers: authenticated(courseUserCookie),
  });
  assert.equal(allowedEnglish.statusCode, 200, allowedEnglish.body);

  const expanded = await testApp.app.inject({
    method: "PUT",
    url: `/api/admin/users/${managedUser.id}`,
    headers: authenticated(testApp.cookie),
    payload: {
      displayName: "课程用户",
      password: "",
      moduleIds: ["human-resources", "english"],
      isAdmin: false,
      isActive: true,
    },
  });
  assert.equal(expanded.statusCode, 200, expanded.body);
  assert.equal(expanded.json().sessionsInvalidated, false);

  const allowedHr = await testApp.app.inject({
    method: "GET",
    url: "/api/exams",
    headers: authenticated(courseUserCookie),
  });
  assert.equal(allowedHr.statusCode, 200, allowedHr.body);

  const selfDemotion = await testApp.app.inject({
    method: "PUT",
    url: `/api/admin/users/${testUsername}`,
    headers: authenticated(testApp.cookie),
    payload: {
      displayName: "测试用户",
      password: "",
      moduleIds: ["human-resources", "economics", "english"],
      isAdmin: false,
      isActive: true,
    },
  });
  assert.equal(selfDemotion.statusCode, 409);

  const disabled = await testApp.app.inject({
    method: "PUT",
    url: `/api/admin/users/${managedUser.id}`,
    headers: authenticated(testApp.cookie),
    payload: {
      displayName: "课程用户",
      password: "",
      moduleIds: ["human-resources", "english"],
      isAdmin: false,
      isActive: false,
    },
  });
  assert.equal(disabled.statusCode, 200, disabled.body);
  assert.equal(disabled.json().sessionsInvalidated, true);

  const disabledSession = await testApp.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: authenticated(courseUserCookie),
  });
  assert.equal(disabledSession.statusCode, 401);

  const deleted = await testApp.app.inject({
    method: "DELETE",
    url: `/api/admin/users/${managedUser.id}`,
    headers: authenticated(testApp.cookie),
  });
  assert.equal(deleted.statusCode, 204, deleted.body);
  assert.equal(
    testApp.app.db.prepare("SELECT COUNT(*) AS count FROM users WHERE id = ?").get(managedUser.id)
      .count,
    0,
  );
  assert.equal(
    testApp.app.db.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count,
    4,
  );
});

test("administrator homework stays private and streams verified PDFs with byte ranges", async (context) => {
  const pdf = Buffer.alloc(317967, 0x20);
  pdf.write("%PDF-", 0, "ascii");
  const requestedObjects = [];
  const storage = {
    bucket: "test-assets",
    client: {
      async statObject(bucket, objectKey) {
        requestedObjects.push({ operation: "stat", bucket, objectKey });
        return { size: pdf.length };
      },
      async getObject(bucket, objectKey) {
        requestedObjects.push({ operation: "full", bucket, objectKey });
        return Readable.from([pdf]);
      },
      async getPartialObject(bucket, objectKey, start, length) {
        requestedObjects.push({ operation: "partial", bucket, objectKey, start, length });
        return Readable.from([pdf.subarray(start, start + length)]);
      },
    },
  };
  const testApp = await createTestApp({ storage, userOptions: { isAdmin: true } });
  context.after(() => testApp.cleanup());
  const listUrl = "/api/admin/homework";
  const fileUrl = "/api/admin/homework/chapter-01/file";

  const unauthenticatedList = await testApp.app.inject({ method: "GET", url: listUrl });
  assert.equal(unauthenticatedList.statusCode, 401);

  const list = await testApp.app.inject({
    method: "GET",
    url: listUrl,
    headers: authenticated(testApp.cookie),
  });
  assert.equal(list.statusCode, 200, list.body);
  assert.equal(list.headers["cache-control"], "private, no-store");
  assert.equal(list.json().collection.chapterCount, 19);
  assert.equal(list.json().collection.pageCount, 236);
  assert.equal(list.json().collection.byteLength, 5861709);
  assert.equal(list.json().chapters.length, 19);
  assert.equal(list.json().chapters[0].id, "chapter-01");
  assert.equal(list.json().chapters[18].id, "chapter-19");
  assert.equal(list.json().chapters[0].fileUrl, fileUrl);
  assert.equal(list.body.includes("objectKey"), false);
  assert.equal(list.body.includes("sourceFileName"), false);
  assert.equal(list.body.includes("sha256"), false);

  const unauthenticatedFile = await testApp.app.inject({ method: "GET", url: fileUrl });
  assert.equal(unauthenticatedFile.statusCode, 401);

  await provisionUser(testApp.app.db, {
    username: "homework-student",
    password: "Student123",
    displayName: "课后题学生",
    isAdmin: false,
  });
  const studentCookie = await loginAs(testApp.app, "homework-student", "Student123");
  const forbiddenList = await testApp.app.inject({
    method: "GET",
    url: listUrl,
    headers: authenticated(studentCookie),
  });
  assert.equal(forbiddenList.statusCode, 403);
  const forbiddenFile = await testApp.app.inject({
    method: "GET",
    url: fileUrl,
    headers: authenticated(studentCookie),
  });
  assert.equal(forbiddenFile.statusCode, 403);

  const partial = await testApp.app.inject({
    method: "GET",
    url: fileUrl,
    headers: { ...authenticated(testApp.cookie), range: "bytes=1-4" },
  });
  assert.equal(partial.statusCode, 206, partial.body);
  assert.equal(partial.headers["content-type"], "application/pdf");
  assert.equal(partial.headers["content-range"], `bytes 1-4/${pdf.length}`);
  assert.equal(partial.headers["content-length"], "4");
  assert.equal(partial.headers["cache-control"], "private, max-age=3600");
  assert.match(partial.headers["content-disposition"], /^inline; filename="chapter-01\.pdf"/);
  assert.deepEqual(partial.rawPayload, pdf.subarray(1, 5));
  assert.deepEqual(requestedObjects, [
    {
      operation: "stat",
      bucket: "test-assets",
      objectKey: "admin-homework/hr-intensive-course-2026/chapter-01.pdf",
    },
    {
      operation: "partial",
      bucket: "test-assets",
      objectKey: "admin-homework/hr-intensive-course-2026/chapter-01.pdf",
      start: 1,
      length: 4,
    },
  ]);

  const missing = await testApp.app.inject({
    method: "GET",
    url: "/api/admin/homework/chapter-20/file",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(missing.statusCode, 404);
  assert.match(missing.json().error, /章节不存在/);
});

test("administrator homework rejects a stored PDF whose size differs from the verified manifest", async (context) => {
  const storage = {
    bucket: "test-assets",
    client: {
      async statObject() {
        return { size: 99 };
      },
    },
  };
  const testApp = await createTestApp({ storage, userOptions: { isAdmin: true } });
  context.after(() => testApp.cleanup());

  const response = await testApp.app.inject({
    method: "GET",
    url: "/api/admin/homework/chapter-01/file",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(response.statusCode, 502);
  assert.match(response.json().error, /文件校验失败/);
});

test("materials and direct assets stay blocked while exams remain available", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const health = await testApp.app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json().status, "ok");
  assert.equal(health.json().capabilities.materials, "disabled");

  const materials = await testApp.app.inject({ method: "GET", url: "/api/materials" });
  assert.equal(materials.statusCode, 404);
  assert.equal(materials.json().error, "学习资料模块暂未开放");

  const material = await testApp.app.inject({
    method: "GET",
    url: "/api/materials/sample-learning-method",
  });
  assert.equal(material.statusCode, 404);
  assert.equal(material.json().error, "学习资料模块暂未开放");

  const directAsset = await testApp.app.inject({
    method: "GET",
    url: "/api/assets/known-or-guessed-asset-id",
  });
  assert.equal(directAsset.statusCode, 404);
  assert.equal(directAsset.json().error, "学习资料模块暂未开放");

  const examResponse = await testApp.app.inject({
    method: "GET",
    url: "/api/exams/sample-learning-check",
    headers: authenticated(testApp.cookie),
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

test("materials can be re-enabled explicitly without reimporting their data", async (context) => {
  const testApp = await createTestApp({ materialsEnabled: true });
  context.after(() => testApp.cleanup());

  const health = await testApp.app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.json().capabilities.materials, "enabled");

  const materials = await testApp.app.inject({
    method: "GET",
    url: "/api/materials",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(materials.statusCode, 200);
  assert.equal(materials.json().materials.length, 1);
  assert.equal(materials.json().categories[0].category, "学习方法");

  const material = await testApp.app.inject({
    method: "GET",
    url: "/api/materials/sample-learning-method",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(material.statusCode, 200);
  assert.match(material.json().content, /主动回忆/);
});

test("listening practice hides answers until submission and persists per-user progress", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const unauthenticated = await testApp.app.inject({
    method: "GET",
    url: "/api/english/listening",
  });
  assert.equal(unauthenticated.statusCode, 401);

  const listBefore = await testApp.app.inject({
    method: "GET",
    url: "/api/english/listening",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(listBefore.statusCode, 200, listBefore.body);
  assert.equal(listBefore.json().scenes.length, 10);
  assert.equal(listBefore.json().soundReference.sounds.length, 15);
  assert.equal(listBefore.json().soundReference.sounds[0].cue, "GREEN TEA");
  assert.equal(listBefore.json().soundReference.sounds[0].ipa, "i");
  assert.equal(listBefore.json().soundReference.source.licenseName, "CC BY-NC-ND 4.0");
  assert.equal(listBefore.json().summary.practicedSceneCount, 0);
  assert.doesNotMatch(
    listBefore.body,
    /correctOptionId|explanation|transcript|audioObjectKey|audioSourceUrl|audioByteLength|audioSha256/,
  );

  const detail = await testApp.app.inject({
    method: "GET",
    url: "/api/english/listening/ordering-a-meal",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().scene.questions.length, 3);
  assert.doesNotMatch(
    detail.body,
    /correctOptionId|explanation|transcript|audioObjectKey|audioSourceUrl|audioByteLength|audioSha256/,
  );

  const incomplete = await testApp.app.inject({
    method: "POST",
    url: "/api/english/listening/ordering-a-meal/submissions",
    headers: authenticated(testApp.cookie),
    payload: {
      accent: "us",
      listenCount: 1,
      durationSeconds: 20,
      answers: [{ questionId: "meal-ralph-drink", optionId: "tea" }],
    },
  });
  assert.equal(incomplete.statusCode, 400);
  assert.match(incomplete.json().error, /请完成全部 3 道听力题/);

  const completed = await testApp.app.inject({
    method: "POST",
    url: "/api/english/listening/ordering-a-meal/submissions",
    headers: authenticated(testApp.cookie),
    payload: {
      accent: "us",
      listenCount: 2,
      durationSeconds: 36,
      answers: [
        { questionId: "meal-ralph-drink", optionId: "tea" },
        { questionId: "meal-beef", optionId: "well" },
        { questionId: "meal-anna", optionId: "potato-salad" },
      ],
    },
  });
  assert.equal(completed.statusCode, 201, completed.body);
  assert.equal(completed.json().score, 100);
  assert.equal(completed.json().correctCount, 3);
  assert.equal(completed.json().transcript.length, 8);
  assert.equal(completed.json().answers[0].correctOptionId, "tea");

  const persisted = testApp.app.db
    .prepare(
      `SELECT user_id, scene_id, accent, score, listen_count, duration_seconds
       FROM listening_attempts`,
    )
    .all();
  assert.deepEqual(persisted, [{
    user_id: testUsername,
    scene_id: "ordering-a-meal",
    accent: "us",
    score: 100,
    listen_count: 2,
    duration_seconds: 36,
  }]);

  const listAfter = await testApp.app.inject({
    method: "GET",
    url: "/api/english/listening",
    headers: authenticated(testApp.cookie),
  });
  const mealProgress = listAfter.json().scenes.find((scene) => scene.id === "ordering-a-meal").progress;
  assert.deepEqual(
    {
      attemptCount: mealProgress.attemptCount,
      bestScore: mealProgress.bestScore,
      latestScore: mealProgress.latestScore,
    },
    { attemptCount: 1, bestScore: 100, latestScore: 100 },
  );
  assert.equal(listAfter.json().summary.masteredSceneCount, 1);
});

test("daily listening hides answers until submission and persists per-user progress", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());
  const storyId = "english-clubs-speaking-practice";

  const unauthenticated = await testApp.app.inject({
    method: "GET",
    url: "/api/english/daily-listening",
  });
  assert.equal(unauthenticated.statusCode, 401);

  const listBefore = await testApp.app.inject({
    method: "GET",
    url: "/api/english/daily-listening",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(listBefore.statusCode, 200, listBefore.body);
  assert.equal(listBefore.json().stories.length, 1);
  assert.equal(listBefore.json().stories[0].durationSeconds, 48);
  assert.equal(listBefore.json().stories[0].questionCount, 3);
  assert.equal(listBefore.json().summary.practicedStoryCount, 0);
  assert.doesNotMatch(
    listBefore.body,
    /correctOptionId|explanation|transcript|audioObjectKey|audioSourceUrl|audioByteLength|audioSha256/,
  );

  const detail = await testApp.app.inject({
    method: "GET",
    url: `/api/english/daily-listening/${storyId}`,
    headers: authenticated(testApp.cookie),
  });
  assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().story.questions.length, 3);
  assert.doesNotMatch(
    detail.body,
    /correctOptionId|explanation|transcript|audioObjectKey|audioSourceUrl|audioByteLength|audioSha256/,
  );

  const incomplete = await testApp.app.inject({
    method: "POST",
    url: `/api/english/daily-listening/${storyId}/submissions`,
    headers: authenticated(testApp.cookie),
    payload: {
      listenCount: 1,
      durationSeconds: 24,
      answers: [{ questionId: "clubs-main-idea", optionId: "practice" }],
    },
  });
  assert.equal(incomplete.statusCode, 400);
  assert.match(incomplete.json().error, /请完成全部 3 道听力题/);

  const completed = await testApp.app.inject({
    method: "POST",
    url: `/api/english/daily-listening/${storyId}/submissions`,
    headers: authenticated(testApp.cookie),
    payload: {
      listenCount: 2,
      durationSeconds: 75,
      answers: [
        { questionId: "clubs-main-idea", optionId: "practice" },
        { questionId: "clubs-hardest-part", optionId: "speaking" },
        { questionId: "clubs-suggestion", optionId: "club" },
      ],
    },
  });
  assert.equal(completed.statusCode, 201, completed.body);
  assert.equal(completed.json().score, 100);
  assert.equal(completed.json().correctCount, 3);
  assert.equal(completed.json().transcript.length, 4);
  assert.equal(completed.json().answers[0].correctOptionId, "practice");

  const persisted = testApp.app.db
    .prepare(
      `SELECT user_id, story_id, score, listen_count, duration_seconds
       FROM daily_listening_attempts`,
    )
    .all();
  assert.deepEqual(persisted, [{
    user_id: testUsername,
    story_id: storyId,
    score: 100,
    listen_count: 2,
    duration_seconds: 75,
  }]);

  const listAfter = await testApp.app.inject({
    method: "GET",
    url: "/api/english/daily-listening",
    headers: authenticated(testApp.cookie),
  });
  assert.deepEqual(
    listAfter.json().stories[0].progress,
    {
      attemptCount: 1,
      bestScore: 100,
      latestScore: 100,
      lastPracticedAt: completed.json().submittedAt,
    },
  );
  assert.deepEqual(listAfter.json().summary, {
    storyCount: 1,
    practicedStoryCount: 1,
    masteredStoryCount: 1,
    totalAttemptCount: 1,
  });

  await provisionUser(testApp.app.db, {
    username: "english-other-user",
    password: "AnotherPass1!",
    displayName: "另一位英语用户",
    moduleIds: ["english"],
  });
  const otherCookie = await loginAs(testApp.app, "english-other-user", "AnotherPass1!");
  const otherList = await testApp.app.inject({
    method: "GET",
    url: "/api/english/daily-listening",
    headers: authenticated(otherCookie),
  });
  assert.equal(otherList.statusCode, 200, otherList.body);
  assert.equal(otherList.json().stories[0].progress.attemptCount, 0);
});

test("daily listening audio is authenticated, private, and supports byte ranges", async (context) => {
  const audio = Buffer.from("daily-human-audio");
  const requestedObjects = [];
  const storage = {
    bucket: "test-assets",
    client: {
      async statObject(bucket, objectKey) {
        requestedObjects.push({ operation: "stat", bucket, objectKey });
        return { size: audio.length };
      },
      async getObject(bucket, objectKey) {
        requestedObjects.push({ operation: "full", bucket, objectKey });
        return Readable.from([audio]);
      },
      async getPartialObject(bucket, objectKey, start, length) {
        requestedObjects.push({ operation: "partial", bucket, objectKey, start, length });
        return Readable.from([audio.subarray(start, start + length)]);
      },
    },
  };
  const testApp = await createTestApp({ storage });
  context.after(() => testApp.cleanup());
  const url = "/api/english/daily-listening/english-clubs-speaking-practice/audio";

  const unauthenticated = await testApp.app.inject({ method: "GET", url });
  assert.equal(unauthenticated.statusCode, 401);

  const partial = await testApp.app.inject({
    method: "GET",
    url,
    headers: { ...authenticated(testApp.cookie), range: "bytes=2-6" },
  });
  assert.equal(partial.statusCode, 206, partial.body);
  assert.equal(partial.headers["content-type"], "audio/mpeg");
  assert.equal(partial.headers["content-range"], `bytes 2-6/${audio.length}`);
  assert.equal(partial.headers["cache-control"], "private, max-age=86400");
  assert.deepEqual(partial.rawPayload, audio.subarray(2, 7));

  assert.ok(requestedObjects.some((request) => (
    request.operation === "partial" && request.start === 2 && request.length === 5
  )));
  assert.ok(requestedObjects.every((request) => (
    request.bucket === "test-assets"
      && request.objectKey === "english-listening/daily/voa-english-clubs-opening-48s.mp3"
  )));
});

test("listening audio is authenticated and supports byte ranges", async (context) => {
  const audio = Buffer.from("0123456789");
  const requestedObjects = [];
  const storage = {
    bucket: "test-assets",
    client: {
      async statObject(bucket, objectKey) {
        requestedObjects.push({ operation: "stat", bucket, objectKey });
        return { size: audio.length };
      },
      async getObject(bucket, objectKey) {
        requestedObjects.push({ operation: "full", bucket, objectKey });
        return Readable.from([audio]);
      },
      async getPartialObject(bucket, objectKey, start, length) {
        requestedObjects.push({ operation: "partial", bucket, objectKey, start, length });
        return Readable.from([audio.subarray(start, start + length)]);
      },
    },
  };
  const testApp = await createTestApp({ storage });
  context.after(() => testApp.cleanup());
  const url = "/api/english/listening/ordering-a-meal/audio";

  const unauthenticated = await testApp.app.inject({ method: "GET", url });
  assert.equal(unauthenticated.statusCode, 401);

  const full = await testApp.app.inject({
    method: "GET",
    url,
    headers: authenticated(testApp.cookie),
  });
  assert.equal(full.statusCode, 200, full.body);
  assert.equal(full.headers["accept-ranges"], "bytes");
  assert.equal(full.headers["content-length"], String(audio.length));
  assert.deepEqual(full.rawPayload, audio);

  const partial = await testApp.app.inject({
    method: "GET",
    url,
    headers: { ...authenticated(testApp.cookie), range: "bytes=2-5" },
  });
  assert.equal(partial.statusCode, 206, partial.body);
  assert.equal(partial.headers["content-range"], "bytes 2-5/10");
  assert.equal(partial.headers["content-length"], "4");
  assert.deepEqual(partial.rawPayload, Buffer.from("2345"));

  const invalid = await testApp.app.inject({
    method: "GET",
    url,
    headers: { ...authenticated(testApp.cookie), range: "bytes=50-60" },
  });
  assert.equal(invalid.statusCode, 416);
  assert.equal(invalid.headers["content-range"], "bytes */10");
  assert.match(invalid.json().error, /超出文件大小/);

  assert.ok(requestedObjects.some((request) => request.operation === "full"));
  assert.ok(requestedObjects.some((request) => (
    request.operation === "partial" && request.start === 2 && request.length === 4
  )));
  assert.ok(requestedObjects.every((request) => (
    request.bucket === "test-assets"
      && request.objectKey === "english-listening/everyday-conversations/dialogue_2-01_ordering_a_meal.mp3"
  )));
});

test("pronunciation audio is authenticated, private, and supports byte ranges", async (context) => {
  const audio = Buffer.from("pronunciation-audio");
  const requestedObjects = [];
  const storage = {
    bucket: "test-assets",
    client: {
      async statObject(bucket, objectKey) {
        requestedObjects.push({ operation: "stat", bucket, objectKey });
        return { size: audio.length };
      },
      async getObject(bucket, objectKey) {
        requestedObjects.push({ operation: "full", bucket, objectKey });
        return Readable.from([audio]);
      },
      async getPartialObject(bucket, objectKey, start, length) {
        requestedObjects.push({ operation: "partial", bucket, objectKey, start, length });
        return Readable.from([audio.subarray(start, start + length)]);
      },
    },
  };
  const testApp = await createTestApp({ storage });
  context.after(() => testApp.cleanup());
  const url = "/api/english/pronunciation/green-tea/audio";

  const unauthenticated = await testApp.app.inject({ method: "GET", url });
  assert.equal(unauthenticated.statusCode, 401);

  const partial = await testApp.app.inject({
    method: "GET",
    url,
    headers: { ...authenticated(testApp.cookie), range: "bytes=0-0" },
  });
  assert.equal(partial.statusCode, 206, partial.body);
  assert.equal(partial.headers["content-type"], "audio/mpeg");
  assert.equal(partial.headers["content-range"], `bytes 0-0/${audio.length}`);
  assert.equal(partial.headers["cache-control"], "private, max-age=86400");
  assert.deepEqual(partial.rawPayload, audio.subarray(0, 1));

  const missing = await testApp.app.inject({
    method: "GET",
    url: "/api/english/pronunciation/not-a-sound/audio",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(missing.statusCode, 404);
  assert.match(missing.json().error, /发音参考不存在/);

  assert.ok(requestedObjects.some((request) => (
    request.operation === "partial" && request.start === 0 && request.length === 1
  )));
  assert.ok(requestedObjects.every((request) => (
    request.bucket === "test-assets"
      && request.objectKey === "english-pronunciation/color-vowel-chart/GREEN-A.mp3"
  )));
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
    captchaFactory: createTestCaptchaChallenge,
  });
  const cookie = await loginAs(app);
  context.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  const examId = hrMasterCollectionFixture.exams[0].id;
  const examResponse = await app.inject({
    method: "GET",
    url: `/api/exams/${examId}`,
    headers: authenticated(cookie),
  });
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

test("mistake practice persists every retry and keeps relearned questions available", async (context) => {
  const testApp = await createTestApp();
  context.after(() => testApp.cleanup());

  const examSubmission = await testApp.app.inject({
    method: "POST",
    url: "/api/exams/sample-learning-check/submissions",
    headers: authenticated(testApp.cookie),
    payload: {
      durationSeconds: 20,
      answers: [
        { questionId: "sample-q-active-recall", optionIds: ["sample-q1-a"] },
        { questionId: "sample-q-review", optionIds: ["sample-q2-a", "sample-q2-c"] },
      ],
    },
  });
  assert.equal(examSubmission.statusCode, 201);

  const practiceList = await testApp.app.inject({
    method: "GET",
    url: "/api/mistakes/practice",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(practiceList.statusCode, 200);
  assert.equal(practiceList.json().questions.length, 1);
  assert.equal(practiceList.json().questions[0].questionId, "sample-q-active-recall");
  assert.equal(practiceList.json().questions[0].relearned, false);
  assert.equal(practiceList.json().questions[0].practiceCount, 0);
  assert.ok(
    practiceList.json().questions[0].options.every((option) => !("correct" in option)),
    "practice questions must not reveal correct options before submission",
  );

  const unrelatedQuestion = await testApp.app.inject({
    method: "POST",
    url: "/api/mistakes/sample-q-review/practice",
    headers: authenticated(testApp.cookie),
    payload: { optionIds: ["sample-q2-a", "sample-q2-c"] },
  });
  assert.equal(unrelatedQuestion.statusCode, 404);

  const wrongPractice = await testApp.app.inject({
    method: "POST",
    url: "/api/mistakes/sample-q-active-recall/practice",
    headers: authenticated(testApp.cookie),
    payload: { optionIds: ["sample-q1-a"] },
  });
  assert.equal(wrongPractice.statusCode, 201);
  assert.equal(wrongPractice.json().isCorrect, false);
  assert.equal(wrongPractice.json().relearned, false);
  assert.equal(wrongPractice.json().practiceCount, 1);
  assert.deepEqual(wrongPractice.json().correctOptions.map((option) => option.id), ["sample-q1-b"]);

  const correctPractice = await testApp.app.inject({
    method: "POST",
    url: "/api/mistakes/sample-q-active-recall/practice",
    headers: authenticated(testApp.cookie),
    payload: { optionIds: ["sample-q1-b"] },
  });
  assert.equal(correctPractice.statusCode, 201);
  assert.equal(correctPractice.json().isCorrect, true);
  assert.equal(correctPractice.json().relearned, true);
  assert.equal(correctPractice.json().practiceCount, 2);

  const retryAfterRelearning = await testApp.app.inject({
    method: "POST",
    url: "/api/mistakes/sample-q-active-recall/practice",
    headers: authenticated(testApp.cookie),
    payload: { optionIds: ["sample-q1-a"] },
  });
  assert.equal(retryAfterRelearning.statusCode, 201);
  assert.equal(retryAfterRelearning.json().isCorrect, false);
  assert.equal(
    retryAfterRelearning.json().relearned,
    true,
    "a later wrong retry must not erase the relearned milestone",
  );
  assert.equal(retryAfterRelearning.json().practiceCount, 3);

  const refreshedList = await testApp.app.inject({
    method: "GET",
    url: "/api/mistakes/practice",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(refreshedList.json().questions.length, 1, "relearned mistakes remain practiceable");
  assert.equal(refreshedList.json().questions[0].relearned, true);
  assert.equal(refreshedList.json().questions[0].practiceCount, 3);

  const mistakeBook = await testApp.app.inject({
    method: "GET",
    url: "/api/mistakes",
    headers: authenticated(testApp.cookie),
  });
  assert.equal(mistakeBook.json().mistakes[0].relearned, true);
  assert.equal(mistakeBook.json().mistakes[0].practiceCount, 3);
  assert.equal(
    testApp.app.db.prepare("SELECT COUNT(*) AS count FROM mistake_practice_attempts").get().count,
    3,
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
  assert.equal(migratedDb.pragma("user_version", { simple: true }), 9);
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

test("version 4 migration keeps only the newest session per user", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-session-migration-"));
  const databasePath = join(directory, "version-4.sqlite");
  let migratedDb;
  context.after(async () => {
    migratedDb?.close();
    await rm(directory, { recursive: true, force: true });
  });

  const versionFourDb = openDatabase(databasePath);
  versionFourDb.exec(`
    DROP INDEX idx_sessions_one_per_user;
    DROP INDEX idx_admin_audit_created;
    DROP INDEX idx_user_module_access_module;
    DROP TABLE admin_audit_log;
    DROP TABLE user_module_access;
    DROP TABLE learning_modules;
    DROP TABLE mistake_practice_attempts;
    DROP INDEX idx_daily_listening_attempts_user_story_submitted;
    DROP TABLE daily_listening_attempts;
    DROP TABLE listening_attempts;
    ALTER TABLE users DROP COLUMN is_admin;
    ALTER TABLE users DROP COLUMN is_active;
    INSERT INTO users (
      id, username, display_name, password_hash, password_salt, created_at, updated_at
    ) VALUES (
      'session-user', 'session-user', '会话测试', 'hash', 'salt',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    );
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES
      ('older-session', 'session-user', 'older-token',
       '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
      ('newer-session', 'session-user', 'newer-token',
       '2026-01-02T00:00:00.000Z', '2026-03-01T00:00:00.000Z');
    PRAGMA user_version = 4;
  `);
  versionFourDb.close();

  migratedDb = openDatabase(databasePath);
  assert.equal(migratedDb.pragma("user_version", { simple: true }), 9);
  assert.equal(
    migratedDb
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("mistake_practice_attempts").count,
    1,
  );
  assert.equal(
    migratedDb
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("daily_listening_attempts").count,
    1,
  );
  assert.deepEqual(
    migratedDb.prepare("SELECT id FROM sessions WHERE user_id = ?").all("session-user"),
    [{ id: "newer-session" }],
  );
  assert.deepEqual(
    migratedDb
      .prepare("SELECT is_admin, is_active FROM users WHERE id = ?")
      .get("session-user"),
    { is_admin: 1, is_active: 1 },
  );
  assert.deepEqual(
    migratedDb
      .prepare(
        `SELECT module_id
         FROM user_module_access
         WHERE user_id = ?
         ORDER BY module_id`,
      )
      .all("session-user"),
    [
      { module_id: "economics" },
      { module_id: "english" },
      { module_id: "human-resources" },
    ],
  );
  assert.throws(
    () =>
      migratedDb
        .prepare(
          `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          "duplicate-session",
          "session-user",
          "duplicate-token",
          "2026-01-03T00:00:00.000Z",
          "2026-04-01T00:00:00.000Z",
        ),
    /UNIQUE constraint failed: sessions.user_id/,
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
