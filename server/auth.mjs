import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "study_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

export async function verifyPassword(password, salt, expectedHash) {
  const derived = Buffer.from(await scrypt(password, salt, 64, SCRYPT_OPTIONS));
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function createSessionRecord(userId, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  return {
    id: randomUUID(),
    userId,
    token,
    tokenHash: hashSessionToken(token),
    createdAt,
    expiresAt,
  };
}

export function setSessionCookie(reply, token, request) {
  const secure = request.headers["x-forwarded-proto"] === "https";
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`,
  );
}

export function clearSessionCookie(reply, request) {
  const secure = request.headers["x-forwarded-proto"] === "https";
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
  );
}

export function getSessionToken(request) {
  const rawCookie = request.headers.cookie;
  if (!rawCookie) return null;

  for (const part of rawCookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE) {
      return part.slice(separator + 1).trim() || null;
    }
  }

  return null;
}

export function getAuthenticatedUser(db, request) {
  const token = getSessionToken(request);
  if (!token) return null;

  const now = new Date().toISOString();
  return (
    db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.is_admin, u.is_active, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`,
      )
      .get(hashSessionToken(token), now) ?? null
  );
}

export function deleteCurrentSession(db, request) {
  const token = getSessionToken(request);
  if (!token) return 0;
  return db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token)).changes;
}

export function replaceUserSession(db, session) {
  const deleteSessions = db.prepare("DELETE FROM sessions WHERE user_id = ?");
  const insertSession = db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  return db.transaction(() => {
    const replacedSessionCount = deleteSessions.run(session.userId).changes;
    insertSession.run(
      session.id,
      session.userId,
      session.tokenHash,
      session.createdAt,
      session.expiresAt,
    );
    return replacedSessionCount;
  })();
}

export function mapUser(db, row) {
  const moduleIds = db
    .prepare(
      `SELECT access.module_id
       FROM user_module_access access
       JOIN learning_modules modules ON modules.id = access.module_id
       WHERE access.user_id = ?
       ORDER BY modules.display_order ASC, access.module_id ASC`,
    )
    .all(row.id)
    .map((item) => item.module_id);

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    isActive: row.is_active === 1,
    moduleIds,
    createdAt: row.created_at,
  };
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
