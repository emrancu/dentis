import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

/**
 * A Cloudflare D1 look-alike on node:sqlite, so the real migrations and the real SQL of the
 * D1 repositories run in tests. Implements only what the repositories use.
 */
export function createD1({ seed = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  // seed:false = schema only (0001, 0003). seed:true = every migration in order.
  const files = readdirSync(new URL('../../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (!seed && !['0001_init.sql', '0003_skill_kind_keywords.sql'].includes(f)) continue;
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
