import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { englishDailyListeningStories } from "./english-daily-listening-content.mjs";
import { createStorage, ensureBucket } from "./storage.mjs";

function readSourceDirectory(argv) {
  const inlineArgument = argv.find((argument) => argument.startsWith("--source-dir="));
  if (inlineArgument) return resolve(inlineArgument.slice("--source-dir=".length));
  const argumentIndex = argv.indexOf("--source-dir");
  if (argumentIndex === -1) return resolve("./imports/daily-listening-audio");
  const directory = argv[argumentIndex + 1];
  if (!directory || directory.startsWith("--")) {
    throw new Error("--source-dir requires a directory path");
  }
  return resolve(directory);
}

function validateMp3(story, audio) {
  if (audio.length !== story.audioByteLength) {
    throw new Error(
      `${story.audioFileName} has ${audio.length} bytes; expected ${story.audioByteLength}. `
      + "Run npm run audio:build-daily from the verified VOA source before syncing.",
    );
  }
  const hasMpegFrame = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  if (!hasMpegFrame) {
    throw new Error(`${story.audioFileName} does not start with a recognizable MPEG audio frame`);
  }
  const sha256 = createHash("sha256").update(audio).digest("hex");
  if (sha256 !== story.audioSha256) {
    throw new Error(
      `${story.audioFileName} SHA-256 is ${sha256}; expected ${story.audioSha256}`,
    );
  }
  return sha256;
}

async function main() {
  const sourceDirectory = readSourceDirectory(process.argv.slice(2));
  const storage = createStorage();
  if (!storage) {
    throw new Error("MinIO configuration is required to sync daily listening audio");
  }
  await ensureBucket(storage);

  for (const story of englishDailyListeningStories) {
    const filePath = resolve(sourceDirectory, story.audioFileName);
    let audio;
    try {
      audio = await readFile(filePath);
    } catch (error) {
      throw new Error(`Unable to read daily listening audio at ${filePath}`, { cause: error });
    }
    const sha256 = validateMp3(story, audio);
    await storage.client.putObject(
      storage.bucket,
      story.audioObjectKey,
      audio,
      audio.length,
      {
        "Content-Type": "audio/mpeg",
        "X-Amz-Meta-Source": story.audioSourceUrl,
        "X-Amz-Meta-Source-Page": story.source.pageUrl,
        "X-Amz-Meta-Sha256": sha256,
      },
    );
    const objectStat = await storage.client.statObject(storage.bucket, story.audioObjectKey);
    if (Number(objectStat.size) !== audio.length) {
      throw new Error(
        `MinIO verification failed for ${story.audioObjectKey}: stored ${objectStat.size}, expected ${audio.length}`,
      );
    }
    console.log(JSON.stringify({
      status: "synced",
      storyId: story.id,
      objectKey: story.audioObjectKey,
      bytes: audio.length,
      sha256,
    }));
  }

  console.log(JSON.stringify({
    status: "complete",
    synced: englishDailyListeningStories.length,
  }));
}

await main();
