"use strict";

const crypto = require("node:crypto");

function text(value, limit) {
  return String(value == null ? "" : value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, limit);
}

function list(value, limit, itemLimit) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map((item) => text(item, itemLimit)).filter(Boolean))].slice(0, limit);
}

function normalizeQuestion(input) {
  const item = input && typeof input === "object" ? input : {};
  const options = Array.isArray(item.options)
    ? item.options.slice(0, 12).map((option) => text(option, 1000)).filter(Boolean)
    : [];
  return {
    question: text(item.question || item.stem, 10000),
    options,
    answer: text(item.answer, 5000),
    analysis: text(item.analysis || item.explanation, 16000),
    type: text(item.type, 50) || "计算",
    difficulty: text(item.difficulty, 30) || "中等",
    chapter: text(item.chapter, 100) || "综合",
    schools: list(item.schools || item.school, 8, 40),
    keywords: list(item.keywords, 20, 80),
    source: text(item.source, 200) || "AI原创生成"
  };
}

function fingerprint(input) {
  const item = normalizeQuestion(input);
  return crypto.createHash("sha256").update(JSON.stringify({
    question: item.question,
    options: item.options,
    answer: item.answer,
    type: item.type,
    chapter: item.chapter
  })).digest("hex");
}

function publicQuestion(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    question: row.question,
    options: Array.isArray(row.options) ? row.options : [],
    answer: row.answer,
    analysis: row.analysis,
    type: row.type,
    difficulty: row.difficulty,
    chapter: row.chapter,
    schools: Array.isArray(row.schools) ? row.schools : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    source: row.source,
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
    fingerprint: row.fingerprint
  };
}

function createMemoryRepository() {
  const rows = new Map();
  let nextId = 1;
  return {
    mode: "memory",
    async initialize() {},
    async list(filters) {
      const values = [...rows.values()].filter((row) => matches(row, filters));
      values.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return paginate(values, filters);
    },
    async insert(input) {
      const item = normalizeQuestion(input);
      if (!item.question || !item.answer || !item.analysis) throw new Error("题目、答案和解析不能为空");
      const fp = fingerprint(item);
      const existing = [...rows.values()].find((row) => row.fingerprint === fp);
      if (existing) return { row: publicQuestion(existing), created: false };
      const now = new Date().toISOString();
      const row = { ...item, id: String(nextId++), fingerprint: fp, createdAt: now, updatedAt: now };
      rows.set(row.id, row);
      return { row: publicQuestion(row), created: true };
    },
    async update(id, input) {
      const current = rows.get(String(id));
      if (!current) return null;
      const item = normalizeQuestion({ ...current, ...input });
      const fp = fingerprint(item);
      const duplicate = [...rows.values()].find((row) => row.id !== current.id && row.fingerprint === fp);
      if (duplicate) throw new Error("题目内容与已有题目重复");
      const row = { ...current, ...item, fingerprint: fp, updatedAt: new Date().toISOString() };
      rows.set(row.id, row);
      return publicQuestion(row);
    },
    async close() {}
  };
}

function matches(row, filters) {
  const value = filters || {};
  const search = text(value.search, 200).toLowerCase();
  if (value.chapter && value.chapter !== "all" && row.chapter !== value.chapter) return false;
  if (value.type && value.type !== "all" && row.type !== value.type) return false;
  if (value.difficulty && value.difficulty !== "all" && row.difficulty !== value.difficulty) return false;
  if (value.school && value.school !== "all" && !row.schools.includes(value.school)) return false;
  if (search && ![row.question, row.answer, row.analysis, row.chapter, row.type, ...row.keywords].join(" ").toLowerCase().includes(search)) return false;
  return true;
}

function paginate(values, filters) {
  const limit = Math.max(1, Math.min(100, Number(filters && filters.limit) || 50));
  const offset = Math.max(0, Number(filters && filters.offset) || 0);
  return { items: values.slice(offset, offset + limit).map(publicQuestion), total: values.length, limit, offset };
}

function createPostgresRepository(databaseUrl) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === "production" && process.env.PGSSLMODE !== "disable" ? { rejectUnauthorized: false } : undefined
  });
  return {
    mode: "postgres",
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_question_bank (
          id BIGSERIAL PRIMARY KEY,
          question TEXT NOT NULL,
          options JSONB NOT NULL DEFAULT '[]'::jsonb,
          answer TEXT NOT NULL,
          analysis TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          difficulty VARCHAR(30) NOT NULL,
          chapter VARCHAR(100) NOT NULL,
          schools TEXT[] NOT NULL DEFAULT '{}',
          keywords TEXT[] NOT NULL DEFAULT '{}',
          source VARCHAR(200) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          fingerprint CHAR(64) NOT NULL UNIQUE
        );
        CREATE INDEX IF NOT EXISTS ai_question_bank_chapter_idx ON ai_question_bank(chapter);
        CREATE INDEX IF NOT EXISTS ai_question_bank_type_idx ON ai_question_bank(type);
        CREATE INDEX IF NOT EXISTS ai_question_bank_difficulty_idx ON ai_question_bank(difficulty);
      `);
    },
    async list(filters) {
      const f = filters || {};
      const where = [];
      const params = [];
      const add = (clause, value) => { params.push(value); where.push(clause.replace("?", "$" + params.length)); };
      if (f.chapter && f.chapter !== "all") add("chapter = ?", f.chapter);
      if (f.type && f.type !== "all") add("type = ?", f.type);
      if (f.difficulty && f.difficulty !== "all") add("difficulty = ?", f.difficulty);
      if (f.school && f.school !== "all") add("? = ANY(schools)", f.school);
      const search = text(f.search, 200);
      if (search) { params.push("%" + search + "%"); where.push("(question ILIKE $" + params.length + " OR answer ILIKE $" + params.length + " OR analysis ILIKE $" + params.length + " OR chapter ILIKE $" + params.length + " OR $" + params.length + " = ANY(keywords))"); }
      const condition = where.length ? "WHERE " + where.join(" AND ") : "";
      const count = await pool.query("SELECT COUNT(*)::int AS total FROM ai_question_bank " + condition, params);
      const limit = Math.max(1, Math.min(100, Number(f.limit) || 50));
      const offset = Math.max(0, Number(f.offset) || 0);
      const result = await pool.query("SELECT id, question, options, answer, analysis, type, difficulty, chapter, schools, keywords, source, created_at AS \"createdAt\", updated_at AS \"updatedAt\", fingerprint FROM ai_question_bank " + condition + " ORDER BY created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2), [...params, limit, offset]);
      return { items: result.rows.map(publicQuestion), total: count.rows[0].total, limit, offset };
    },
    async insert(input) {
      const item = normalizeQuestion(input);
      if (!item.question || !item.answer || !item.analysis) throw new Error("题目、答案和解析不能为空");
      const fp = fingerprint(item);
      const columns = "id, question, options, answer, analysis, type, difficulty, chapter, schools, keywords, source, created_at AS \"createdAt\", updated_at AS \"updatedAt\", fingerprint";
      const existing = await pool.query("SELECT " + columns + " FROM ai_question_bank WHERE fingerprint = $1 LIMIT 1", [fp]);
      if (existing.rows[0]) return { row: publicQuestion(existing.rows[0]), created: false };
      try {
        const result = await pool.query("INSERT INTO ai_question_bank (question, options, answer, analysis, type, difficulty, chapter, schools, keywords, source, fingerprint) VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING " + columns, [item.question, JSON.stringify(item.options), item.answer, item.analysis, item.type, item.difficulty, item.chapter, item.schools, item.keywords, item.source, fp]);
        return { row: publicQuestion(result.rows[0]), created: true };
      } catch (error) {
        if (error && error.code === "23505") {
          const duplicate = await pool.query("SELECT " + columns + " FROM ai_question_bank WHERE fingerprint = $1 LIMIT 1", [fp]);
          if (duplicate.rows[0]) return { row: publicQuestion(duplicate.rows[0]), created: false };
        }
        throw error;
      }
    },
    async update(id, input) {
      const itemResult = await pool.query("SELECT * FROM ai_question_bank WHERE id = $1", [id]);
      if (!itemResult.rows[0]) return null;
      const item = normalizeQuestion({ ...itemResult.rows[0], ...input });
      const fp = fingerprint(item);
      const result = await pool.query(`UPDATE ai_question_bank SET question=$1, options=$2::jsonb, answer=$3, analysis=$4, type=$5, difficulty=$6, chapter=$7, schools=$8, keywords=$9, source=$10, fingerprint=$11, updated_at=NOW() WHERE id=$12
        RETURNING id, question, options, answer, analysis, type, difficulty, chapter, schools, keywords, source, created_at AS "createdAt", updated_at AS "updatedAt", fingerprint`, [item.question, JSON.stringify(item.options), item.answer, item.analysis, item.type, item.difficulty, item.chapter, item.schools, item.keywords, item.source, fp, id]);
      return publicQuestion(result.rows[0]);
    },
    async close() { await pool.end(); }
  };
}

function createQuestionBankService(options) {
  const settings = options || {};
  const databaseUrl = String(settings.databaseUrl || process.env.DATABASE_URL || "").trim();
  let repository;
  if (databaseUrl) repository = createPostgresRepository(databaseUrl);
  else if (settings.useMemory === true || (settings.useMemory !== false && process.env.NODE_ENV !== "production")) repository = createMemoryRepository();
  else repository = null;
  let initializationError = null;
  const ready = repository ? Promise.resolve(repository.initialize()).catch((error) => { initializationError = error; }) : Promise.resolve();
  async function ensureReady() {
    await ready;
    if (!repository) { const error = new Error("题库数据库未配置"); error.status = 503; error.code = "QUESTION_BANK_NOT_CONFIGURED"; throw error; }
    if (initializationError) { const error = new Error("题库数据库暂时不可用"); error.status = 503; error.code = "QUESTION_BANK_UNAVAILABLE"; throw error; }
  }
  return {
    mode: repository ? repository.mode : "unconfigured",
    configured: Boolean(repository),
    ready,
    list: async (filters) => { await ensureReady(); return repository.list(filters); },
    insert: async (input) => { await ensureReady(); return repository.insert(input); },
    update: async (id, input) => { await ensureReady(); return repository.update(id, input); },
    close: async () => { if (repository) await repository.close(); }
  };
}

module.exports = { createQuestionBankService, fingerprint, normalizeQuestion, publicQuestion };
