/** Clinic profile and agent prompt, stored as key/value settings. */
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
