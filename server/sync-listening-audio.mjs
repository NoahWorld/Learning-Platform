import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { englishListeningScenes } from "./english-listening-content.mjs";
import { createStorage, ensureBucket } from "./storage.mjs";

function readSourceDirectory(argv) {
  const inlineArgument = argv.find((argument) => argument.startsWith("--source-dir="));
  if (inlineArgument) return resolve(inlineArgument.slice("--source-dir=".length));
  const argumentIndex = argv.indexOf("--source-dir");
  if (argumentIndex === -1) return null;
  const directory = argv[argumentIndex + 1];
  if (!directory || directory.startsWith("--")) {
    throw new Error("--source-dir requires a directory path");
  }
  return resolve(directory);
}

function validateMp3(scene, audio) {
  if (audio.length !== scene.audioByteLength) {
    throw new Error(
      `${scene.audioFileName} has ${audio.length} bytes; expected ${scene.audioByteLength}. `
      + "The download is incomplete or the upstream file changed.",
    );
  }
  const hasId3Header = audio.subarray(0, 3).toString("ascii") === "ID3";
  const hasMpegFrame = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  if (!hasId3Header && !hasMpegFrame) {
    throw new Error(`${scene.audioFileName} is not a recognizable MP3 file`);
  }
}

async function loadAudio(scene, sourceDirectory) {
  if (sourceDirectory) {
    const filePath = resolve(sourceDirectory, scene.audioFileName);
    try {
      return await readFile(filePath);
    } catch (error) {
      throw new Error(`Unable to read listening audio at ${filePath}`, { cause: error });
    }
  }

  let response;
  try {
    response = await fetch(scene.audioSourceUrl, { redirect: "follow" });
  } catch (error) {
    throw new Error(`Unable to download ${scene.audioSourceUrl}`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Unable to download ${scene.audioSourceUrl}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const sourceDirectory = readSourceDirectory(process.argv.slice(2));
  const storage = createStorage();
  if (!storage) {
    throw new Error("MinIO configuration is required to sync listening audio");
  }
  await ensureBucket(storage);

  for (const scene of englishListeningScenes) {
    const audio = await loadAudio(scene, sourceDirectory);
    validateMp3(scene, audio);
    const sha256 = createHash("sha256").update(audio).digest("hex");
    await storage.client.putObject(
      storage.bucket,
      scene.audioObjectKey,
      audio,
      audio.length,
      {
        "Content-Type": "audio/mpeg",
        "X-Amz-Meta-Source": scene.audioSourceUrl,
        "X-Amz-Meta-Sha256": sha256,
      },
    );
    const objectStat = await storage.client.statObject(storage.bucket, scene.audioObjectKey);
    if (Number(objectStat.size) !== audio.length) {
      throw new Error(
        `MinIO verification failed for ${scene.audioObjectKey}: stored ${objectStat.size}, expected ${audio.length}`,
      );
    }
    console.log(JSON.stringify({
      status: "synced",
      sceneId: scene.id,
      objectKey: scene.audioObjectKey,
      bytes: audio.length,
      sha256,
    }));
  }

  console.log(JSON.stringify({ status: "complete", synced: englishListeningScenes.length }));
}

await main();
