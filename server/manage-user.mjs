import { openDatabase } from "./db.mjs";
import { hashPassword } from "./auth.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.command !== "upsert") {
  throw new Error(
    "Usage: node server/manage-user.mjs upsert --username <phone> --display-name <name> [--adopt-device <legacy-device-id>]",
  );
}

if (!/^1[3-9]\d{9}$/.test(args.username ?? "")) {
  throw new Error("--username must be a valid mainland China mobile number");
}

if (!args.displayName || args.displayName.length > 40) {
  throw new Error("--display-name is required and must not exceed 40 characters");
}

const password = await readSecret("Password: ");
if (password.length < 8 || password.length > 128) {
  throw new Error("Password must contain 8 to 128 characters");
}

const passwordRecord = await hashPassword(password);
const db = openDatabase(process.env.DATABASE_PATH ?? "./data/study-workbench.sqlite");

try {
  const result = db.transaction(() => {
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(args.username);
    const userId = existing?.id ?? args.username;

    if (existing) {
      db.prepare(
        `UPDATE users
         SET display_name = ?, password_hash = ?, password_salt = ?, updated_at = ?
         WHERE id = ?`,
      ).run(args.displayName, passwordRecord.hash, passwordRecord.salt, now, userId);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    } else {
      db.prepare(
        `INSERT INTO users (
           id, username, display_name, password_hash, password_salt, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        userId,
        args.username,
        args.displayName,
        passwordRecord.hash,
        passwordRecord.salt,
        now,
        now,
      );
    }

    const adoptedAttempts = args.adoptDevice
      ? db
          .prepare(
            `UPDATE attempts
             SET user_id = ?
             WHERE device_id = ? AND user_id IS NULL`,
          )
          .run(userId, args.adoptDevice).changes
      : 0;

    return { userId, action: existing ? "updated" : "created", adoptedAttempts };
  })();

  console.log(
    `User ${result.action}: ${args.username}; adopted legacy attempts: ${result.adoptedAttempts}`,
  );
} finally {
  db.close();
}

function parseArgs(values) {
  const parsed = { command: values[0] };
  for (let index = 1; index < values.length; index += 1) {
    const key = values[index];
    const value = values[index + 1];
    if (!key.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Invalid argument near ${key}`);
    }
    if (key === "--username") parsed.username = value;
    else if (key === "--display-name") parsed.displayName = value;
    else if (key === "--adopt-device") parsed.adoptDevice = value;
    else throw new Error(`Unknown option: ${key}`);
    index += 1;
  }
  return parsed;
}

async function readSecret(prompt) {
  process.stdout.write(prompt);

  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    let input = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) input += chunk;
    process.stdout.write("\n");
    return input.replace(/[\r\n]+$/, "");
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let input = "";
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password input cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(input);
          return;
        }
        if (character === "\u007f") input = input.slice(0, -1);
        else input += character;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}
