import { toCallback, toSkill } from './mappers.js';

export class D1SkillRepository {
  constructor(db) {
    this.db = db;
  }

  async list() {
    const { results } = await this.db.prepare('SELECT * FROM skills ORDER BY id').all();
    return results.map(toSkill);
  }

  async findById(id) {
    const row = await this.db.prepare('SELECT * FROM skills WHERE id = ?').bind(id).first();
    return row ? toSkill(row) : null;
  }

  async insert(s) {
    const { meta } = await this.db
      .prepare('INSERT INTO skills (title, description, title_bn, description_bn, content, kind, keywords, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.title, s.description, s.titleBn, s.descriptionBn, s.content, s.kind, s.keywords, s.enabled ? 1 : 0, s.updatedAt)
      .run();
    s.id = meta.last_row_id;
    return s;
  }

  async save(s) {
    await this.db
      .prepare('UPDATE skills SET title = ?, description = ?, title_bn = ?, description_bn = ?, content = ?, kind = ?, keywords = ?, enabled = ?, updated_at = ? WHERE id = ?')
      .bind(s.title, s.description, s.titleBn, s.descriptionBn, s.content, s.kind, s.keywords, s.enabled ? 1 : 0, s.updatedAt, s.id)
      .run();
  }

  async remove(id) {
    await this.db.prepare('DELETE FROM skills WHERE id = ?').bind(id).run();
  }
}

export class D1SettingsRepository {
  constructor(db) {
    this.db = db;
  }

  async all() {
    const { results } = await this.db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(results.map((r) => [r.key, r.value]));
  }

  async setMany(map) {
    const upsert = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    await this.db.batch(Object.entries(map).map(([key, value]) => upsert.bind(key, value)));
  }
}

export class D1CallbackRepository {
  constructor(db) {
    this.db = db;
  }

  async insert(c) {
    const { meta } = await this.db
      .prepare('INSERT INTO callbacks (call_id, name, phone, reason, preferred_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(c.callId, c.name, c.phone, c.reason, c.preferredTime, c.status, c.createdAt)
      .run();
    c.id = meta.last_row_id;
    return c;
  }

  async findById(id) {
    const row = await this.db.prepare('SELECT * FROM callbacks WHERE id = ?').bind(id).first();
    return row ? toCallback(row) : null;
  }

  async save(c) {
    await this.db.prepare('UPDATE callbacks SET status = ? WHERE id = ?').bind(c.status, c.id).run();
  }

  async list(status) {
    const { results } = await this.db.prepare('SELECT * FROM callbacks WHERE (?1 IS NULL OR status = ?1) ORDER BY created_at DESC LIMIT 200').bind(status ?? null).all();
    return results.map(toCallback);
  }

  async listForCall(callId) {
    const { results } = await this.db.prepare('SELECT * FROM callbacks WHERE call_id = ? ORDER BY id').bind(callId).all();
    return results.map(toCallback);
  }

  async countOpen() {
    return (await this.db.prepare("SELECT COUNT(*) AS n FROM callbacks WHERE status = 'open'").first()).n;
  }
}
