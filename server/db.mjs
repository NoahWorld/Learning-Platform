import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CURRENT_SCHEMA_VERSION = 9;

export function openDatabase(databasePath = "./data/study-workbench.sqlite") {
  const resolvedPath = databasePath === ":memory:" ? databasePath : resolve(databasePath);

  if (resolvedPath !== ":memory:") {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  if (resolvedPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  migrate(db);
  return db;
}

function migrate(db) {
  let version = db.pragma("user_version", { simple: true });

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    );
  }

  if (version === 0) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE materials (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '未分类',
          estimated_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
          status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE exams (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
          passing_score INTEGER NOT NULL DEFAULT 60 CHECK (passing_score BETWEEN 0 AND 100),
          series_id TEXT NOT NULL DEFAULT '',
          series_title TEXT NOT NULL DEFAULT '',
          series_description TEXT NOT NULL DEFAULT '',
          series_order INTEGER NOT NULL DEFAULT 999 CHECK (series_order >= 0),
          paper_order INTEGER NOT NULL DEFAULT 1 CHECK (paper_order > 0),
          status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE questions (
          id TEXT PRIMARY KEY,
          exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('single', 'multiple')),
          section TEXT NOT NULL DEFAULT 'standard' CHECK (section IN ('standard', 'case')),
          passage TEXT NOT NULL DEFAULT '',
          prompt TEXT NOT NULL,
          explanation TEXT NOT NULL DEFAULT '',
          position INTEGER NOT NULL CHECK (position >= 0),
          points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
          UNIQUE (exam_id, position)
        );

        CREATE TABLE question_options (
          id TEXT PRIMARY KEY,
          question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          content TEXT NOT NULL,
          is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
          position INTEGER NOT NULL CHECK (position >= 0),
          UNIQUE (question_id, position)
        );

        CREATE TABLE assets (
          id TEXT PRIMARY KEY,
          material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('cover', 'attachment')),
          title TEXT NOT NULL,
          object_key TEXT NOT NULL UNIQUE,
          file_name TEXT NOT NULL,
          content_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE learning_modules (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL UNIQUE,
          display_order INTEGER NOT NULL CHECK (display_order >= 0)
        );

        CREATE TABLE user_module_access (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          module_id TEXT NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
          assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          assigned_at TEXT NOT NULL,
          PRIMARY KEY (user_id, module_id)
        );

        CREATE TABLE admin_audit_log (
          id TEXT PRIMARY KEY,
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          target_user_id TEXT NOT NULL,
          details_json TEXT NOT NULL,
          request_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        INSERT INTO learning_modules (id, title, display_order) VALUES
          ('human-resources', '中级经济师·人力资源', 10),
          ('economics', '中级经济师·经济学', 20),
          ('english', '英语', 30);

        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE attempts (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL DEFAULT '',
          user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
          exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
          score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
          correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
          wrong_count INTEGER NOT NULL CHECK (wrong_count >= 0),
          total_questions INTEGER NOT NULL CHECK (total_questions > 0),
          duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
          started_at TEXT NOT NULL,
          submitted_at TEXT NOT NULL
        );

        CREATE TABLE attempt_answers (
          attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
          question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
          selected_option_ids TEXT NOT NULL,
          is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
          earned_points INTEGER NOT NULL DEFAULT 0 CHECK (earned_points >= 0),
          PRIMARY KEY (attempt_id, question_id)
        );

        CREATE TABLE mistake_practice_attempts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
          selected_option_ids TEXT NOT NULL,
          is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
          submitted_at TEXT NOT NULL
        );

        CREATE TABLE listening_attempts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          scene_id TEXT NOT NULL,
          accent TEXT NOT NULL CHECK (accent IN ('us', 'uk')),
          answers_json TEXT NOT NULL,
          score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
          correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
          total_questions INTEGER NOT NULL CHECK (total_questions > 0),
          listen_count INTEGER NOT NULL CHECK (listen_count > 0),
          duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
          submitted_at TEXT NOT NULL
        );

        CREATE TABLE daily_listening_attempts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          story_id TEXT NOT NULL,
          answers_json TEXT NOT NULL,
          score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
          correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
          total_questions INTEGER NOT NULL CHECK (total_questions > 0),
          listen_count INTEGER NOT NULL CHECK (listen_count > 0),
          duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
          submitted_at TEXT NOT NULL
        );

        CREATE INDEX idx_materials_status_category
          ON materials(status, category);

        CREATE INDEX idx_exams_status_updated_at
          ON exams(status, updated_at DESC);

        CREATE INDEX idx_exams_status_series_order
          ON exams(status, series_order, paper_order);

        CREATE INDEX idx_questions_exam_position
          ON questions(exam_id, position);

        CREATE INDEX idx_assets_material_role
          ON assets(material_id, role);

        CREATE INDEX idx_attempts_device_submitted
          ON attempts(device_id, submitted_at DESC);

        CREATE INDEX idx_attempts_user_submitted
          ON attempts(user_id, submitted_at DESC);

        CREATE INDEX idx_sessions_user_expires
          ON sessions(user_id, expires_at DESC);

        CREATE UNIQUE INDEX idx_sessions_one_per_user
          ON sessions(user_id);

        CREATE INDEX idx_user_module_access_module
          ON user_module_access(module_id, user_id);

        CREATE INDEX idx_admin_audit_created
          ON admin_audit_log(created_at DESC);

        CREATE INDEX idx_attempt_answers_question_correct
          ON attempt_answers(question_id, is_correct);

        CREATE INDEX idx_mistake_practice_user_question_submitted
          ON mistake_practice_attempts(user_id, question_id, submitted_at DESC);

        CREATE INDEX idx_mistake_practice_user_correct
          ON mistake_practice_attempts(user_id, is_correct);

        CREATE INDEX idx_listening_attempts_user_scene_submitted
          ON listening_attempts(user_id, scene_id, submitted_at DESC);

        CREATE INDEX idx_daily_listening_attempts_user_story_submitted
          ON daily_listening_attempts(user_id, story_id, submitted_at DESC);
      `);
      db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
      db.pragma("optimize");
    })();

    return;
  }

  if (version === 1) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE questions
          ADD COLUMN section TEXT NOT NULL DEFAULT 'standard'
          CHECK (section IN ('standard', 'case'));
        ALTER TABLE questions
          ADD COLUMN passage TEXT NOT NULL DEFAULT '';
      `);
      db.pragma("user_version = 2");
      db.pragma("optimize");
    })();
    version = 2;
  }

  if (version === 2) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        ALTER TABLE attempts
          ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE RESTRICT;

        CREATE INDEX idx_attempts_user_submitted
          ON attempts(user_id, submitted_at DESC);

        CREATE INDEX idx_sessions_user_expires
          ON sessions(user_id, expires_at DESC);
      `);
      db.pragma("user_version = 3");
      db.pragma("optimize");
    })();
    version = 3;
  }

  if (version === 3) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE exams
          ADD COLUMN series_id TEXT NOT NULL DEFAULT '';
        ALTER TABLE exams
          ADD COLUMN series_title TEXT NOT NULL DEFAULT '';
        ALTER TABLE exams
          ADD COLUMN series_description TEXT NOT NULL DEFAULT '';
        ALTER TABLE exams
          ADD COLUMN series_order INTEGER NOT NULL DEFAULT 999 CHECK (series_order >= 0);
        ALTER TABLE exams
          ADD COLUMN paper_order INTEGER NOT NULL DEFAULT 1 CHECK (paper_order > 0);

        CREATE INDEX idx_exams_status_series_order
          ON exams(status, series_order, paper_order);
      `);
      db.pragma("user_version = 4");
      db.pragma("optimize");
    })();
    version = 4;
  }

  if (version === 4) {
    db.transaction(() => {
      db.exec(`
        DELETE FROM sessions
        WHERE id IN (
          SELECT id
          FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY user_id
                     ORDER BY expires_at DESC, created_at DESC, id DESC
                   ) AS session_rank
            FROM sessions
          ) ranked_sessions
          WHERE session_rank > 1
        );

        CREATE UNIQUE INDEX idx_sessions_one_per_user
          ON sessions(user_id);
      `);
      db.pragma("user_version = 5");
      db.pragma("optimize");
    })();
    version = 5;
  }

  if (version === 5) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE mistake_practice_attempts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
          selected_option_ids TEXT NOT NULL,
          is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
          submitted_at TEXT NOT NULL
        );

        CREATE INDEX idx_mistake_practice_user_question_submitted
          ON mistake_practice_attempts(user_id, question_id, submitted_at DESC);

        CREATE INDEX idx_mistake_practice_user_correct
          ON mistake_practice_attempts(user_id, is_correct);
      `);
      db.pragma("user_version = 6");
      db.pragma("optimize");
    })();
    version = 6;
  }

  if (version === 6) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE listening_attempts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          scene_id TEXT NOT NULL,
          accent TEXT NOT NULL CHECK (accent IN ('us', 'uk')),
          answers_json TEXT NOT NULL,
          score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
          correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
          total_questions INTEGER NOT NULL CHECK (total_questions > 0),
          listen_count INTEGER NOT NULL CHECK (listen_count > 0),
          duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
          submitted_at TEXT NOT NULL
        );

        CREATE INDEX idx_listening_attempts_user_scene_submitted
          ON listening_attempts(user_id, scene_id, submitted_at DESC);
      `);
      db.pragma("user_version = 7");
      db.pragma("optimize");
    })();
    version = 7;
  }

  if (version === 7) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE users
          ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1));
        ALTER TABLE users
          ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

        CREATE TABLE learning_modules (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL UNIQUE,
          display_order INTEGER NOT NULL CHECK (display_order >= 0)
        );

        CREATE TABLE user_module_access (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          module_id TEXT NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
          assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          assigned_at TEXT NOT NULL,
          PRIMARY KEY (user_id, module_id)
        );

        CREATE TABLE admin_audit_log (
          id TEXT PRIMARY KEY,
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          target_user_id TEXT NOT NULL,
          details_json TEXT NOT NULL,
          request_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        INSERT INTO learning_modules (id, title, display_order) VALUES
          ('human-resources', '中级经济师·人力资源', 10),
          ('economics', '中级经济师·经济学', 20),
          ('english', '英语', 30);

        INSERT INTO user_module_access (user_id, module_id, assigned_by, assigned_at)
        SELECT users.id, learning_modules.id, NULL, users.created_at
        FROM users
        CROSS JOIN learning_modules;

        UPDATE users
        SET is_admin = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = (
          SELECT id
          FROM users
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        );

        CREATE INDEX idx_user_module_access_module
          ON user_module_access(module_id, user_id);

        CREATE INDEX idx_admin_audit_created
          ON admin_audit_log(created_at DESC);
      `);
      db.pragma("user_version = 8");
      db.pragma("optimize");
    })();
    version = 8;
  }

  if (version === 8) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE daily_listening_attempts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          story_id TEXT NOT NULL,
          answers_json TEXT NOT NULL,
          score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
          correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
          total_questions INTEGER NOT NULL CHECK (total_questions > 0),
          listen_count INTEGER NOT NULL CHECK (listen_count > 0),
          duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
          submitted_at TEXT NOT NULL
        );

        CREATE INDEX idx_daily_listening_attempts_user_story_submitted
          ON daily_listening_attempts(user_id, story_id, submitted_at DESC);
      `);
      db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
      db.pragma("optimize");
    })();
  }
}
