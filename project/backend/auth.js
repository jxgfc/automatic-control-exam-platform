"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const SCHEMA_PATH = path.resolve(__dirname, "../../database/001-auth.sql");
const SESSION_COOKIE = "control_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_COST = 16384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELIZATION = 1;
const USERNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.@+-]{2,63}$/u;
const ACTIVATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeActivationCode(value) {
  return String(value == null ? "" : value).toUpperCase().replace(/[\s-]/g, "");
}

function activationCodeHash(value) {
  return crypto.createHash("sha256").update(normalizeActivationCode(value)).digest("hex");
}

function activationCodeHint(value) {
  const normalized = normalizeActivationCode(value);
  return normalized.length > 8 ? normalized.slice(0, 4) + "…" + normalized.slice(-4) : normalized;
}

function generateActivationCode() {
  const bytes = crypto.randomBytes(12);
  let value = "";
  for (const byte of bytes) value += ACTIVATION_ALPHABET[byte % ACTIVATION_ALPHABET.length];
  return value.slice(0, 4) + "-" + value.slice(4, 8) + "-" + value.slice(8, 12);
}

function activationError(message, code) {
  const error = new AuthError(message, 403, code);
  return error;
}

class AuthError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "AuthError";
    this.status = status || 400;
    this.code = code || "AUTH_ERROR";
  }
}

function normalizeUsername(value) {
  return String(value == null ? "" : value).normalize("NFKC").trim();
}

function usernameKey(value) {
  return normalizeUsername(value).toLocaleLowerCase("en-US");
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!username || username.length < 3 || username.length > 64 || !USERNAME_PATTERN.test(username)) {
    throw new AuthError("账号需为3-64位字母、数字或常用符号。", 400, "INVALID_USERNAME");
  }
  return username;
}

function validatePassword(value) {
  const password = String(value == null ? "" : value);
  if (password.length < 8 || password.length > 128) {
    throw new AuthError("密码长度需为8-128位。", 400, "INVALID_PASSWORD");
  }
  return password;
}

function publicUser(user) {
  return user ? { id: String(user.id), username: String(user.username) } : null;
}

function publicActivation(record, code) {
  return record ? {
    id: String(record.id),
    code: code || undefined,
    codeHint: record.codeHint,
    label: record.label || "",
    createdAt: record.createdAt,
    expiresAt: record.expiresAt || null,
    usedAt: record.usedAt || null,
    usedBy: record.usedBy ? String(record.usedBy) : null
  } : null;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: PASSWORD_BLOCK_SIZE,
    p: PASSWORD_PARALLELIZATION,
    maxmem: 32 * 1024 * 1024
  });
  return [
    "scrypt",
    PASSWORD_COST,
    PASSWORD_BLOCK_SIZE,
    PASSWORD_PARALLELIZATION,
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url")
  ].join("$");
}

function parsePasswordHash(value) {
  const parts = String(value || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelization)) return null;
  if (!salt.length || expected.length !== PASSWORD_KEY_LENGTH) return null;
  return { cost, blockSize, parallelization, salt, expected };
}

async function verifyPassword(password, encodedHash) {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed) return false;
  try {
    const derivedKey = await scrypt(password, parsed.salt, parsed.expected.length, {
      N: parsed.cost,
      r: parsed.blockSize,
      p: parsed.parallelization,
      maxmem: 32 * 1024 * 1024
    });
    return crypto.timingSafeEqual(Buffer.from(derivedKey), parsed.expected);
  } catch (_) {
    return false;
  }
}

const DUMMY_PASSWORD_HASH = [
  "scrypt",
  PASSWORD_COST,
  PASSWORD_BLOCK_SIZE,
  PASSWORD_PARALLELIZATION,
  Buffer.from("control-platform-dummy-salt").toString("base64url"),
  crypto.scryptSync("control-platform-dummy-password", "control-platform-dummy-salt", PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: PASSWORD_BLOCK_SIZE,
    p: PASSWORD_PARALLELIZATION,
    maxmem: 32 * 1024 * 1024
  }).toString("base64url")
].join("$");

function sessionTokenHash(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function createMemoryStore() {
  let nextUserId = 1;
  let nextActivationId = 1;
  const users = new Map();
  const sessions = new Map();
  const activationCodes = new Map();

  return {
    mode: "memory",
    async initialize() {},
    async checkHealth() { return true; },
    async findUserByUsername(normalizedUsername) {
      return users.get(normalizedUsername) || null;
    },
    async createActivationCodes(codes) {
      return codes.map((item) => {
        const record = {
          id: String(nextActivationId++),
          codeHash: item.codeHash,
          codeHint: item.codeHint,
          label: item.label,
          createdAt: new Date().toISOString(),
          expiresAt: item.expiresAt,
          usedAt: null,
          usedBy: null
        };
        activationCodes.set(record.codeHash, record);
        return record;
      });
    },
    async listActivationCodes(options) {
      const settings = typeof options === "object" && options !== null ? options : { limit: options };
      const limit = Math.max(1, Math.min(500, Number(settings.limit) || 100));
      const offset = Math.max(0, Number(settings.offset) || 0);
      const search = String(settings.search || "").trim().toLocaleLowerCase("en-US");
      const status = ["available", "used", "expired"].includes(settings.status) ? settings.status : "all";
      const now = Date.now();
      const matches = [...activationCodes.values()].filter((code) => {
        if (search && !(String(code.codeHint || "").toLocaleLowerCase("en-US").includes(search) || String(code.label || "").toLocaleLowerCase("en-US").includes(search))) return false;
        const expired = !code.usedAt && code.expiresAt && new Date(code.expiresAt).getTime() <= now;
        if (status === "used") return Boolean(code.usedAt);
        if (status === "expired") return Boolean(expired);
        if (status === "available") return !code.usedAt && !expired;
        return true;
      }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return { items: matches.slice(offset, offset + limit), total: matches.length, limit, offset };
    },
    async activationCodeStats() {
      const now = Date.now();
      const values = [...activationCodes.values()];
      return {
        total: values.length,
        available: values.filter((code) => !code.usedAt && (!code.expiresAt || new Date(code.expiresAt).getTime() > now)).length,
        used: values.filter((code) => Boolean(code.usedAt)).length,
        expired: values.filter((code) => !code.usedAt && code.expiresAt && new Date(code.expiresAt).getTime() <= now).length
      };
    },
    async revokeActivationCode(id) {
      const record = [...activationCodes.values()].find((item) => String(item.id) === String(id));
      if (!record || record.usedAt) return false;
      record.expiresAt = new Date(0).toISOString();
      return true;
    },
    async createUser(username, normalizedUsername, passwordHash, activationHash) {
      if (users.has(normalizedUsername)) {
        const error = new Error("duplicate username");
        error.code = "23505";
        throw error;
      }
      const activation = activationCodes.get(activationHash);
      if (!activation) throw activationError("激活码无效", "INVALID_ACTIVATION_CODE");
      if (activation.usedAt) throw activationError("激活码已被使用", "ACTIVATION_CODE_USED");
      if (activation.expiresAt && new Date(activation.expiresAt).getTime() <= Date.now()) throw activationError("激活码已过期", "ACTIVATION_CODE_EXPIRED");
      const user = { id: String(nextUserId++), username, usernameNormalized: normalizedUsername, passwordHash, activationCodeId: activation.id, createdAt: new Date().toISOString() };
      users.set(normalizedUsername, user);
      activation.usedAt = new Date().toISOString();
      activation.usedBy = user.id;
      return user;
    },
    async createSession(userId, tokenHash, expiresAt) {
      const now = new Date().toISOString();
      sessions.set(tokenHash, { userId: String(userId), expiresAt: Number(expiresAt), createdAt: now, lastSeenAt: now });
    },
    async findUserBySession(tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session) return null;
      if (session.expiresAt <= Date.now()) {
        sessions.delete(tokenHash);
        return null;
      }
      session.lastSeenAt = new Date().toISOString();
      for (const user of users.values()) {
        if (user.id === session.userId) return user;
      }
      return null;
    },
    async countUsers(options) {
      const search = String(options && options.search || "").trim().toLocaleLowerCase("en-US");
      return [...users.values()].filter((user) => !search || user.username.toLocaleLowerCase("en-US").includes(search)).length;
    },
    async userExists(userId) {
      return [...users.values()].some((user) => String(user.id) === String(userId));
    },
    async listUsers(options) {
      const settings = options || {};
      const search = String(settings.search || "").trim().toLocaleLowerCase("en-US");
      const limit = Math.max(1, Number(settings.limit) || 100);
      const offset = Math.max(0, Number(settings.offset) || 0);
      const items = [...users.values()]
        .filter((user) => !search || user.username.toLocaleLowerCase("en-US").includes(search))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(offset, offset + limit)
        .map((user) => {
          const activation = [...activationCodes.values()].find((item) => String(item.id) === String(user.activationCodeId));
          const userSessions = [...sessions.values()].filter((session) => session.userId === String(user.id));
          const activeSessions = userSessions.filter((session) => session.expiresAt > Date.now());
          return {
            id: String(user.id),
            username: user.username,
            createdAt: user.createdAt,
            activationCodeId: user.activationCodeId ? String(user.activationCodeId) : null,
            activationCodeHint: activation ? activation.codeHint : null,
            activationLabel: activation ? activation.label || "" : null,
            lastSeenAt: userSessions.map((session) => session.lastSeenAt).sort().at(-1) || null,
            activeSessions: activeSessions.length
          };
        });
      return items;
    },
    async revokeUserSessions(userId) {
      let revoked = 0;
      for (const [tokenHash, session] of sessions.entries()) {
        if (session.userId !== String(userId)) continue;
        sessions.delete(tokenHash);
        revoked += 1;
      }
      return revoked;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
    async close() {}
  };
}

function readSchema() {
  return fs.readFileSync(SCHEMA_PATH, "utf8");
}

function createPostgresStore(databaseUrl) {
  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch (_) {
    throw new Error("未安装PostgreSQL驱动，请先运行 npm ci");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === "production" && process.env.PGSSLMODE !== "disable"
      ? { rejectUnauthorized: false }
      : undefined
  });
  // Idle connections can be closed while a serverless database sleeps or restarts.
  // Handle the pool event; subsequent requests and health probes report/retry the failure.
  pool.on("error", () => {});

  return {
    mode: "postgres",
    async initialize() {
      await pool.query(readSchema());
    },
    async checkHealth() {
      await pool.query({ text: "SELECT 1", query_timeout: 3000 });
      return true;
    },
    async findUserByUsername(normalizedUsername) {
      const result = await pool.query(
        "SELECT id, username, username_normalized AS \"usernameNormalized\", password_hash AS \"passwordHash\" FROM app_users WHERE username_normalized = $1 LIMIT 1",
        [normalizedUsername]
      );
      return result.rows[0] || null;
    },
    async createUser(username, normalizedUsername, passwordHash, activationHash) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const activation = await client.query("SELECT id, expires_at AS \"expiresAt\", used_at AS \"usedAt\" FROM activation_codes WHERE code_hash = $1 FOR UPDATE", [activationHash]);
        const record = activation.rows[0];
        if (!record) throw activationError("激活码无效", "INVALID_ACTIVATION_CODE");
        if (record.usedAt) throw activationError("激活码已被使用", "ACTIVATION_CODE_USED");
        if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) throw activationError("激活码已过期", "ACTIVATION_CODE_EXPIRED");
        const result = await client.query(
          "INSERT INTO app_users (username, username_normalized, password_hash, activation_code_id) VALUES ($1, $2, $3, $4) RETURNING id, username, username_normalized AS \"usernameNormalized\", password_hash AS \"passwordHash\", activation_code_id AS \"activationCodeId\"",
          [username, normalizedUsername, passwordHash, record.id]
        );
        await client.query("UPDATE activation_codes SET used_at = NOW(), used_by = $1 WHERE id = $2", [result.rows[0].id, record.id]);
        await client.query("COMMIT");
        return result.rows[0];
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
    async createActivationCodes(codes) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const records = [];
        for (const item of codes) {
          const result = await client.query(
            "INSERT INTO activation_codes (code_hash, code_hint, label, expires_at) VALUES ($1, $2, $3, $4) RETURNING id, code_hint AS \"codeHint\", label, created_at AS \"createdAt\", expires_at AS \"expiresAt\", used_at AS \"usedAt\", used_by AS \"usedBy\"",
            [item.codeHash, item.codeHint, item.label, item.expiresAt]
          );
          records.push(result.rows[0]);
        }
        await client.query("COMMIT");
        return records;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async listActivationCodes(options) {
      const settings = options || {};
      const limit = Math.max(1, Math.min(500, Number(settings.limit) || 100));
      const offset = Math.max(0, Number(settings.offset) || 0);
      const values = [];
      const where = [];
      const search = String(settings.search || "").trim();
      if (search) {
        values.push("%" + search.replace(/[\\%_]/g, "\\$&") + "%");
        where.push("(code_hint ILIKE $" + values.length + " ESCAPE '\\' OR label ILIKE $" + values.length + " ESCAPE '\\')");
      }
      const status = ["available", "used", "expired"].includes(settings.status) ? settings.status : "all";
      if (status === "used") where.push("used_at IS NOT NULL");
      if (status === "expired") where.push("used_at IS NULL AND expires_at IS NOT NULL AND expires_at <= NOW()");
      if (status === "available") where.push("used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())");
      const condition = where.length ? " WHERE " + where.join(" AND ") : "";
      const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM activation_codes" + condition, values);
      const pageValues = values.concat([limit, offset]);
      const result = await pool.query(
        "SELECT id, code_hint AS \"codeHint\", label, created_at AS \"createdAt\", expires_at AS \"expiresAt\", used_at AS \"usedAt\", used_by AS \"usedBy\" FROM activation_codes" + condition + " ORDER BY created_at DESC LIMIT $" + (pageValues.length - 1) + " OFFSET $" + pageValues.length,
        pageValues
      );
      return { items: result.rows, total: Number(countResult.rows[0].total) || 0, limit, offset };
    },
    async activationCodeStats() {
      const result = await pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()))::int AS available, COUNT(*) FILTER (WHERE used_at IS NOT NULL)::int AS used, COUNT(*) FILTER (WHERE used_at IS NULL AND expires_at IS NOT NULL AND expires_at <= NOW())::int AS expired FROM activation_codes");
      return result.rows[0];
    },
    async revokeActivationCode(id) {
      const result = await pool.query("UPDATE activation_codes SET expires_at = NOW() WHERE id = $1 AND used_at IS NULL", [id]);
      return result.rowCount > 0;
    },
    async createSession(userId, tokenHash, expiresAt) {
      await pool.query(
        "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, to_timestamp($3 / 1000.0))",
        [userId, tokenHash, expiresAt]
      );
      await pool.query("DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '1 day'");
    },
    async findUserBySession(tokenHash) {
      const result = await pool.query(
        "SELECT u.id, u.username, u.username_normalized AS \"usernameNormalized\", u.password_hash AS \"passwordHash\" FROM auth_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1",
        [tokenHash]
      );
      if (result.rows[0]) {
        await pool.query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE token_hash = $1", [tokenHash]);
      } else {
        await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
      }
      return result.rows[0] || null;
    },
    async countUsers(options) {
      const search = String(options && options.search || "").trim();
      const values = [];
      let where = "";
      if (search) {
        values.push("%" + search.replace(/[\\%_]/g, "\\$&") + "%");
        where = " WHERE username ILIKE $1 ESCAPE '\\'";
      }
      const result = await pool.query("SELECT COUNT(*)::int AS total FROM app_users" + where, values);
      return result.rows[0].total;
    },
    async userExists(userId) {
      const result = await pool.query("SELECT 1 FROM app_users WHERE id = $1 LIMIT 1", [userId]);
      return result.rowCount > 0;
    },
    async listUsers(options) {
      const settings = options || {};
      const search = String(settings.search || "").trim();
      const limit = Math.max(1, Math.min(500, Number(settings.limit) || 100));
      const offset = Math.max(0, Number(settings.offset) || 0);
      const values = [];
      let where = "";
      if (search) {
        values.push("%" + search.replace(/[\\%_]/g, "\\$&") + "%");
        where = "WHERE u.username ILIKE $1 ESCAPE '\\'";
      }
      values.push(limit, offset);
      const result = await pool.query(
        "SELECT u.id, u.username, u.created_at AS \"createdAt\", u.activation_code_id AS \"activationCodeId\", a.code_hint AS \"activationCodeHint\", a.label AS \"activationLabel\", MAX(s.last_seen_at) AS \"lastSeenAt\", COUNT(s.id) FILTER (WHERE s.expires_at > NOW())::int AS \"activeSessions\" FROM app_users u LEFT JOIN activation_codes a ON a.id = u.activation_code_id LEFT JOIN auth_sessions s ON s.user_id = u.id " + where + " GROUP BY u.id, a.code_hint, a.label ORDER BY u.created_at DESC LIMIT $" + (values.length - 1) + " OFFSET $" + values.length,
        values
      );
      return result.rows.map((user) => ({ ...user, id: String(user.id), activationCodeId: user.activationCodeId == null ? null : String(user.activationCodeId), activeSessions: Number(user.activeSessions) || 0 }));
    },
    async revokeUserSessions(userId) {
      const result = await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
      return result.rowCount;
    },
    async deleteSession(tokenHash) {
      await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
    },
    async close() {
      await pool.end();
    }
  };
}

function createAuthService(options) {
  const settings = options || {};
  const databaseUrl = String(settings.databaseUrl || process.env.DATABASE_URL || "").trim();
  const useMemory = settings.useMemory === true || (!databaseUrl && settings.useMemory !== false && process.env.NODE_ENV !== "production");
  let store;
  if (databaseUrl) {
    store = createPostgresStore(databaseUrl);
  } else if (useMemory) {
    store = createMemoryStore();
  } else {
    store = null;
  }

  let initializationError = null;
  let initializationAttemptAt = 0;
  let initializationInFlight = null;
  let ready = Promise.resolve(false);
  const initialize = () => {
    if (!store) return Promise.resolve(false);
    if (initializationInFlight) return initializationInFlight;
    initializationAttemptAt = Date.now();
    initializationInFlight = Promise.resolve(store.initialize())
      .then(() => { initializationError = null; return true; })
      .catch((error) => { initializationError = error; return false; })
      .finally(() => { initializationInFlight = null; });
    ready = initializationInFlight;
    return initializationInFlight;
  };
  if (store) initialize();

  async function retryInitialization() {
    await ready;
    // A Render database can be asleep or restarting during deployment. Retry
    // idempotent schema initialization at a bounded interval instead of
    // permanently marking the service unavailable after the first failure.
    if (initializationError && Date.now() - initializationAttemptAt >= 30000) await initialize();
  }

  async function ensureReady() {
    await retryInitialization();
    if (!store) throw new AuthError("账号服务未配置，请先配置 DATABASE_URL。", 503, "AUTH_NOT_CONFIGURED");
    if (initializationError) throw new AuthError("账号服务暂时不可用，请稍后重试。", 503, "AUTH_UNAVAILABLE");
  }

  async function register(usernameInput, passwordInput, activationCodeInput) {
    await ensureReady();
    const username = validateUsername(usernameInput);
    const password = validatePassword(passwordInput);
    const activationCode = normalizeActivationCode(activationCodeInput);
    if (!activationCode || activationCode.length < 8 || activationCode.length > 40) {
      throw new AuthError("注册需要有效激活码", 403, "ACTIVATION_REQUIRED");
    }
    const normalizedUsername = usernameKey(username);
    if (await store.findUserByUsername(normalizedUsername)) {
      throw new AuthError("该账号已注册，请直接登录。", 409, "USERNAME_EXISTS");
    }
    const passwordHash = await hashPassword(password);
    try {
      return publicUser(await store.createUser(username, normalizedUsername, passwordHash, activationCodeHash(activationCode)));
    } catch (error) {
      if (error instanceof AuthError) throw error;
      if (error && error.code === "23505") throw new AuthError("该账号已注册，请直接登录。", 409, "USERNAME_EXISTS");
      throw new AuthError("账号创建失败，请稍后重试。", 503, "REGISTER_FAILED");
    }
  }

  async function createActivationCodes(options) {
    await ensureReady();
    const settings = options || {};
    const count = Math.max(1, Math.min(100, Number(settings.count) || 1));
    const expiresInDays = Math.max(0, Math.min(3650, Number(settings.expiresInDays) || 0));
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;
    const label = String(settings.label || "").trim().slice(0, 120);
    const entries = Array.from({ length: count }, () => {
      const code = generateActivationCode();
      return { code, codeHash: activationCodeHash(code), codeHint: activationCodeHint(code), label, expiresAt };
    });
    const records = await store.createActivationCodes(entries);
    return records.map((record, index) => publicActivation(record, entries[index].code));
  }

  async function listActivationCodes(options) {
    await ensureReady();
    const settings = typeof options === "object" && options !== null ? options : { limit: options };
    const result = await store.listActivationCodes({
      search: String(settings.search || "").trim().slice(0, 100),
      status: String(settings.status || "all"),
      limit: Math.max(1, Math.min(500, Number(settings.limit) || 100)),
      offset: Math.max(0, Number(settings.offset) || 0)
    });
    return { ...result, items: result.items.map((record) => publicActivation(record)) };
  }

  async function activationCodeStats() {
    await ensureReady();
    return store.activationCodeStats();
  }

  async function revokeActivationCode(id) {
    await ensureReady();
    return store.revokeActivationCode(id);
  }

  async function countUsers(options) {
    await ensureReady();
    return store.countUsers(options || {});
  }

  async function listUsers(options) {
    await ensureReady();
    const settings = typeof options === "object" && options !== null ? options : { limit: options };
    return store.listUsers({
      search: String(settings.search || "").trim().slice(0, 100),
      limit: Math.max(1, Math.min(500, Number(settings.limit) || 100)),
      offset: Math.max(0, Number(settings.offset) || 0)
    });
  }

  async function revokeUserSessions(userId) {
    await ensureReady();
    const normalizedId = String(userId || "").trim();
    if (!/^\d+$/.test(normalizedId)) throw new AuthError("用户编号无效", 400, "INVALID_USER_ID");
    return store.revokeUserSessions(normalizedId);
  }

  async function userExists(userId) {
    await ensureReady();
    const normalizedId = String(userId || "").trim();
    if (!/^\d+$/.test(normalizedId)) return false;
    return store.userExists(normalizedId);
  }

  async function login(usernameInput, passwordInput) {
    await ensureReady();
    const username = validateUsername(usernameInput);
    const password = validatePassword(passwordInput);
    const user = await store.findUserByUsername(usernameKey(username));
    const valid = await verifyPassword(password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);
    if (!user || !valid) throw new AuthError("账号或密码错误。", 401, "INVALID_CREDENTIALS");
    return publicUser(user);
  }

  async function createSession(user) {
    await ensureReady();
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    await store.createSession(user.id, sessionTokenHash(token), expiresAt);
    return { token, expiresAt };
  }

  async function userFromToken(token) {
    await ensureReady();
    if (!token || String(token).length > 200) return null;
    return publicUser(await store.findUserBySession(sessionTokenHash(token)));
  }

  async function checkHealth() {
    if (!store) return false;
    await retryInitialization();
    if (initializationError || typeof store.checkHealth !== "function") return false;
    try {
      return Boolean(await store.checkHealth());
    } catch (_) {
      return false;
    }
  }

  async function deleteSession(token) {
    if (!token || !store) return;
    await ensureReady();
    await store.deleteSession(sessionTokenHash(token));
  }

  return {
    mode: store ? store.mode : "unconfigured",
    configured: Boolean(store),
    ready,
    register,
    createActivationCodes,
    listActivationCodes,
    activationCodeStats,
    revokeActivationCode,
    countUsers,
    listUsers,
    revokeUserSessions,
    userExists,
    login,
    createSession,
    userFromToken,
    checkHealth,
    deleteSession,
    async close() {
      if (store && typeof store.close === "function") await store.close();
    }
  };
}

function parseCookieHeader(value) {
  const cookies = {};
  String(value || "").split(";").forEach((part) => {
    const separator = part.indexOf("=");
    if (separator <= 0) return;
    const key = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (key) cookies[key] = rawValue;
  });
  return cookies;
}

function requestSessionToken(request) {
  return parseCookieHeader(request.headers.cookie)[SESSION_COOKIE] || "";
}

function sessionCookieHeader(token, request) {
  const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = Boolean(request.socket && request.socket.encrypted) || forwardedProtocol === "https";
  return SESSION_COOKIE + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + SESSION_TTL_SECONDS + (secure ? "; Secure" : "");
}

function clearSessionCookie() {
  return SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

module.exports = {
  AuthError,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  createAuthService,
  requestSessionToken,
  sessionCookieHeader,
  validatePassword,
  validateUsername
};
