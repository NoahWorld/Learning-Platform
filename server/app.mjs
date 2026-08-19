import fastifyStatic from "@fastify/static";
import fastifyHelmet from "@fastify/helmet";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  loginSchema,
  submissionSchema,
} from "./content-schema.mjs";
import {
  clearSessionCookie,
  createSessionRecord,
  deleteCurrentSession,
  getAuthenticatedUser,
  insertSession,
  mapUser,
  setSessionCookie,
  verifyPassword,
} from "./auth.mjs";
import { openDatabase } from "./db.mjs";
import { createStorage } from "./storage.mjs";

const DEFAULT_STATIC_DIR = fileURLToPath(new URL("../dist", import.meta.url));
const LEGACY_STUDY_PATH = /^\/(?:materials(?:\/.*)?|exams(?:\/.*)?|mistakes|results(?:\/.*)?)$/;

export async function createApp({
  databasePath = process.env.DATABASE_PATH ?? "./data/study-workbench.sqlite",
  logger = true,
  serveStatic = true,
  staticDir = DEFAULT_STATIC_DIR,
  storage = createStorage(),
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
      error: statusCode >= 500 ? "服务器暂时无法处理这个请求" : error.message,
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

  registerApiRoutes(app, db, storage);

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

function registerApiRoutes(app, db, storage) {
  const loginFailures = new Map();

  app.get("/api/health", async () => {
    const database = db.prepare("SELECT 1 AS ok").get();
    return {
      status: database.ok === 1 ? "ok" : "degraded",
      storage: storage ? "configured" : "not_configured",
      time: new Date().toISOString(),
    };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const input = parseOrThrow(loginSchema, request.body);
    const throttleKey = `${request.ip}:${input.username}`;
    const currentFailure = loginFailures.get(throttleKey);
    const nowMs = Date.now();
    if (currentFailure?.blockedUntil > nowMs) {
      reply.header("Retry-After", Math.ceil((currentFailure.blockedUntil - nowMs) / 1000));
      throw httpError(429, "登录尝试过多，请稍后再试");
    }

    const row = db
      .prepare(
        `SELECT id, username, display_name, password_hash, password_salt, created_at
         FROM users
         WHERE username = ?`,
      )
      .get(input.username);
    const valid = row
      ? await verifyPassword(input.password, row.password_salt, row.password_hash)
      : (await verifyPassword(input.password, "00000000000000000000000000000000", "00".repeat(64)), false);

    if (!valid) {
      const failureWindowMs = 15 * 60 * 1000;
      const withinWindow = currentFailure && nowMs - currentFailure.windowStartedAt < failureWindowMs;
      const failures = withinWindow ? currentFailure.failures + 1 : 1;
      loginFailures.set(throttleKey, {
        failures,
        windowStartedAt: withinWindow ? currentFailure.windowStartedAt : nowMs,
        blockedUntil: failures >= 5 ? nowMs + failureWindowMs : 0,
      });
      throw httpError(401, "用户名或密码错误");
    }

    loginFailures.delete(throttleKey);
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
    const session = createSessionRecord(row.id);
    insertSession(db, session);
    setSessionCookie(reply, session.token, request);
    return { user: mapUser(row) };
  });

  app.get("/api/auth/me", async (request) => {
    const user = requireUser(db, request);
    return { user: mapUser(user) };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    deleteCurrentSession(db, request);
    clearSessionCookie(reply, request);
    reply.status(204);
    return reply.send();
  });

  app.get("/api/dashboard", async (request) => {
    const user = requireUser(db, request);
    const materialCount = db
      .prepare("SELECT COUNT(*) AS count FROM materials WHERE status = 'published'")
      .get().count;
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

  app.get("/api/materials", async (request) => {
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

  app.get("/api/exams", async () => {
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
    const exam = getExam(db, request.params.id, false);

    if (!exam) {
      throw httpError(404, "模拟考试不存在或尚未发布");
    }

    return exam;
  });

  app.post("/api/exams/:id/submissions", async (request, reply) => {
    const user = requireUser(db, request);
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
    const user = requireUser(db, request);
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
    const user = requireUser(db, request);
    const result = getAttemptDetails(db, request.params.id, user.id);

    if (!result) {
      throw httpError(404, "考试记录不存在或不属于当前用户");
    }

    return result;
  });

  app.get("/api/mistakes", async (request) => {
    const user = requireUser(db, request);
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
         )
         SELECT question_id, prompt, explanation, type, exam_id, exam_title,
                SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
                MAX(CASE WHEN is_correct = 0 THEN submitted_at END) AS last_wrong_at,
                MAX(CASE WHEN recency = 1 THEN is_correct END) AS latest_is_correct
         FROM answer_history
         GROUP BY question_id, prompt, explanation, type, exam_id, exam_title
         HAVING SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) > 0
         ORDER BY last_wrong_at DESC`,
      )
      .all(user.id);
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
        correctOptions: optionsStatement.all(row.question_id),
      })),
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

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
