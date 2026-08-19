import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contentSchema } from "../server/content-schema.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "data/hr-short-exam-series-2026.json");

const definitions = [
  {
    sourceFile: "data/hr-electronic-study-pack-questions-2026.json",
    sourceExamId: "hr-truth-100-2026-v1",
    seriesId: "hr-truth-series-2026",
    seriesTitle: "历年真题系列",
    seriesDescription: "按原题顺序拆分的历年真题短卷，适合分次限时训练。",
    seriesOrder: 10,
  },
  {
    sourceFile: "data/hr-electronic-study-pack-questions-2026.json",
    sourceExamId: "hr-knowledge-practice-199-2026-v1",
    seriesId: "hr-knowledge-series-2026",
    seriesTitle: "知识点强化系列",
    seriesDescription: "覆盖章节知识点的配套练习，按原题顺序拆成短卷。",
    seriesOrder: 20,
  },
  {
    sourceFile: "data/hr-electronic-study-pack-questions-2026.json",
    sourceExamId: "hr-master-200-2026-v1",
    seriesId: "hr-classic-master-series-2026",
    seriesTitle: "经典母题系列",
    seriesDescription: "经典母题按原题顺序拆分，便于逐套练习和复盘。",
    seriesOrder: 30,
  },
  {
    sourceFile: "data/hr-600-master-collection.json",
    sourceExamId: "hr-600-master-collection-v1",
    seriesId: "hr-master-collection-series-2026",
    seriesTitle: "母题集锦系列",
    seriesDescription: "当前资料中的 154 道母题按原题顺序拆分为短卷。",
    seriesOrder: 40,
  },
];

export async function buildShortExamSeries() {
  const sourceCache = new Map();
  const exams = [];

  for (const definition of definitions) {
    let sourceContent = sourceCache.get(definition.sourceFile);
    if (!sourceContent) {
      const sourcePath = resolve(projectRoot, definition.sourceFile);
      sourceContent = contentSchema.parse(JSON.parse(await readFile(sourcePath, "utf8")));
      sourceCache.set(definition.sourceFile, sourceContent);
    }

    const sourceExam = sourceContent.exams.find(
      (exam) => exam.id === definition.sourceExamId,
    );
    if (!sourceExam) {
      throw new Error(
        `Source exam ${definition.sourceExamId} is missing from ${definition.sourceFile}`,
      );
    }

    const paperCount = Math.ceil(sourceExam.questions.length / 30);
    const basePaperSize = Math.floor(sourceExam.questions.length / paperCount);
    const largerPaperCount = sourceExam.questions.length % paperCount;
    let offset = 0;

    for (let paperIndex = 0; paperIndex < paperCount; paperIndex += 1) {
      const paperOrder = paperIndex + 1;
      const paperSize = basePaperSize + (paperIndex < largerPaperCount ? 1 : 0);
      const sourceQuestions = sourceExam.questions.slice(offset, offset + paperSize);
      const sourceStart = offset + 1;
      const sourceEnd = offset + paperSize;
      const suffix = `__s${String(paperOrder).padStart(2, "0")}`;
      const counts = countQuestionTypes(sourceQuestions);

      exams.push({
        id: `${definition.seriesId}-paper-${String(paperOrder).padStart(2, "0")}`,
        title: `${definition.seriesTitle} · 第 ${String(paperOrder).padStart(2, "0")} 套`,
        description:
          `原题第 ${sourceStart}—${sourceEnd} 题；` +
          `${counts.single} 道单选、${counts.multiple} 道多选` +
          (counts.case > 0 ? `，其中 ${counts.case} 道案例题` : "") +
          "。答案与解析仅在交卷后展示。",
        durationMinutes: 25,
        passingScore: sourceExam.passingScore,
        seriesId: definition.seriesId,
        seriesTitle: definition.seriesTitle,
        seriesDescription: definition.seriesDescription,
        seriesOrder: definition.seriesOrder,
        paperOrder,
        status: "published",
        questions: sourceQuestions.map((question) => ({
          ...question,
          id: `${question.id}${suffix}`,
          options: question.options.map((option) => ({
            ...option,
            id: `${option.id}${suffix}`,
          })),
        })),
      });

      offset += paperSize;
    }

    if (offset !== sourceExam.questions.length) {
      throw new Error(
        `Series ${definition.seriesId} generated ${offset} of ${sourceExam.questions.length} question(s)`,
      );
    }
  }

  const content = contentSchema.parse({ materials: [], assets: [], exams });
  assertGeneratedSeries(content.exams);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return { outputPath, exams: content.exams.length, questions: countQuestions(content.exams) };
}

function countQuestionTypes(questions) {
  return questions.reduce(
    (counts, question) => {
      counts[question.type] += 1;
      if (question.section === "case") counts.case += 1;
      return counts;
    },
    { single: 0, multiple: 0, case: 0 },
  );
}

function countQuestions(exams) {
  return exams.reduce((total, exam) => total + exam.questions.length, 0);
}

function assertGeneratedSeries(exams) {
  const generatedBySeries = new Map();
  for (const exam of exams) {
    if (exam.durationMinutes !== 25) {
      throw new Error(`Generated exam ${exam.id} does not use the 25-minute limit`);
    }
    if (exam.questions.length < 1 || exam.questions.length > 30) {
      throw new Error(`Generated exam ${exam.id} has ${exam.questions.length} question(s)`);
    }
    generatedBySeries.set(
      exam.seriesId,
      (generatedBySeries.get(exam.seriesId) ?? 0) + exam.questions.length,
    );
  }

  for (const definition of definitions) {
    if (!generatedBySeries.has(definition.seriesId)) {
      throw new Error(`Series ${definition.seriesId} was not generated`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildShortExamSeries()
    .then((result) => {
      process.stdout.write(
        `Generated ${result.exams} short exam(s) with ${result.questions} question(s) at ${result.outputPath}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error.message}\n`);
      process.exitCode = 1;
    });
}
