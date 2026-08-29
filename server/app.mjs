import fastifyStatic from "@fastify/static";
import fastifyHelmet from "@fastify/helmet";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  loginSchema,
  listeningSubmissionSchema,
  mistakePracticeSubmissionSchema,
  submissionSchema,
} from "./content-schema.mjs";
import {
  clearSessionCookie,
  createSessionRecord,
  deleteCurrentSession,
  getAuthenticatedUser,
  hashPassword,
  mapUser,
  replaceUserSession,
  setSessionCookie,
  verifyPassword,
} from "./auth.mjs";
import { openDatabase } from "./db.mjs";
import { createStorage } from "./storage.mjs";
import { createCaptchaChallenge } from "./captcha.mjs";
import {
  englishListeningScenes,
  getEnglishListeningScene,
  toPublicListeningScene,
} from "./english-listening-content.mjs";
import {
  englishPronunciationSounds,
  englishPronunciationSource,
  getEnglishPronunciationSound,
  toPublicEnglishPronunciationSound,
} from "./english-pronunciation-content.mjs";

const DEFAULT_STATIC_DIR = fileURLToPath(new URL("../dist", import.meta.url));
const LEGACY_STUDY_PATH = /^\/(?:exams(?:\/.*)?|mistakes(?:\/.*)?|results(?:\/.*)?)$/;
const LEGACY_MATERIALS_PATH = /^\/materials(?:\/.*)?$/;
const STUDY_MATERIALS_PATH = /^\/study\/materials(?:\/.*)?$/;
const HUMAN_RESOURCES_MODULE_ID = "human-resources";
const ENGLISH_MODULE_ID = "english";

export async function createApp({
  databasePath = process.env.DATABASE_PATH ?? "./data/study-workbench.sqlite",
  logger = true,
  serveStatic = true,
  staticDir = DEFAULT_STATIC_DIR,
  storage = createStorage(),
  captchaFactory = createCaptchaChallenge,
  materialsEnabled = parseBooleanEnvironment(
    "MATERIALS_ENABLED",
    process.env.MATERIALS_ENABLED,
    false,
  ),
} = {}) {
  const app = Fastify({
    logger,
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });
  const db = openDatabase(databasePath);

  app.decorate("db", db);
  app.decorate("storage", storage);
  app.addHook("onClose", async () => {
    db.close();
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
    } else {
      request.log.warn({ err: error, statusCode }, "request rejected");
    }

    reply.status(statusCode).send({
      error: statusCode >= 500 && error.expose !== true
        ? "服务器暂时无法处理这个请求"
        : error.message,
      requestId: request.id,
    });
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // The initial deployment is HTTP-only. Enable this after a domain and TLS
        // certificate are configured, otherwise browsers upgrade assets to HTTPS.
        upgradeInsecureRequests: null,
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    strictTransportSecurity: false,
  });

  registerApiRoutes(app, db, storage, captchaFactory, materialsEnabled);

  if (serveStatic) {
    if (!existsSync(staticDir)) {
      throw new Error(`Frontend build not found at ${staticDir}. Run npm run build first.`);
    }

    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: "/",
      wildcard: false,
      index: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.status(404).send({
          error: "接口不存在",
          requestId: request.id,
        });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return reply.status(404).send({
          error: "页面不存在",
          requestId: request.id,
        });
      }

      const requestUrl = new URL(request.url, "http://localhost");

      if (requestUrl.pathname === "/") {
        return reply.redirect(`/study${requestUrl.search}`);
      }

      if (
        !materialsEnabled &&
        (LEGACY_MATERIALS_PATH.test(requestUrl.pathname) ||
          STUDY_MATERIALS_PATH.test(requestUrl.pathname))
      ) {
        return reply.redirect(`/study${requestUrl.search}`);
      }

      if (LEGACY_STUDY_PATH.test(requestUrl.pathname)) {
        return reply.redirect(`/study${requestUrl.pathname}${requestUrl.search}`);
      }

      if (requestUrl.pathname === "/study" || requestUrl.pathname.startsWith("/study/")) {
        return reply.type("text/html; charset=utf-8").sendFile("index.html");
      }

      return reply.status(404).type("text/plain; charset=utf-8").send("页面不存在");
    });
  }

  await app.ready();
  return app;
}

function registerApiRoutes(app, db, storage, captchaFactory, materialsEnabled) {
  const loginFailures = new Map();
  const ipLoginFailures = new Map();
  const captchaChallenges = new Map();
  const captchaIssues = new Map();
  const loginFailureWindowMs = 15 * 60 * 1000;
  const captchaIssueWindowMs = 10 * 60 * 1000;
  const maxCaptchaIssuesPerWindow = 30;

  app.get("/api/health", async () => {
    const database = db.prepare("SELECT 1 AS ok").get();
    return {
      status: database.ok === 1 ? "ok" : "degraded",
      storage: storage ? "configured" : "not_configured",
      capabilities: {
        materials: materialsEnabled ? "enabled" : "disabled",
      },
      time: new Date().toISOString(),
    };
  });

  app.get("/api/auth/captcha", async (request, reply) => {
    const nowMs = Date.now();
    pruneExpiredState(nowMs);

    const currentIssue = captchaIssues.get(request.ip);
    const withinWindow =
      currentIssue && nowMs - currentIssue.windowStartedAt < captchaIssueWindowMs;
    const issueCount = withinWindow ? currentIssue.count : 0;
    if (issueCount >= maxCaptchaIssuesPerWindow) {
      const retryAfterSeconds = Math.ceil(
        (currentIssue.windowStartedAt + captchaIssueWindowMs - nowMs) / 1000,
      );
      reply.header("Retry-After", Math.max(retryAfterSeconds, 1));
      throw httpError(429, "图片选择码请求过于频繁，请稍后再试");
    }

    captchaIssues.set(request.ip, {
      count: issueCount + 1,
      windowStartedAt: withinWindow ? currentIssue.windowStartedAt : nowMs,
    });

    const challenge = captchaFactory(nowMs);
    captchaChallenges.set(challenge.id, { ...challenge, ip: request.ip });
    reply.header("Cache-Control", "no-store");
    return {
      id: challenge.id,
      prompt: challenge.prompt,
      options: challenge.options,
      expiresInSeconds: Math.ceil((challenge.expiresAt - nowMs) / 1000),
    };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const input = parseOrThrow(loginSchema, request.body);
    const nowMs = Date.now();
    pruneExpiredState(nowMs);
    const throttleKey = `${request.ip}:${input.username.toLocaleLowerCase("en-US")}`;
    const currentFailure = loginFailures.get(throttleKey);
    const currentIpFailure = ipLoginFailures.get(request.ip);
    const blockedUntil = Math.max(
      currentFailure?.blockedUntil ?? 0,
      currentIpFailure?.blockedUntil ?? 0,
    );
    if (blockedUntil > nowMs) {
      reply.header("Retry-After", Math.ceil((blockedUntil - nowMs) / 1000));
      throw httpError(429, "登录尝试过多，请稍后再试");
    }

    const challenge = captchaChallenges.get(input.captchaId);
    if (challenge) captchaChallenges.delete(input.captchaId);
    const captchaValid =
      challenge &&
      challenge.expiresAt > nowMs &&
      challenge.ip === request.ip &&
      challenge.correctOptionId === input.captchaOptionId;
    if (!captchaValid) {
      throw httpError(400, "图片选择码已失效或选择不正确，请重新选择");
    }

    const row = db
      .prepare(
        `SELECT id, username, display_name, password_hash, password_salt,
                is_admin, is_active, created_at
         FROM users
         WHERE username = ? AND is_active = 1`,
      )
      .get(input.username);
    const valid = row
      ? await verifyPassword(input.password, row.password_salt, row.password_hash)
      : (await verifyPassword(input.password, "00000000000000000000000000000000", "00".repeat(64)), false);

    if (!valid) {
      recordLoginFailure(loginFailures, throttleKey, currentFailure, 5, nowMs);
      recordLoginFailure(ipLoginFailures, request.ip, currentIpFailure, 20, nowMs);
      throw httpError(401, "用户名或密码错误");
    }

    loginFailures.delete(throttleKey);
    ipLoginFailures.delete(request.ip);
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
    const session = createSessionRecord(row.id);
    const replacedSessionCount = replaceUserSession(db, session);
    request.log.info(
      { userId: row.id, replacedSessionCount },
      "user session replaced after successful login",
    );
    setSessionCookie(reply, session.token, request);
    return { user: mapUser(db, row) };
  });

  function recordLoginFailure(target, key, current, limit, nowMs) {
    const withinWindow =
      current && nowMs - current.windowStartedAt < loginFailureWindowMs;
    const failures = withinWindow ? current.failures + 1 : 1;
    target.set(key, {
      failures,
      windowStartedAt: withinWindow ? current.windowStartedAt : nowMs,
      blockedUntil: failures >= limit ? nowMs + loginFailureWindowMs : 0,
    });
  }

  function pruneExpiredState(nowMs) {
    for (const [id, challenge] of captchaChallenges) {
      if (challenge.expiresAt <= nowMs) captchaChallenges.delete(id);
    }
    for (const [key, failure] of loginFailures) {
      if (nowMs - failure.windowStartedAt >= loginFailureWindowMs) loginFailures.delete(key);
    }
    for (const [key, failure] of ipLoginFailures) {
      if (nowMs - failure.windowStartedAt >= loginFailureWindowMs) ipLoginFailures.delete(key);
    }
    for (const [ip, issue] of captchaIssues) {
      if (nowMs - issue.windowStartedAt >= captchaIssueWindowMs) captchaIssues.delete(ip);
    }
  }

  app.get("/api/auth/me", async (request) => {
    const user = requireUser(db, request);
    return { user: mapUser(db, user) };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    deleteCurrentSession(db, request);
    clearSessionCookie(reply, request);
    reply.status(204);
    return reply.send();
  });

  app.get("/api/admin/users", async (request) => {
    requireAdmin(db, request);
    return {
      modules: getModuleCatalog(db),
      users: getAdminUsers(db),
    };
  });

  app.post("/api/admin/users", async (request, reply) => {
    const actor = requireAdmin(db, request);
    const input = parseOrThrow(adminUserCreateSchema, request.body);
    assertKnownModuleIds(db, input.moduleIds);

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(input.username);
    if (existing) {
      throw httpError(409, "这个用户名已经存在");
    }

    const passwordRecord = await hashPassword(input.password);
    const userId = randomUUID();
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO users (
           id, username, display_name, password_hash, password_salt,
           is_admin, is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(
        userId,
        input.username,
        input.displayName,
        passwordRecord.hash,
        passwordRecord.salt,
        input.isAdmin ? 1 : 0,
        now,
        now,
      );
      replaceModuleAssignments(db, userId, input.moduleIds, actor.id, now);
      recordAdminAudit(db, {
        actorUserId: actor.id,
        action: "user.created",
        targetUserId: userId,
        details: {
          username: input.username,
          displayName: input.displayName,
          isAdmin: input.isAdmin,
          moduleIds: input.moduleIds,
        },
        requestId: request.id,
        createdAt: now,
      });
    })();

    request.log.info(
      { actorUserId: actor.id, targetUserId: userId, moduleIds: input.moduleIds },
      "administrator created user",
    );
    reply.status(201);
    return { user: getAdminUser(db, userId) };
  });

  app.put("/api/admin/users/:id", async (request) => {
    const actor = requireAdmin(db, request);
    const input = parseOrThrow(adminUserUpdateSchema, request.body);
    assertKnownModuleIds(db, input.moduleIds);

    const target = db
      .prepare(
        `SELECT id, username, display_name, is_admin, is_active
         FROM users
         WHERE id = ?`,
      )
      .get(request.params.id);
    if (!target) {
      throw httpError(404, "账号不存在");
    }
    if (target.id === actor.id && (!input.isAdmin || !input.isActive)) {
      throw httpError(409, "不能取消自己的管理员身份或停用自己的账号");
    }
    assertAdminContinuity(db, target, input);

    const passwordRecord = input.password ? await hashPassword(input.password) : null;
    const now = new Date().toISOString();
    const previousModuleIds = getModuleIds(db, target.id);
    const invalidateSessions =
      (target.is_active === 1 && !input.isActive) || passwordRecord !== null;
    db.transaction(() => {
      if (passwordRecord) {
        db.prepare(
          `UPDATE users
           SET display_name = ?, password_hash = ?, password_salt = ?,
               is_admin = ?, is_active = ?, updated_at = ?
           WHERE id = ?`,
        ).run(
          input.displayName,
          passwordRecord.hash,
          passwordRecord.salt,
          input.isAdmin ? 1 : 0,
          input.isActive ? 1 : 0,
          now,
          target.id,
        );
      } else {
        db.prepare(
          `UPDATE users
           SET display_name = ?, is_admin = ?, is_active = ?, updated_at = ?
           WHERE id = ?`,
        ).run(
          input.displayName,
          input.isAdmin ? 1 : 0,
          input.isActive ? 1 : 0,
          now,
          target.id,
        );
      }
      replaceModuleAssignments(db, target.id, input.moduleIds, actor.id, now);
      if (invalidateSessions) {
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(target.id);
      }
      recordAdminAudit(db, {
        actorUserId: actor.id,
        action: "user.updated",
        targetUserId: target.id,
        details: {
          displayName: { from: target.display_name, to: input.displayName },
          isAdmin: { from: target.is_admin === 1, to: input.isAdmin },
          isActive: { from: target.is_active === 1, to: input.isActive },
          moduleIds: { from: previousModuleIds, to: input.moduleIds },
          passwordChanged: passwordRecord !== null,
          sessionsInvalidated: invalidateSessions,
        },
        requestId: request.id,
        createdAt: now,
      });
    })();

    request.log.info(
      {
        actorUserId: actor.id,
        targetUserId: target.id,
        moduleIds: input.moduleIds,
        passwordChanged: passwordRecord !== null,
        sessionsInvalidated: invalidateSessions,
      },
      "administrator updated user",
    );
    return { user: getAdminUser(db, target.id), sessionsInvalidated: invalidateSessions };
  });

  app.delete("/api/admin/users/:id", async (request, reply) => {
    const actor = requireAdmin(db, request);
    const target = db
      .prepare("SELECT id, username, is_admin, is_active FROM users WHERE id = ?")
      .get(request.params.id);
    if (!target) {
      throw httpError(404, "账号不存在");
    }
    if (target.id === actor.id) {
      throw httpError(409, "不能删除当前登录的账号");
    }
    assertAdminContinuity(db, target, { isAdmin: false, isActive: false });

    const learningRecords = getUserLearningRecordCounts(db, target.id);
    if (learningRecords.total > 0) {
      throw httpError(
        409,
        `该账号已有 ${learningRecords.total} 条学习记录。为保留成绩和练习数据，请改为停用账号`,
      );
    }

    const now = new Date().toISOString();
    db.transaction(() => {
      recordAdminAudit(db, {
        actorUserId: actor.id,
        action: "user.deleted",
        targetUserId: target.id,
        details: { username: target.username },
        requestId: request.id,
        createdAt: now,
      });
      db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
    })();
    request.log.info(
      { actorUserId: actor.id, targetUserId: target.id, username: target.username },
      "administrator deleted user",
    );
    reply.status(204);
    return reply.send();
  });

  app.get("/api/dashboard", async (request) => {
    const user = requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const materialCount = materialsEnabled
      ? db.prepare("SELECT COUNT(*) AS count FROM materials WHERE status = 'published'").get().count
      : 0;
    const examCount = db
      .prepare("SELECT COUNT(*) AS count FROM exams WHERE status = 'published'")
      .get().count;
    const attemptStats = db
      .prepare(
        `SELECT COUNT(*) AS count, ROUND(AVG(score)) AS average_score,
                MAX(score) AS best_score
         FROM attempts
         WHERE user_id = ?`,
      )
      .get(user.id);
    const mistakeCount = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM (
           SELECT aa.question_id
           FROM attempt_answers aa
           JOIN attempts a ON a.id = aa.attempt_id
           WHERE a.user_id = ?
           GROUP BY aa.question_id
           HAVING SUM(CASE WHEN aa.is_correct = 0 THEN 1 ELSE 0 END) > 0
         )`,
      )
      .get(user.id).count;
    const recentAttempt = db
      .prepare(
        `SELECT a.id, a.exam_id, e.title AS exam_title, a.score,
                a.correct_count, a.wrong_count, a.total_questions,
                a.duration_seconds, e.passing_score, a.submitted_at
         FROM attempts a
         JOIN exams e ON e.id = a.exam_id
         WHERE a.user_id = ?
         ORDER BY a.submitted_at DESC
         LIMIT 1`,
      )
      .get(user.id);

    return {
      materialCount,
      examCount,
      attemptCount: attemptStats.count,
      averageScore: attemptStats.average_score ?? 0,
      bestScore: attemptStats.best_score ?? 0,
      mistakeCount,
      recentAttempt: recentAttempt ? mapAttemptSummary(recentAttempt) : null,
    };
  });

  app.get("/api/english/listening", async (request) => {
    const user = requireModuleAccess(db, request, ENGLISH_MODULE_ID);
    const progressByScene = getListeningProgress(db, user.id);
    const scenes = englishListeningScenes.map((scene) => ({
      ...toPublicListeningScene(scene),
      progress: progressByScene.get(scene.id) ?? emptyListeningProgress(),
    }));
    const practicedScenes = scenes.filter((scene) => scene.progress.attemptCount > 0);

    return {
      scenes,
      soundReference: {
        sounds: englishPronunciationSounds.map(toPublicEnglishPronunciationSound),
        source: englishPronunciationSource,
      },
      summary: {
        sceneCount: scenes.length,
        practicedSceneCount: practicedScenes.length,
        masteredSceneCount: practicedScenes.filter((scene) => scene.progress.bestScore === 100).length,
        totalAttemptCount: practicedScenes.reduce(
          (sum, scene) => sum + scene.progress.attemptCount,
          0,
        ),
      },
    };
  });

  app.get("/api/english/listening/:sceneId", async (request) => {
    const user = requireModuleAccess(db, request, ENGLISH_MODULE_ID);
    const scene = getEnglishListeningScene(request.params.sceneId);
    if (!scene) {
      throw httpError(404, "听力场景不存在");
    }

    return {
      scene: {
        ...toPublicListeningScene(scene, { includeQuestions: true }),
        progress: getListeningProgress(db, user.id).get(scene.id) ?? emptyListeningProgress(),
      },
    };
  });

  app.get("/api/english/listening/:sceneId/audio", async (request, reply) => {
    requireModuleAccess(db, request, ENGLISH_MODULE_ID);
    const scene = getEnglishListeningScene(request.params.sceneId);
    if (!scene) {
      throw httpError(404, "听力场景不存在");
    }
    return sendPrivateMp3({
      request,
      reply,
      storage,
      objectKey: scene.audioObjectKey,
      resourceContext: { sceneId: scene.id },
      displayName: scene.chineseTitle,
      userFacingLabel: "真人听力音频",
      logLabel: "listening audio",
    });
  });

  app.get("/api/english/pronunciation/:soundId/audio", async (request, reply) => {
    requireModuleAccess(db, request, ENGLISH_MODULE_ID);
    const sound = getEnglishPronunciationSound(request.params.soundId);
    if (!sound) {
      throw httpError(404, "发音参考不存在");
    }
    return sendPrivateMp3({
      request,
      reply,
      storage,
      objectKey: sound.audioObjectKey,
      resourceContext: { soundId: sound.id },
      displayName: sound.cue,
      userFacingLabel: "真人发音音频",
      logLabel: "pronunciation audio",
    });
  });

  app.post("/api/english/listening/:sceneId/submissions", async (request, reply) => {
    const user = requireModuleAccess(db, request, ENGLISH_MODULE_ID);
    const input = parseOrThrow(listeningSubmissionSchema, request.body);
    const scene = getEnglishListeningScene(request.params.sceneId);
    if (!scene) {
      throw httpError(404, "听力场景不存在");
    }

    const duplicateQuestionIds = findDuplicates(input.answers.map((answer) => answer.questionId));
    if (duplicateQuestionIds.length > 0) {
      throw httpError(400, `听力答案包含重复题目：${duplicateQuestionIds.join(", ")}`);
    }

    const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.optionId]));
    const expectedQuestionIds = new Set(scene.questions.map((question) => question.id));
    const unknownQuestionIds = [...answerMap.keys()].filter((id) => !expectedQuestionIds.has(id));
    if (unknownQuestionIds.length > 0) {
      throw httpError(400, `听力答案包含未知题目：${unknownQuestionIds.join(", ")}`);
    }
    const missingQuestionIds = scene.questions
      .map((question) => question.id)
      .filter((id) => !answerMap.has(id));
    if (missingQuestionIds.length > 0) {
      throw httpError(400, `请完成全部 ${scene.questions.length} 道听力题`);
    }

    const gradedAnswers = scene.questions.map((question) => {
      const selectedOptionId = answerMap.get(question.id);
      const validOption = question.options.some((option) => option.id === selectedOptionId);
      if (!validOption) {
        throw httpError(400, `题目 ${question.id} 包含无效选项：${selectedOptionId}`);
      }
      return {
        questionId: question.id,
        selectedOptionId,
        correctOptionId: question.correctOptionId,
        isCorrect: selectedOptionId === question.correctOptionId,
        explanation: question.explanation,
      };
    });

    const correctCount = gradedAnswers.filter((answer) => answer.isCorrect).length;
    const score = Math.round((correctCount / scene.questions.length) * 100);
    const id = randomUUID();
    const submittedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO listening_attempts (
         id, user_id, scene_id, accent, answers_json, score, correct_count,
         total_questions, listen_count, duration_seconds, submitted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      user.id,
      scene.id,
      input.accent,
      JSON.stringify(input.answers),
      score,
      correctCount,
      scene.questions.length,
      input.listenCount,
      input.durationSeconds,
      submittedAt,
    );

    request.log.info(
      { userId: user.id, sceneId: scene.id, listeningAttemptId: id, score },
      "listening practice submitted",
    );
    reply.status(201);
    return {
      id,
      sceneId: scene.id,
      score,
      correctCount,
      totalQuestions: scene.questions.length,
      listenCount: input.listenCount,
      durationSeconds: input.durationSeconds,
      submittedAt,
      answers: gradedAnswers,
      transcript: scene.transcript,
    };
  });

  app.get("/api/materials", async (request) => {
    requireMaterialsEnabled(materialsEnabled);
    requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const query = parseOrThrow(
      z.object({
        search: z.string().max(100).optional(),
        category: z.string().max(80).optional(),
      }),
      request.query,
    );
    const conditions = ["status = 'published'"];
    const params = [];

    if (query.search?.trim()) {
      conditions.push("(title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')");
      const term = `%${escapeLike(query.search.trim())}%`;
      params.push(term, term);
    }

    if (query.category?.trim()) {
      conditions.push("category = ?");
      params.push(query.category.trim());
    }

    const materials = db
      .prepare(
        `SELECT id, title, summary, category, estimated_minutes, updated_at,
                (SELECT id FROM assets
                 WHERE material_id = materials.id AND role = 'cover'
                 LIMIT 1) AS cover_asset_id
         FROM materials
         WHERE ${conditions.join(" AND ")}
         ORDER BY updated_at DESC, title ASC`,
      )
      .all(...params)
      .map(mapMaterialSummary);
    const categories = db
      .prepare(
        `SELECT category, COUNT(*) AS count
         FROM materials
         WHERE status = 'published'
         GROUP BY category
         ORDER BY category ASC`,
      )
      .all();

    return { materials, categories };
  });

  app.get("/api/materials/:id", async (request) => {
    requireMaterialsEnabled(materialsEnabled);
    requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const material = db
      .prepare(
        `SELECT id, title, summary, content, category, estimated_minutes, updated_at,
                (SELECT id FROM assets
                 WHERE material_id = materials.id AND role = 'cover'
                 LIMIT 1) AS cover_asset_id
         FROM materials
         WHERE id = ? AND status = 'published'`,
      )
      .get(request.params.id);

    if (!material) {
      throw httpError(404, "学习资料不存在或尚未发布");
    }

    const attachments = db
      .prepare(
        `SELECT id, title, file_name, content_type, size_bytes
         FROM assets
         WHERE material_id = ? AND role = 'attachment'
         ORDER BY created_at ASC, id ASC`,
      )
      .all(material.id)
      .map((asset) => ({
        id: asset.id,
        title: asset.title,
        fileName: asset.file_name,
        contentType: asset.content_type,
        sizeBytes: asset.size_bytes,
        url: `/api/assets/${encodeURIComponent(asset.id)}`,
      }));

    return {
      ...mapMaterialSummary(material),
      content: material.content,
      attachments,
    };
  });

  app.get("/api/assets/:id", async (request, reply) => {
    requireMaterialsEnabled(materialsEnabled);
    requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const asset = db
      .prepare(
        `SELECT id, object_key, file_name, content_type, size_bytes
         FROM assets
         WHERE id = ?`,
      )
      .get(request.params.id);

    if (!asset) {
      throw httpError(404, "附件不存在");
    }

    if (!storage) {
      throw httpError(503, "附件存储尚未配置");
    }

    const objectStream = await storage.client.getObject(storage.bucket, asset.object_key);
    reply
      .header("Content-Type", asset.content_type)
      .header("Content-Length", asset.size_bytes)
      .header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(asset.file_name)}`)
      .header("Cache-Control", "private, max-age=3600");
    return reply.send(objectStream);
  });

  app.get("/api/exams", async (request) => {
    requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const exams = db
      .prepare(
        `SELECT e.id, e.title, e.description, e.duration_minutes,
                e.passing_score, e.series_id, e.series_title,
                e.series_description, e.series_order, e.paper_order,
                e.updated_at, COUNT(q.id) AS question_count,
                COALESCE(SUM(q.points), 0) AS total_points
         FROM exams e
         LEFT JOIN questions q ON q.exam_id = e.id
         WHERE e.status = 'published'
         GROUP BY e.id
         ORDER BY e.series_order ASC, e.paper_order ASC, e.updated_at DESC, e.title ASC`,
      )
      .all()
      .map(mapExamSummary);

    return { exams };
  });

  app.get("/api/exams/:id", async (request) => {
    requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const exam = getExam(db, request.params.id, false);

    if (!exam) {
      throw httpError(404, "模拟考试不存在或尚未发布");
    }

    return exam;
  });

  app.post("/api/exams/:id/submissions", async (request, reply) => {
    const user = requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const input = parseOrThrow(submissionSchema, request.body);
    const exam = getExam(db, request.params.id, true);

    if (!exam) {
      throw httpError(404, "模拟考试不存在或尚未发布");
    }

    if (exam.questions.length === 0) {
      throw httpError(409, "这套试卷尚未配置题目，无法提交");
    }

    const duplicateQuestionIds = findDuplicates(input.answers.map((answer) => answer.questionId));
    if (duplicateQuestionIds.length > 0) {
      throw httpError(400, `答题数据包含重复题目：${duplicateQuestionIds.join(", ")}`);
    }

    const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.optionIds]));
    const knownQuestionIds = new Set(exam.questions.map((question) => question.id));
    const unknownQuestionIds = [...answerMap.keys()].filter((id) => !knownQuestionIds.has(id));
    if (unknownQuestionIds.length > 0) {
      throw httpError(400, `答题数据包含不属于这套试卷的题目：${unknownQuestionIds.join(", ")}`);
    }

    let earnedPoints = 0;
    let correctCount = 0;
    const gradedAnswers = exam.questions.map((question) => {
      const selectedOptionIds = answerMap.get(question.id) ?? [];
      const duplicateOptionIds = findDuplicates(selectedOptionIds);
      if (duplicateOptionIds.length > 0) {
        throw httpError(400, `题目 ${question.id} 包含重复选项`);
      }

      const validOptionIds = new Set(question.options.map((option) => option.id));
      const invalidOptionIds = selectedOptionIds.filter((id) => !validOptionIds.has(id));
      if (invalidOptionIds.length > 0) {
        throw httpError(400, `题目 ${question.id} 包含无效选项：${invalidOptionIds.join(", ")}`);
      }

      const correctOptionIds = question.options
        .filter((option) => option.correct)
        .map((option) => option.id);
      const isCorrect = sameSet(selectedOptionIds, correctOptionIds);
      const hasWrongSelection = selectedOptionIds.some((id) => !correctOptionIds.includes(id));
      const questionPoints = isCorrect
        ? question.points
        : question.type === "multiple" && !hasWrongSelection
          ? Math.min(question.points, selectedOptionIds.length * 0.5)
          : 0;

      if (isCorrect) {
        correctCount += 1;
      }
      earnedPoints += questionPoints;

      return {
        questionId: question.id,
        selectedOptionIds,
        correctOptionIds,
        isCorrect,
        earnedPoints: questionPoints,
      };
    });

    const totalPoints = exam.questions.reduce((sum, question) => sum + question.points, 0);
    const score = Math.round((earnedPoints / totalPoints) * 100);
    const attemptId = randomUUID();
    const submittedAt = new Date().toISOString();
    const startedAt = input.startedAt ?? submittedAt;

    db.transaction(() => {
      db.prepare(
        `INSERT INTO attempts (
           id, device_id, user_id, exam_id, score, correct_count, wrong_count,
           total_questions, duration_seconds, started_at, submitted_at
         ) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        attemptId,
        user.id,
        exam.id,
        score,
        correctCount,
        exam.questions.length - correctCount,
        exam.questions.length,
        input.durationSeconds,
        startedAt,
        submittedAt,
      );

      const insertAnswer = db.prepare(
        `INSERT INTO attempt_answers (
           attempt_id, question_id, selected_option_ids, is_correct, earned_points
         ) VALUES (?, ?, ?, ?, ?)`,
      );

      for (const answer of gradedAnswers) {
        insertAnswer.run(
          attemptId,
          answer.questionId,
          JSON.stringify(answer.selectedOptionIds),
          answer.isCorrect ? 1 : 0,
          answer.earnedPoints,
        );
      }
    })();

    reply.status(201);
    return getAttemptDetails(db, attemptId, user.id);
  });

  app.get("/api/results", async (request) => {
    const user = requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const results = db
      .prepare(
        `SELECT a.id, a.exam_id, e.title AS exam_title, a.score,
                a.correct_count, a.wrong_count, a.total_questions,
                a.duration_seconds, a.submitted_at, e.passing_score
         FROM attempts a
         JOIN exams e ON e.id = a.exam_id
         WHERE a.user_id = ?
         ORDER BY a.submitted_at DESC
         LIMIT 200`,
      )
      .all(user.id)
      .map(mapAttemptSummary);

    return { results };
  });

  app.get("/api/results/:id", async (request) => {
    const user = requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const result = getAttemptDetails(db, request.params.id, user.id);

    if (!result) {
      throw httpError(404, "考试记录不存在或不属于当前用户");
    }

    return result;
  });

  app.get("/api/mistakes", async (request) => {
    const user = requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const rows = db
      .prepare(
        `WITH answer_history AS (
           SELECT q.id AS question_id, q.prompt, q.explanation, q.type,
                  e.id AS exam_id, e.title AS exam_title,
                  aa.is_correct, a.submitted_at,
                  ROW_NUMBER() OVER (
                    PARTITION BY q.id
                    ORDER BY a.submitted_at DESC, a.id DESC
                  ) AS recency
           FROM attempt_answers aa
           JOIN attempts a ON a.id = aa.attempt_id
           JOIN questions q ON q.id = aa.question_id
           JOIN exams e ON e.id = q.exam_id
           WHERE a.user_id = ?
         ),
         practice_stats AS (
           SELECT question_id, COUNT(*) AS practice_count,
                  MAX(submitted_at) AS last_practiced_at,
                  MAX(is_correct) AS relearned
           FROM mistake_practice_attempts
           WHERE user_id = ?
           GROUP BY question_id
         )
         SELECT ah.question_id, ah.prompt, ah.explanation, ah.type, ah.exam_id, ah.exam_title,
                SUM(CASE WHEN ah.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
                SUM(CASE WHEN ah.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
                MAX(CASE WHEN ah.is_correct = 0 THEN ah.submitted_at END) AS last_wrong_at,
                MAX(CASE WHEN ah.recency = 1 THEN ah.is_correct END) AS latest_is_correct,
                COALESCE(MAX(ps.practice_count), 0) AS practice_count,
                MAX(ps.last_practiced_at) AS last_practiced_at,
                COALESCE(MAX(ps.relearned), 0) AS relearned
         FROM answer_history ah
         LEFT JOIN practice_stats ps ON ps.question_id = ah.question_id
         GROUP BY ah.question_id, ah.prompt, ah.explanation, ah.type, ah.exam_id, ah.exam_title
         HAVING SUM(CASE WHEN ah.is_correct = 0 THEN 1 ELSE 0 END) > 0
         ORDER BY last_wrong_at DESC`,
      )
      .all(user.id, user.id);
    const optionsStatement = db.prepare(
      `SELECT id, label, content
       FROM question_options
       WHERE question_id = ? AND is_correct = 1
       ORDER BY position ASC`,
    );

    return {
      mistakes: rows.map((row) => ({
        questionId: row.question_id,
        prompt: row.prompt,
        explanation: row.explanation,
        type: row.type,
        examId: row.exam_id,
        examTitle: row.exam_title,
        wrongCount: row.wrong_count,
        correctCount: row.correct_count,
        lastWrongAt: row.last_wrong_at,
        corrected: row.latest_is_correct === 1,
        practiceCount: row.practice_count,
        lastPracticedAt: row.last_practiced_at,
        relearned: row.relearned === 1,
        correctOptions: optionsStatement.all(row.question_id),
      })),
    };
  });

  app.get("/api/mistakes/practice", async (request) => {
    const user = requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const rows = db
      .prepare(
        `WITH mistake_history AS (
           SELECT q.id AS question_id, q.prompt, q.type, q.section, q.passage,
                  q.points, e.id AS exam_id, e.title AS exam_title,
                  aa.is_correct, a.submitted_at
           FROM attempt_answers aa
           JOIN attempts a ON a.id = aa.attempt_id
           JOIN questions q ON q.id = aa.question_id
           JOIN exams e ON e.id = q.exam_id
           WHERE a.user_id = ?
         ),
         mistakes AS (
           SELECT question_id, prompt, type, section, passage, points,
                  exam_id, exam_title,
                  SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
                  MAX(CASE WHEN is_correct = 0 THEN submitted_at END) AS last_wrong_at
           FROM mistake_history
           GROUP BY question_id, prompt, type, section, passage, points, exam_id, exam_title
           HAVING SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) > 0
         ),
         practice_stats AS (
           SELECT question_id, COUNT(*) AS practice_count,
                  MAX(submitted_at) AS last_practiced_at,
                  MAX(is_correct) AS relearned
           FROM mistake_practice_attempts
           WHERE user_id = ?
           GROUP BY question_id
         )
         SELECT m.*, COALESCE(ps.practice_count, 0) AS practice_count,
                ps.last_practiced_at, COALESCE(ps.relearned, 0) AS relearned
         FROM mistakes m
         LEFT JOIN practice_stats ps ON ps.question_id = m.question_id
         ORDER BY relearned ASC, m.last_wrong_at DESC, m.question_id ASC`,
      )
      .all(user.id, user.id);
    const optionsStatement = db.prepare(
      `SELECT id, label, content
       FROM question_options
       WHERE question_id = ?
       ORDER BY position ASC`,
    );

    return {
      questions: rows.map((row) => ({
        questionId: row.question_id,
        prompt: row.prompt,
        type: row.type,
        section: row.section,
        passage: row.passage,
        points: row.points,
        examId: row.exam_id,
        examTitle: row.exam_title,
        wrongCount: row.wrong_count,
        lastWrongAt: row.last_wrong_at,
        practiceCount: row.practice_count,
        lastPracticedAt: row.last_practiced_at,
        relearned: row.relearned === 1,
        options: optionsStatement.all(row.question_id),
      })),
    };
  });

  app.post("/api/mistakes/:questionId/practice", async (request, reply) => {
    const user = requireModuleAccess(db, request, HUMAN_RESOURCES_MODULE_ID);
    const input = parseOrThrow(mistakePracticeSubmissionSchema, request.body);
    const question = db
      .prepare(
        `SELECT q.id, q.explanation
         FROM questions q
         WHERE q.id = ?
           AND EXISTS (
             SELECT 1
             FROM attempt_answers aa
             JOIN attempts a ON a.id = aa.attempt_id
             WHERE aa.question_id = q.id
               AND a.user_id = ?
               AND aa.is_correct = 0
           )`,
      )
      .get(request.params.questionId, user.id);

    if (!question) {
      throw httpError(404, "这道题不在当前用户的错题本中");
    }

    const duplicateOptionIds = findDuplicates(input.optionIds);
    if (duplicateOptionIds.length > 0) {
      throw httpError(400, `答题数据包含重复选项：${duplicateOptionIds.join(", ")}`);
    }

    const options = db
      .prepare(
        `SELECT id, label, content, is_correct
         FROM question_options
         WHERE question_id = ?
         ORDER BY position ASC`,
      )
      .all(question.id);
    const validOptionIds = new Set(options.map((option) => option.id));
    const invalidOptionIds = input.optionIds.filter((id) => !validOptionIds.has(id));
    if (invalidOptionIds.length > 0) {
      throw httpError(400, `答题数据包含不属于这道题的选项：${invalidOptionIds.join(", ")}`);
    }

    const correctOptionIds = options
      .filter((option) => option.is_correct === 1)
      .map((option) => option.id);
    const isCorrect = sameSet(input.optionIds, correctOptionIds);
    const practiceAttemptId = randomUUID();
    const submittedAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO mistake_practice_attempts (
         id, user_id, question_id, selected_option_ids, is_correct, submitted_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      practiceAttemptId,
      user.id,
      question.id,
      JSON.stringify(input.optionIds),
      isCorrect ? 1 : 0,
      submittedAt,
    );

    const practiceStats = db
      .prepare(
        `SELECT COUNT(*) AS practice_count, MAX(is_correct) AS relearned
         FROM mistake_practice_attempts
         WHERE user_id = ? AND question_id = ?`,
      )
      .get(user.id, question.id);
    request.log.info(
      {
        userId: user.id,
        questionId: question.id,
        practiceAttemptId,
        isCorrect,
        practiceCount: practiceStats.practice_count,
        relearned: practiceStats.relearned === 1,
      },
      "mistake practice answer recorded",
    );

    reply.status(201);
    return {
      id: practiceAttemptId,
      questionId: question.id,
      selectedOptionIds: input.optionIds,
      isCorrect,
      submittedAt,
      practiceCount: practiceStats.practice_count,
      relearned: practiceStats.relearned === 1,
      correctOptions: options
        .filter((option) => option.is_correct === 1)
        .map(({ id, label, content }) => ({ id, label, content })),
      explanation: question.explanation,
    };
  });
}

function getExam(db, examId, includeAnswers) {
  const exam = db
    .prepare(
      `SELECT id, title, description, duration_minutes, passing_score,
              series_id, series_title, series_description, series_order,
              paper_order, updated_at
       FROM exams
       WHERE id = ? AND status = 'published'`,
    )
    .get(examId);

  if (!exam) {
    return null;
  }

  const questionRows = db
    .prepare(
      `SELECT id, type, section, passage, prompt, explanation, position, points
       FROM questions
       WHERE exam_id = ?
       ORDER BY position ASC`,
    )
    .all(examId);
  const optionsStatement = db.prepare(
    `SELECT id, label, content, is_correct, position
     FROM question_options
     WHERE question_id = ?
     ORDER BY position ASC`,
  );

  return {
    ...mapExamSummary({
      ...exam,
      question_count: questionRows.length,
      total_points: questionRows.reduce((sum, question) => sum + question.points, 0),
    }),
    questions: questionRows.map((question) => ({
      id: question.id,
      type: question.type,
      section: question.section,
      passage: question.passage,
      prompt: question.prompt,
      points: question.points,
      ...(includeAnswers ? { explanation: question.explanation } : {}),
      options: optionsStatement.all(question.id).map((option) => ({
        id: option.id,
        label: option.label,
        content: option.content,
        ...(includeAnswers ? { correct: option.is_correct === 1 } : {}),
      })),
    })),
  };
}

function getAttemptDetails(db, attemptId, userId) {
  const attempt = db
    .prepare(
      `SELECT a.id, a.exam_id, e.title AS exam_title, a.score,
              a.correct_count, a.wrong_count, a.total_questions,
              a.duration_seconds, a.started_at, a.submitted_at,
              e.passing_score
       FROM attempts a
       JOIN exams e ON e.id = a.exam_id
       WHERE a.id = ? AND a.user_id = ?`,
    )
    .get(attemptId, userId);

  if (!attempt) {
    return null;
  }

  const answerRows = db
    .prepare(
      `SELECT aa.question_id, aa.selected_option_ids, aa.is_correct,
              aa.earned_points, q.prompt, q.explanation, q.type, q.section,
              q.passage, q.points
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = ?
       ORDER BY q.position ASC`,
    )
    .all(attemptId);
  const optionStatement = db.prepare(
    `SELECT id, label, content, is_correct
     FROM question_options
     WHERE question_id = ?
     ORDER BY position ASC`,
  );

  return {
    ...mapAttemptSummary(attempt),
    startedAt: attempt.started_at,
    answers: answerRows.map((answer) => ({
      questionId: answer.question_id,
      prompt: answer.prompt,
      explanation: answer.explanation,
      type: answer.type,
      section: answer.section,
      passage: answer.passage,
      points: answer.points,
      earnedPoints: answer.earned_points,
      isCorrect: answer.is_correct === 1,
      selectedOptionIds: parseSelectedOptions(answer.selected_option_ids, answer.question_id),
      options: optionStatement.all(answer.question_id).map((option) => ({
        id: option.id,
        label: option.label,
        content: option.content,
        correct: option.is_correct === 1,
      })),
    })),
  };
}

function parseSelectedOptions(value, questionId) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`Stored answer for question ${questionId} is invalid JSON: ${error.message}`);
  }

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error(`Stored answer for question ${questionId} is not a string array`);
  }

  return parsed;
}

function mapMaterialSummary(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    estimatedMinutes: row.estimated_minutes,
    updatedAt: row.updated_at,
    coverUrl: row.cover_asset_id
      ? `/api/assets/${encodeURIComponent(row.cover_asset_id)}`
      : null,
  };
}

function mapExamSummary(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    durationMinutes: row.duration_minutes,
    passingScore: row.passing_score,
    seriesId: row.series_id,
    seriesTitle: row.series_title,
    seriesDescription: row.series_description,
    seriesOrder: row.series_order,
    paperOrder: row.paper_order,
    questionCount: row.question_count,
    totalPoints: row.total_points,
    updatedAt: row.updated_at,
  };
}

function mapAttemptSummary(row) {
  return {
    id: row.id,
    examId: row.exam_id,
    examTitle: row.exam_title,
    score: row.score,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    totalQuestions: row.total_questions,
    durationSeconds: row.duration_seconds,
    passingScore: row.passing_score,
    submittedAt: row.submitted_at,
  };
}

function parseOrThrow(schema, value) {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      .join("；");
    throw httpError(400, `请求数据无效：${message}`);
  }
  return result.data;
}

function requireUser(db, request) {
  const user = getAuthenticatedUser(db, request);
  if (!user) {
    throw httpError(401, "请先登录后继续");
  }
  return user;
}

function requireAdmin(db, request) {
  const user = requireUser(db, request);
  if (user.is_admin !== 1) {
    throw httpError(403, "当前账号没有配置权限");
  }
  return user;
}

function requireModuleAccess(db, request, moduleId) {
  const user = requireUser(db, request);
  const access = db
    .prepare(
      `SELECT 1 AS allowed
       FROM user_module_access
       WHERE user_id = ? AND module_id = ?`,
    )
    .get(user.id, moduleId);
  if (!access) {
    throw httpError(403, "当前账号未开通这门课程");
  }
  return user;
}

function getModuleCatalog(db) {
  return db
    .prepare(
      `SELECT id, title, display_order
       FROM learning_modules
       ORDER BY display_order ASC, id ASC`,
    )
    .all()
    .map((module) => ({
      id: module.id,
      title: module.title,
      displayOrder: module.display_order,
    }));
}

function getModuleIds(db, userId) {
  return db
    .prepare(
      `SELECT access.module_id
       FROM user_module_access access
       JOIN learning_modules modules ON modules.id = access.module_id
       WHERE access.user_id = ?
       ORDER BY modules.display_order ASC, access.module_id ASC`,
    )
    .all(userId)
    .map((row) => row.module_id);
}

function assertKnownModuleIds(db, moduleIds) {
  const knownModuleIds = new Set(getModuleCatalog(db).map((module) => module.id));
  const unknownModuleIds = moduleIds.filter((moduleId) => !knownModuleIds.has(moduleId));
  if (unknownModuleIds.length > 0) {
    throw httpError(400, `包含不存在的课程：${unknownModuleIds.join(", ")}`);
  }
}

function replaceModuleAssignments(db, userId, moduleIds, actorUserId, assignedAt) {
  db.prepare("DELETE FROM user_module_access WHERE user_id = ?").run(userId);
  const insert = db.prepare(
    `INSERT INTO user_module_access (user_id, module_id, assigned_by, assigned_at)
     VALUES (?, ?, ?, ?)`,
  );
  for (const moduleId of moduleIds) {
    insert.run(userId, moduleId, actorUserId, assignedAt);
  }
}

function getAdminUsers(db) {
  return getAdminUserRows(db).map((row) => mapAdminUser(db, row));
}

function getAdminUser(db, userId) {
  const row = getAdminUserRows(db, userId)[0];
  if (!row) {
    throw new Error(`User ${userId} disappeared while serializing the administrator response`);
  }
  return mapAdminUser(db, row);
}

function getAdminUserRows(db, userId) {
  const condition = userId ? "WHERE users.id = ?" : "";
  return db
    .prepare(
      `SELECT users.id, users.username, users.display_name, users.is_admin,
              users.is_active, users.created_at, users.updated_at,
              (SELECT COUNT(*) FROM attempts WHERE attempts.user_id = users.id)
                AS exam_attempt_count,
              (SELECT COUNT(*) FROM listening_attempts WHERE listening_attempts.user_id = users.id)
                AS listening_attempt_count,
              (SELECT COUNT(*) FROM mistake_practice_attempts
               WHERE mistake_practice_attempts.user_id = users.id)
                AS mistake_practice_count,
              MAX(
                COALESCE((SELECT MAX(submitted_at) FROM attempts WHERE attempts.user_id = users.id), ''),
                COALESCE((SELECT MAX(submitted_at) FROM listening_attempts WHERE listening_attempts.user_id = users.id), ''),
                COALESCE((SELECT MAX(submitted_at) FROM mistake_practice_attempts WHERE mistake_practice_attempts.user_id = users.id), '')
              ) AS last_activity_at
       FROM users
       ${condition}
       ORDER BY users.created_at ASC, users.username COLLATE NOCASE ASC`,
    )
    .all(...(userId ? [userId] : []));
}

function mapAdminUser(db, row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    isActive: row.is_active === 1,
    moduleIds: getModuleIds(db, row.id),
    examAttemptCount: row.exam_attempt_count,
    listeningAttemptCount: row.listening_attempt_count,
    mistakePracticeCount: row.mistake_practice_count,
    lastActivityAt: row.last_activity_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getUserLearningRecordCounts(db, userId) {
  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM attempts WHERE user_id = ?) AS exam_attempts,
         (SELECT COUNT(*) FROM listening_attempts WHERE user_id = ?) AS listening_attempts,
         (SELECT COUNT(*) FROM mistake_practice_attempts WHERE user_id = ?)
           AS mistake_practice_attempts`,
    )
    .get(userId, userId, userId);
  return {
    examAttempts: counts.exam_attempts,
    listeningAttempts: counts.listening_attempts,
    mistakePracticeAttempts: counts.mistake_practice_attempts,
    total: counts.exam_attempts + counts.listening_attempts + counts.mistake_practice_attempts,
  };
}

function assertAdminContinuity(db, target, nextState) {
  const removesActiveAdmin =
    target.is_admin === 1 && target.is_active === 1 && (!nextState.isAdmin || !nextState.isActive);
  if (!removesActiveAdmin) return;

  const otherActiveAdmins = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM users
       WHERE is_admin = 1 AND is_active = 1 AND id <> ?`,
    )
    .get(target.id).count;
  if (otherActiveAdmins === 0) {
    throw httpError(409, "必须至少保留一个启用中的管理员账号");
  }
}

function recordAdminAudit(
  db,
  { actorUserId, action, targetUserId, details, requestId, createdAt },
) {
  db.prepare(
    `INSERT INTO admin_audit_log (
       id, actor_user_id, action, target_user_id, details_json, request_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    actorUserId,
    action,
    targetUserId,
    JSON.stringify(details),
    requestId,
    createdAt,
  );
}

function requireMaterialsEnabled(materialsEnabled) {
  if (!materialsEnabled) {
    throw httpError(404, "学习资料模块暂未开放");
  }
}

function getListeningProgress(db, userId) {
  const rows = db
    .prepare(
      `SELECT scene_id, score, submitted_at
       FROM listening_attempts
       WHERE user_id = ?
       ORDER BY submitted_at DESC, id DESC`,
    )
    .all(userId);
  const progress = new Map();
  for (const row of rows) {
    const existing = progress.get(row.scene_id);
    if (!existing) {
      progress.set(row.scene_id, {
        attemptCount: 1,
        bestScore: row.score,
        latestScore: row.score,
        lastPracticedAt: row.submitted_at,
      });
      continue;
    }
    existing.attemptCount += 1;
    existing.bestScore = Math.max(existing.bestScore, row.score);
  }
  return progress;
}

function emptyListeningProgress() {
  return {
    attemptCount: 0,
    bestScore: null,
    latestScore: null,
    lastPracticedAt: null,
  };
}

function parseBooleanEnvironment(name, rawValue, fallback) {
  if (rawValue === undefined || rawValue === "") return fallback;
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  throw new Error(
    `${name} must be either "true" or "false", received ${JSON.stringify(rawValue)}`,
  );
}

function httpError(statusCode, message, { expose = false, cause } = {}) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.statusCode = statusCode;
  error.expose = expose;
  return error;
}

function isMissingStorageObject(error) {
  return error && typeof error === "object"
    && ["NoSuchKey", "NoSuchObject", "NotFound"].includes(error.code);
}

async function sendPrivateMp3({
  request,
  reply,
  storage,
  objectKey,
  resourceContext,
  displayName,
  userFacingLabel,
  logLabel,
}) {
  if (!storage) {
    throw httpError(503, `${userFacingLabel}存储尚未配置，请联系管理员`, { expose: true });
  }

  let objectStat;
  try {
    objectStat = await storage.client.statObject(storage.bucket, objectKey);
  } catch (error) {
    request.log.error(
      { err: error, ...resourceContext, objectKey },
      `${logLabel} metadata lookup failed`,
    );
    if (isMissingStorageObject(error)) {
      throw httpError(503, `${userFacingLabel}尚未同步：${displayName}`, {
        expose: true,
        cause: error,
      });
    }
    throw httpError(502, `${userFacingLabel}读取失败：${displayName}`, {
      expose: true,
      cause: error,
    });
  }

  const size = Number(objectStat.size);
  if (!Number.isSafeInteger(size) || size <= 0) {
    request.log.error(
      { ...resourceContext, objectKey, reportedSize: objectStat.size },
      `${logLabel} has an invalid object size`,
    );
    throw httpError(502, `${userFacingLabel}文件无效：${displayName}`, { expose: true });
  }

  let byteRange;
  try {
    byteRange = parseByteRange(request.headers.range, size);
  } catch (error) {
    reply.header("Content-Range", `bytes */${size}`);
    throw error;
  }

  let objectStream;
  try {
    objectStream = byteRange.partial
      ? await storage.client.getPartialObject(
        storage.bucket,
        objectKey,
        byteRange.start,
        byteRange.length,
      )
      : await storage.client.getObject(storage.bucket, objectKey);
  } catch (error) {
    request.log.error(
      { err: error, ...resourceContext, objectKey, byteRange },
      `${logLabel} stream open failed`,
    );
    throw httpError(502, `${userFacingLabel}播放失败：${displayName}`, {
      expose: true,
      cause: error,
    });
  }

  objectStream.on("error", (error) => {
    request.log.error(
      { err: error, ...resourceContext, objectKey, byteRange },
      `${logLabel} stream failed`,
    );
  });

  reply
    .status(byteRange.partial ? 206 : 200)
    .header("Content-Type", "audio/mpeg")
    .header("Content-Length", byteRange.length)
    .header("Accept-Ranges", "bytes")
    .header("Cache-Control", "private, max-age=86400");
  if (byteRange.partial) {
    reply.header("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${size}`);
  }
  return reply.send(objectStream);
}

function parseByteRange(rangeHeader, size) {
  if (!rangeHeader) {
    return { partial: false, start: 0, end: size - 1, length: size };
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) {
    throw httpError(416, "音频范围请求无效");
  }

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number.parseInt(match[2], 10);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      throw httpError(416, "音频范围请求无效");
    }
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
  }

  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= size
  ) {
    throw httpError(416, "音频范围请求超出文件大小");
  }

  end = Math.min(end, size - 1);
  return { partial: true, start, end, length: end - start + 1 };
}

function sameSet(left, right) {
  return left.length === right.length && new Set(left).size === left.length && left.every((item) => right.includes(item));
}

function findDuplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => (seen.has(value) ? true : (seen.add(value), false))))];
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}
