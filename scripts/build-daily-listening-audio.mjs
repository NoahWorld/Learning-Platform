import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_SOURCE = "./imports/daily-listening-audio/voa-english-clubs-source.mp3";
const DEFAULT_OUTPUT = "./imports/daily-listening-audio/voa-english-clubs-opening-48s.mp3";
const OUTPUT_AUDIO_FRAMES = 1851;
const MPEG1_LAYER_III_SAMPLES_PER_FRAME = 1152;

const BITRATES_KBPS = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const SAMPLE_RATES = [44100, 48000, 32000];

function readArgument(name, fallback) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return resolve(inline.slice(name.length + 1));
  const index = process.argv.indexOf(name);
  if (index === -1) return resolve(fallback);
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a file path`);
  }
  return resolve(value);
}

function syncSafeInteger(buffer, offset) {
  const bytes = buffer.subarray(offset, offset + 4);
  if (bytes.length !== 4 || bytes.some((byte) => byte > 0x7f)) {
    throw new Error("Invalid ID3 sync-safe size field");
  }
  return (bytes[0] << 21) | (bytes[1] << 14) | (bytes[2] << 7) | bytes[3];
}

function audioStartOffset(buffer) {
  if (buffer.subarray(0, 3).toString("ascii") !== "ID3") return 0;
  if (buffer.length < 10) throw new Error("Truncated ID3 header");
  const footerSize = (buffer[5] & 0x10) === 0x10 ? 10 : 0;
  return 10 + syncSafeInteger(buffer, 6) + footerSize;
}

function parseMpeg1LayerThreeFrame(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  const header = buffer.readUInt32BE(offset);
  const sync = (header >>> 21) & 0x7ff;
  const version = (header >>> 19) & 0x3;
  const layer = (header >>> 17) & 0x3;
  const bitrateIndex = (header >>> 12) & 0xf;
  const sampleRateIndex = (header >>> 10) & 0x3;
  const padding = (header >>> 9) & 0x1;

  if (sync !== 0x7ff || version !== 0x3 || layer !== 0x1) return null;
  if (bitrateIndex === 0 || bitrateIndex === 0xf || sampleRateIndex === 0x3) return null;

  const bitrate = BITRATES_KBPS[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[sampleRateIndex];
  const byteLength = Math.floor((144 * bitrate) / sampleRate) + padding;
  if (offset + byteLength > buffer.length) return null;
  return { offset, byteLength, sampleRate };
}

function findFirstFrame(buffer) {
  const start = audioStartOffset(buffer);
  const searchEnd = Math.min(buffer.length - 4, start + 65536);
  for (let offset = start; offset <= searchEnd; offset += 1) {
    const frame = parseMpeg1LayerThreeFrame(buffer, offset);
    if (frame && parseMpeg1LayerThreeFrame(buffer, offset + frame.byteLength)) return frame;
  }
  throw new Error("No consecutive MPEG-1 Layer III frames found");
}

function containsInfoHeader(buffer, frame) {
  const frameBody = buffer.subarray(frame.offset + 4, frame.offset + frame.byteLength);
  return frameBody.includes(Buffer.from("Info")) || frameBody.includes(Buffer.from("Xing"));
}

function collectFrames(buffer, firstFrame) {
  const frames = [];
  let current = firstFrame;
  while (current) {
    frames.push(current);
    current = parseMpeg1LayerThreeFrame(buffer, current.offset + current.byteLength);
  }
  return frames;
}

async function main() {
  const sourcePath = readArgument("--source", DEFAULT_SOURCE);
  const outputPath = readArgument("--output", DEFAULT_OUTPUT);
  const source = await readFile(sourcePath);
  const firstFrame = findFirstFrame(source);
  const frames = collectFrames(source, firstFrame);
  const audioFrames = containsInfoHeader(source, frames[0]) ? frames.slice(1) : frames;

  if (audioFrames.length < OUTPUT_AUDIO_FRAMES) {
    throw new Error(
      `Source contains ${audioFrames.length} usable frames; ${OUTPUT_AUDIO_FRAMES} are required`,
    );
  }
  const selectedFrames = audioFrames.slice(0, OUTPUT_AUDIO_FRAMES);
  const sampleRate = selectedFrames[0].sampleRate;
  if (selectedFrames.some((frame) => frame.sampleRate !== sampleRate)) {
    throw new Error("Source changes sample rate inside the selected clip");
  }

  const clip = Buffer.concat(
    selectedFrames.map((frame) => source.subarray(frame.offset, frame.offset + frame.byteLength)),
  );
  const durationSeconds =
    (selectedFrames.length * MPEG1_LAYER_III_SAMPLES_PER_FRAME) / sampleRate;
  const sha256 = createHash("sha256").update(clip).digest("hex");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, clip);
  console.log(JSON.stringify({
    status: "built",
    sourcePath,
    outputPath,
    frames: selectedFrames.length,
    sampleRate,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    bytes: clip.length,
    sha256,
  }));
}

await main();
