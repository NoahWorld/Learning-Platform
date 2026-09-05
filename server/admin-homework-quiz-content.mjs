import { readFileSync } from "node:fs";
import {
  adminHomeworkChapters,
  adminHomeworkQuestionAssets,
} from "./admin-homework-content.mjs";
import { contentSchema } from "./content-schema.mjs";

const CONTENT_URL = new URL("./admin-homework-questions.json", import.meta.url);

function readQuizContent() {
  let raw;
  try {
    raw = readFileSync(CONTENT_URL, "utf8");
  } catch (error) {
    throw new Error(`Unable to read administrator homework questions at ${CONTENT_URL.pathname}`, {
      cause: error,
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Administrator homework questions are not valid JSON: ${error.message}`, {
      cause: error,
    });
  }

  const result = contentSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Administrator homework questions failed schema validation: ${result.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  if (result.data.materials.length !== 0 || result.data.assets.length !== 0) {
    throw new Error("Administrator homework question data must contain exams only");
  }
  return result.data.exams;
}

export const adminHomeworkExams = Object.freeze(readQuizContent());

validateQuizContent(adminHomeworkExams);

export function getAdminHomeworkExam(chapterId) {
  const chapter = adminHomeworkChapters.find((item) => item.id === chapterId);
  if (!chapter) return null;
  return adminHomeworkExams.find((exam) => exam.paperOrder === chapter.chapterNumber) ?? null;
}

export function getAdminHomeworkChapterForExam(examId) {
  const exam = adminHomeworkExams.find((item) => item.id === examId);
  if (!exam) return null;
  return adminHomeworkChapters.find((item) => item.chapterNumber === exam.paperOrder) ?? null;
}

function validateQuizContent(exams) {
  if (exams.length !== adminHomeworkChapters.length) {
    throw new Error(
      `Administrator homework must contain ${adminHomeworkChapters.length} chapter exams; received ${exams.length}`,
    );
  }

  const questionIds = new Set();
  for (const chapter of adminHomeworkChapters) {
    const exam = exams.find((item) => item.paperOrder === chapter.chapterNumber);
    const expectedExamId = `hr-admin-homework-${chapter.id}`;
    if (!exam) {
      throw new Error(`Administrator homework is missing chapter ${chapter.chapterNumber}`);
    }
    if (exam.id !== expectedExamId) {
      throw new Error(
        `Administrator homework chapter ${chapter.chapterNumber} has exam ID ${exam.id}; expected ${expectedExamId}`,
      );
    }
    if (exam.moduleId !== "human-resources" || exam.status !== "draft") {
      throw new Error(`Administrator homework exam ${exam.id} must be a draft human-resources exam`);
    }
    if (exam.questions.length !== chapter.questionCount) {
      throw new Error(
        `Administrator homework ${chapter.id} contains ${exam.questions.length} questions; expected ${chapter.questionCount}`,
      );
    }
    for (const question of exam.questions) questionIds.add(question.id);
  }

  for (const asset of adminHomeworkQuestionAssets) {
    for (const questionId of asset.questionIds) {
      if (!questionIds.has(questionId)) {
        throw new Error(`Administrator homework image ${asset.id} references unknown question ${questionId}`);
      }
    }
  }
}
