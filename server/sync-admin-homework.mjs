import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  adminHomeworkChapters,
  adminHomeworkCollection,
  adminHomeworkQuestionAssets,
} from "./admin-homework-content.mjs";
import { createStorage, ensureBucket } from "./storage.mjs";

function readSourceDirectory(argv) {
  const inlineArgument = argv.find((argument) => argument.startsWith("--source-dir="));
  if (inlineArgument) return resolve(inlineArgument.slice("--source-dir=".length));
  const argumentIndex = argv.indexOf("--source-dir");
  if (argumentIndex === -1) return resolve("./imports/admin-homework-2026");
  const directory = argv[argumentIndex + 1];
  if (!directory || directory.startsWith("--")) {
    throw new Error("--source-dir requires a directory path");
  }
  return resolve(directory);
}

function validatePdf(chapter, pdf) {
  if (pdf.length !== chapter.byteLength) {
    throw new Error(
      `${chapter.sourceFileName} has ${pdf.length} bytes; expected ${chapter.byteLength}`,
    );
  }
  if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`${chapter.sourceFileName} does not start with the PDF signature`);
  }
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  if (sha256 !== chapter.sha256) {
    throw new Error(
      `${chapter.sourceFileName} SHA-256 is ${sha256}; expected ${chapter.sha256}`,
    );
  }
  return sha256;
}

function validateQuestionAsset(asset, body) {
  if (body.length !== asset.byteLength) {
    throw new Error(
      `${asset.fileName} has ${body.length} bytes; expected ${asset.byteLength}`,
    );
  }
  const sha256 = createHash("sha256").update(body).digest("hex");
  if (sha256 !== asset.sha256) {
    throw new Error(`${asset.fileName} SHA-256 is ${sha256}; expected ${asset.sha256}`);
  }
  return sha256;
}

async function main() {
  const sourceDirectory = readSourceDirectory(process.argv.slice(2));
  const storage = createStorage();
  if (!storage) {
    throw new Error("MinIO configuration is required to sync administrator homework files");
  }
  await ensureBucket(storage);

  for (const chapter of adminHomeworkChapters) {
    const filePath = resolve(sourceDirectory, chapter.sourceFileName);
    let pdf;
    try {
      pdf = await readFile(filePath);
    } catch (error) {
      throw new Error(`Unable to read administrator homework PDF at ${filePath}`, { cause: error });
    }
    const sha256 = validatePdf(chapter, pdf);
    await storage.client.putObject(
      storage.bucket,
      chapter.objectKey,
      pdf,
      pdf.length,
      {
        "Content-Type": "application/pdf",
        "X-Amz-Meta-Collection": adminHomeworkCollection.id,
        "X-Amz-Meta-Chapter": String(chapter.chapterNumber),
        "X-Amz-Meta-Sha256": sha256,
      },
    );
    const objectStat = await storage.client.statObject(storage.bucket, chapter.objectKey);
    if (Number(objectStat.size) !== pdf.length) {
      throw new Error(
        `MinIO verification failed for ${chapter.objectKey}: stored ${objectStat.size}, expected ${pdf.length}`,
      );
    }
    console.log(JSON.stringify({
      status: "synced",
      chapterId: chapter.id,
      objectKey: chapter.objectKey,
      bytes: pdf.length,
      sha256,
    }));
  }

  for (const asset of adminHomeworkQuestionAssets) {
    const filePath = resolve(sourceDirectory, "question-assets", asset.fileName);
    let body;
    try {
      body = await readFile(filePath);
    } catch (error) {
      throw new Error(`Unable to read administrator homework question image at ${filePath}`, {
        cause: error,
      });
    }
    const sha256 = validateQuestionAsset(asset, body);
    await storage.client.putObject(
      storage.bucket,
      asset.objectKey,
      body,
      body.length,
      {
        "Content-Type": asset.contentType,
        "X-Amz-Meta-Collection": adminHomeworkCollection.id,
        "X-Amz-Meta-Chapter": asset.chapterId,
        "X-Amz-Meta-Sha256": sha256,
      },
    );
    const objectStat = await storage.client.statObject(storage.bucket, asset.objectKey);
    if (Number(objectStat.size) !== body.length) {
      throw new Error(
        `MinIO verification failed for ${asset.objectKey}: stored ${objectStat.size}, expected ${body.length}`,
      );
    }
    console.log(JSON.stringify({
      status: "synced",
      assetId: asset.id,
      objectKey: asset.objectKey,
      bytes: body.length,
      sha256,
    }));
  }

  console.log(JSON.stringify({
    status: "complete",
    collectionId: adminHomeworkCollection.id,
    synced: adminHomeworkChapters.length,
    questionAssetsSynced: adminHomeworkQuestionAssets.length,
  }));
}

await main();
