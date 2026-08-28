import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { englishPronunciationSounds } from "./english-pronunciation-content.mjs";
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

function validateMp3(sound, audio) {
  if (audio.length !== sound.audioByteLength) {
    throw new Error(
      `${sound.audioFileName} has ${audio.length} bytes; expected ${sound.audioByteLength}. `
      + "The download is incomplete or the upstream file changed.",
    );
  }
  const hasId3Header = audio.subarray(0, 3).toString("ascii") === "ID3";
  const hasMpegFrame = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  if (!hasId3Header && !hasMpegFrame) {
    throw new Error(`${sound.audioFileName} is not a recognizable MP3 file`);
  }

  const sha256 = createHash("sha256").update(audio).digest("hex");
  if (sha256 !== sound.audioSha256) {
    throw new Error(
      `${sound.audioFileName} has SHA-256 ${sha256}; expected ${sound.audioSha256}. `
      + "The source file is not the reviewed original recording.",
    );
  }
  return sha256;
}

async function loadAudio(sound, sourceDirectory) {
  if (sourceDirectory) {
    const filePath = resolve(sourceDirectory, sound.audioFileName);
    try {
      return await readFile(filePath);
    } catch (error) {
      throw new Error(`Unable to read pronunciation audio at ${filePath}`, { cause: error });
    }
  }

  let response;
  try {
    response = await fetch(sound.audioSourceUrl, { redirect: "follow" });
  } catch (error) {
    throw new Error(`Unable to download ${sound.audioSourceUrl}`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Unable to download ${sound.audioSourceUrl}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const sourceDirectory = readSourceDirectory(process.argv.slice(2));
  const storage = createStorage();
  if (!storage) {
    throw new Error("MinIO configuration is required to sync pronunciation audio");
  }
  await ensureBucket(storage);

  for (const sound of englishPronunciationSounds) {
    const audio = await loadAudio(sound, sourceDirectory);
    const sha256 = validateMp3(sound, audio);
    await storage.client.putObject(
      storage.bucket,
      sound.audioObjectKey,
      audio,
      audio.length,
      {
        "Content-Type": "audio/mpeg",
        "X-Amz-Meta-Source": sound.audioSourceUrl,
        "X-Amz-Meta-Sha256": sha256,
        "X-Amz-Meta-Attribution": "Karen Taylor and Shirley Thompson",
        "X-Amz-Meta-License": "CC-BY-NC-ND-4.0",
      },
    );
    const objectStat = await storage.client.statObject(storage.bucket, sound.audioObjectKey);
    if (Number(objectStat.size) !== audio.length) {
      throw new Error(
        `MinIO verification failed for ${sound.audioObjectKey}: stored ${objectStat.size}, expected ${audio.length}`,
      );
    }
    console.log(JSON.stringify({
      status: "synced",
      soundId: sound.id,
      objectKey: sound.audioObjectKey,
      bytes: audio.length,
      sha256,
    }));
  }

  console.log(JSON.stringify({ status: "complete", synced: englishPronunciationSounds.length }));
}

await main();
