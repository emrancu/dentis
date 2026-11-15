import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

/**
 * A Cloudflare D1 look-alike on node:sqlite, so the real migrations and the real SQL of the
 * D1 repositories run in tests. Implements only what the repositories use.
 */
/** Migrations that only change the schema. The others add demo data. */
const SCHEMA_ONLY = ['0001_init.sql', '0003_skill_kind_keywords.sql', '0005_bilingual_columns.sql', '0008_callback_urgent.sql', '0009_skills_single_language.sql', '0010_drop_skill_keywords.sql', '0011_knowledge_title_and_details.sql'];

export function createD1({ seed = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  // seed:false = schema only (the files below). seed:true = every migration in order.
  const files = readdirSync(new URL('../../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (!seed && !SCHEMA_ONLY.includes(f)) continue;
    db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  }

  class Statement {
    constructor(sql, params = []) {
      this.sql = sql;
      this.params = params;
    }
    bind(...params) { return new Statement(this.sql, params); }
    async run() {
      const r = db.prepare(this.sql).run(...this.params);
      return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
    }
    async first() { return db.prepare(this.sql).get(...this.params) ?? null; }
    async all() { return { results: db.prepare(this.sql).all(...this.params) }; }
  }

  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => new Statement(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
