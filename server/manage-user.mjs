import { openDatabase } from "./db.mjs";
import { hashPassword } from "./auth.mjs";
import { randomUUID } from "node:crypto";

const args = parseArgs(process.argv.slice(2));

if (args.command !== "upsert") {
  throw new Error(
    "Usage: node server/manage-user.mjs upsert --username <name> --display-name <name> [--modules human-resources,economics,english,pmp] [--admin true|false] [--adopt-device <legacy-device-id>]",
  );
}

const username = (args.username ?? "").replace(/\s/g, "");
if (!username || username.length > 64) {
  throw new Error("--username is required and must not exceed 64 characters after spaces are removed");
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
    const existing = db
      .prepare("SELECT id, is_admin, is_active FROM users WHERE username = ?")
      .get(username);
    const userId = existing?.id ?? randomUUID();
    const firstUser = db.prepare("SELECT COUNT(*) AS count FROM users").get().count === 0;
    const isAdmin = args.admin ?? (existing ? existing.is_admin === 1 : firstUser);
    if (existing?.is_admin === 1 && existing.is_active === 1 && !isAdmin) {
      const activeAdminCount = db
        .prepare(
          "SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND is_active = 1",
        )
        .get().count;
      if (activeAdminCount <= 1) {
        throw new Error("Cannot remove the last active administrator");
      }
    }
    const knownModuleIds = db
      .prepare("SELECT id FROM learning_modules ORDER BY display_order ASC, id ASC")
      .all()
      .map((row) => row.id);
    const defaultModuleIds = username.toLocaleLowerCase("en-US") === "doudou"
      ? knownModuleIds
      : knownModuleIds.filter((moduleId) => moduleId !== "pmp");
    const moduleIds = args.modules ?? (existing
      ? db
          .prepare("SELECT module_id FROM user_module_access WHERE user_id = ?")
          .all(userId)
          .map((row) => row.module_id)
      : defaultModuleIds);
    const unknownModuleIds = moduleIds.filter((moduleId) => !knownModuleIds.includes(moduleId));
    if (unknownModuleIds.length > 0) {
      throw new Error(`Unknown module IDs: ${unknownModuleIds.join(", ")}`);
    }

    if (existing) {
      db.prepare(
        `UPDATE users
         SET display_name = ?, password_hash = ?, password_salt = ?, is_admin = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        args.displayName,
        passwordRecord.hash,
        passwordRecord.salt,
        isAdmin ? 1 : 0,
        now,
        userId,
      );
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    } else {
      db.prepare(
        `INSERT INTO users (
           id, username, display_name, password_hash, password_salt,
           is_admin, is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(
        userId,
        username,
        args.displayName,
        passwordRecord.hash,
        passwordRecord.salt,
        isAdmin ? 1 : 0,
        now,
        now,
      );
    }

    if (!existing || args.modules !== undefined) {
      db.prepare("DELETE FROM user_module_access WHERE user_id = ?").run(userId);
      const insertModule = db.prepare(
        `INSERT INTO user_module_access (user_id, module_id, assigned_by, assigned_at)
         VALUES (?, ?, NULL, ?)`,
      );
      for (const moduleId of moduleIds) insertModule.run(userId, moduleId, now);
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

    db.prepare(
      `INSERT INTO admin_audit_log (
         id, actor_user_id, action, target_user_id, details_json, request_id, created_at
       ) VALUES (?, NULL, ?, ?, ?, 'cli', ?)`,
    ).run(
      randomUUID(),
      existing ? "user.cli_updated" : "user.cli_created",
      userId,
      JSON.stringify({ username, isAdmin, moduleIds, adoptedAttempts }),
      now,
    );

    return {
      userId,
      action: existing ? "updated" : "created",
      adoptedAttempts,
      isAdmin,
      moduleIds,
    };
  })();

  console.log(
    `User ${result.action}: ${username}; admin: ${result.isAdmin}; modules: ${result.moduleIds.join(",") || "none"}; adopted legacy attempts: ${result.adoptedAttempts}`,
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
    else if (key === "--modules") {
      parsed.modules = value === "none"
        ? []
        : value.split(",").map((item) => item.trim()).filter(Boolean);
      if (new Set(parsed.modules).size !== parsed.modules.length) {
        throw new Error("--modules must not contain duplicates");
      }
    } else if (key === "--admin") {
      if (value !== "true" && value !== "false") {
        throw new Error("--admin must be true or false");
      }
      parsed.admin = value === "true";
    }
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
