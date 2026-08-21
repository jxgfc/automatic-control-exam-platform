-- Only AI-generated questions are stored here. Built-in questions and browser learning data stay local.
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
