import { Skill } from './skill.js';

const toSkill = (r) => new Skill({ id: r.id, title: r.title, description: r.description, content: r.content, kind: r.kind, enabled: Boolean(r.enabled), updatedAt: r.updated_at });

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
      .prepare('INSERT INTO skills (title, description, content, kind, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(s.title, s.description, s.content, s.kind, s.enabled ? 1 : 0, s.updatedAt)
      .run();
    s.id = meta.last_row_id;
    return s;
  }

  async save(s) {
    await this.db
      .prepare('UPDATE skills SET title = ?, description = ?, content = ?, kind = ?, enabled = ?, updated_at = ? WHERE id = ?')
      .bind(s.title, s.description, s.content, s.kind, s.enabled ? 1 : 0, s.updatedAt, s.id)
      .run();
  }

  async remove(id) {
    await this.db.prepare('DELETE FROM skills WHERE id = ?').bind(id).run();
  }
}
