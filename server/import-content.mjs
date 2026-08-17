import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import mime from "mime-types";
import { contentSchema } from "./content-schema.mjs";
import { openDatabase } from "./db.mjs";
import { createStorage, ensureBucket } from "./storage.mjs";

const MAX_ASSET_BYTES = 100 * 1024 * 1024;

export function importContent(db, rawContent, uploadedAssets = []) {
  const validation = contentSchema.safeParse(rawContent);

  if (!validation.success) {
    const details = validation.error.issues
      .map((issue) => `${issue.path.join(".") || "content"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Content validation failed:\n${details}`);
  }

  const content = validation.data;
  const now = new Date().toISOString();

  if (content.assets.length !== uploadedAssets.length) {
    throw new Error(
      `Expected ${content.assets.length} uploaded asset(s), received ${uploadedAssets.length}`,
    );
  }

  db.transaction(() => {
    const upsertMaterial = db.prepare(`
      INSERT INTO materials (
        id, title, summary, content, category, estimated_minutes,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        content = excluded.content,
        category = excluded.category,
        estimated_minutes = excluded.estimated_minutes,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    for (const material of content.materials) {
      upsertMaterial.run(
        material.id,
        material.title,
        material.summary,
        material.content,
        material.category,
        material.estimatedMinutes,
        material.status,
        now,
        now,
      );
    }

    const deleteMaterialAssets = db.prepare("DELETE FROM assets WHERE material_id = ?");
    for (const material of content.materials) {
      deleteMaterialAssets.run(material.id);
    }

    const insertAsset = db.prepare(`
      INSERT INTO assets (
        id, material_id, role, title, object_key, file_name,
        content_type, size_bytes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const asset of uploadedAssets) {
      insertAsset.run(
        asset.id,
        asset.materialId,
        asset.role,
        asset.title,
        asset.objectKey,
        asset.fileName,
        asset.contentType,
        asset.sizeBytes,
        now,
        now,
      );
    }

    const upsertExam = db.prepare(`
      INSERT INTO exams (
        id, title, description, duration_minutes, passing_score,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        duration_minutes = excluded.duration_minutes,
        passing_score = excluded.passing_score,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO questions (
        id, exam_id, type, prompt, explanation, position, points
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertOption = db.prepare(`
      INSERT INTO question_options (
        id, question_id, label, content, is_correct, position
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const countAttempts = db.prepare("SELECT COUNT(*) AS count FROM attempts WHERE exam_id = ?");
    const deleteQuestions = db.prepare("DELETE FROM questions WHERE exam_id = ?");

    for (const exam of content.exams) {
      const attemptCount = countAttempts.get(exam.id).count;
      if (attemptCount > 0) {
        throw new Error(
          `Exam ${exam.id} already has ${attemptCount} attempt(s). ` +
            "Create a new exam ID instead of changing historical questions.",
        );
      }

      upsertExam.run(
        exam.id,
        exam.title,
        exam.description,
        exam.durationMinutes,
        exam.passingScore,
        exam.status,
        now,
        now,
      );
      deleteQuestions.run(exam.id);

      exam.questions.forEach((question, questionIndex) => {
        insertQuestion.run(
          question.id,
          exam.id,
          question.type,
          question.prompt,
          question.explanation,
          questionIndex,
          question.points,
        );

        question.options.forEach((option, optionIndex) => {
          insertOption.run(
            option.id,
            question.id,
            option.label,
            option.content,
            option.correct ? 1 : 0,
            optionIndex,
          );
        });
      });
    }

    db.pragma("optimize");
  })();

  return {
    materials: content.materials.length,
    exams: content.exams.length,
    questions: content.exams.reduce((sum, exam) => sum + exam.questions.length, 0),
    assets: uploadedAssets.length,
  };
}

export async function uploadAssets(
  storage,
  assets,
  contentDirectory,
  protectedObjectKeys = new Set(),
) {
  if (assets.length === 0) {
    return [];
  }

  if (!storage) {
    throw new Error(
      "This content file contains assets, but MinIO is not configured. " +
        "Set MINIO_ENDPOINT, MINIO_ACCESS_KEY and MINIO_SECRET_KEY.",
    );
  }

  await ensureBucket(storage);
  const uploaded = [];

  try {
    for (const asset of assets) {
      const sourcePath = resolve(contentDirectory, asset.source);
      const sourceInfo = await stat(sourcePath);
      if (!sourceInfo.isFile()) {
        throw new Error(`Asset source is not a file: ${sourcePath}`);
      }
      if (sourceInfo.size > MAX_ASSET_BYTES) {
        throw new Error(
          `Asset ${sourcePath} is ${sourceInfo.size} bytes; the limit is ${MAX_ASSET_BYTES} bytes`,
        );
      }

      const body = await readFile(sourcePath);
      const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
      const fileName = basename(sourcePath);
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const objectKey = `materials/${asset.materialId}/${asset.id}/${hash}-${safeFileName}`;
      const contentType = mime.lookup(fileName) || "application/octet-stream";

      await storage.client.putObject(storage.bucket, objectKey, body, body.length, {
        "Content-Type": contentType,
      });
      uploaded.push({
        ...asset,
        objectKey,
        fileName,
        contentType,
        sizeBytes: body.length,
      });
    }
  } catch (error) {
    const removableKeys = uploaded
      .map((asset) => asset.objectKey)
      .filter((objectKey) => !protectedObjectKeys.has(objectKey));
    let cleanupError;
    try {
      await removeObjects(storage, removableKeys, "Asset upload rollback");
    } catch (rollbackError) {
      cleanupError = rollbackError;
    }
    throw new Error(
      `Asset upload failed after ${uploaded.length} successful upload(s): ${error.message}` +
        (cleanupError ? `; cleanup also failed: ${cleanupError.message}` : ""),
      { cause: error },
    );
  }

  return uploaded;
}

async function runFromCommandLine() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run import:data -- /absolute/path/to/content.json");
  }

  const file = await readFile(inputPath, "utf8");
  let rawContent;
  try {
    rawContent = JSON.parse(file);
  } catch (error) {
    throw new Error(`Content file is not valid JSON: ${error.message}`);
  }

  const validation = contentSchema.safeParse(rawContent);
  if (!validation.success) {
    const details = validation.error.issues
      .map((issue) => `${issue.path.join(".") || "content"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Content validation failed:\n${details}`);
  }

  const storage = createStorage();
  const db = openDatabase(process.env.DATABASE_PATH ?? "./data/study-workbench.sqlite");
  const existingObjectKeys = new Set();
  const findMaterialAssetKeys = db.prepare("SELECT object_key FROM assets WHERE material_id = ?");
  for (const material of validation.data.materials) {
    for (const asset of findMaterialAssetKeys.all(material.id)) {
      existingObjectKeys.add(asset.object_key);
    }
  }

  let uploadedAssets = [];
  let databaseImported = false;
  try {
    uploadedAssets = await uploadAssets(
      storage,
      validation.data.assets,
      dirname(resolve(inputPath)),
      existingObjectKeys,
    );
    const result = importContent(db, rawContent, uploadedAssets);
    databaseImported = true;

    const currentObjectKeys = new Set(uploadedAssets.map((asset) => asset.objectKey));
    const obsoleteObjectKeys = [...existingObjectKeys].filter(
      (objectKey) => !currentObjectKeys.has(objectKey),
    );
    await removeObjects(storage, obsoleteObjectKeys, "Obsolete asset cleanup");

    process.stdout.write(
      `Imported ${result.materials} material(s), ${result.exams} exam(s), ` +
        `${result.questions} question(s), ${result.assets} asset(s).\n`,
    );
  } catch (error) {
    if (storage && !databaseImported) {
      const removableKeys = uploadedAssets
        .map((asset) => asset.objectKey)
        .filter((objectKey) => !existingObjectKeys.has(objectKey));
      try {
        await removeObjects(storage, removableKeys, "Content import rollback");
      } catch (cleanupError) {
        throw new Error(
          `Content import failed: ${error.message}; cleanup also failed: ${cleanupError.message}`,
          { cause: error },
        );
      }
    }
    throw error;
  } finally {
    db.close();
  }
}

async function removeObjects(storage, objectKeys, context) {
  if (!storage || objectKeys.length === 0) return;

  const results = await Promise.allSettled(
    objectKeys.map((objectKey) => storage.client.removeObject(storage.bucket, objectKey)),
  );
  const failures = results
    .map((result, index) => ({ result, objectKey: objectKeys[index] }))
    .filter(({ result }) => result.status === "rejected");

  if (failures.length > 0) {
    const details = failures
      .map(({ result, objectKey }) =>
        `${objectKey}: ${result.status === "rejected" ? result.reason?.message ?? result.reason : "unknown error"}`,
      )
      .join("; ");
    throw new Error(`${context} failed for ${failures.length} object(s): ${details}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromCommandLine().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
