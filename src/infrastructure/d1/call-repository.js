import { toCall, toExtraction } from './mappers.js';

const EXTRACTION_COLUMNS = {
  patientName: 'patient_name',
  phone: 'phone',
  reasonForVisit: 'reason_for_visit',
  preferredDatetime: 'preferred_datetime',
  intent: 'intent',
  outcome: 'outcome',
  notes: 'notes',
};

export class D1CallRepository {
  constructor(db) {
    this.db = db;
  }

  async create(call) {
    await this.db.prepare('INSERT INTO calls (id, started_at, status, ip_hash) VALUES (?, ?, ?, ?)').bind(call.id, call.startedAt, call.status, call.ipHash).run();
  }

  async findById(id) {
    const row = await this.db.prepare('SELECT * FROM calls WHERE id = ?').bind(id).first();
    return row ? toCall(row) : null;
  }

  async save(call) {
    await this.db
      .prepare('UPDATE calls SET ended_at = ?, duration_s = ?, status = ?, patient_id = ?, recording_key = ?, summary = ? WHERE id = ?')
      .bind(call.endedAt, call.durationS, call.status, call.patientId, call.recordingKey, call.summary, call.id)
      .run();
  }

  async list({ q, status, limit, offset }) {
    const like = q ? `%${q}%` : null;
    const { results } = await this.db
      .prepare(
        `SELECT c.*, e.call_id AS extraction_id, e.patient_name, e.phone, e.reason_for_visit, e.preferred_datetime, e.intent, e.outcome, e.notes
         FROM calls c LEFT JOIN call_extractions e ON e.call_id = c.id
         WHERE (?1 IS NULL OR c.status = ?1)
           AND (?2 IS NULL OR e.patient_name LIKE ?2 OR e.phone LIKE ?2 OR e.reason_for_visit LIKE ?2 OR c.summary LIKE ?2)
         ORDER BY c.started_at DESC LIMIT ?3 OFFSET ?4`,
      )
      .bind(status ?? null, like, limit, offset)
      .all();
    return results.map((r) => ({ call: toCall(r), extraction: r.extraction_id ? toExtraction(r) : null }));
  }

  async countRecentByIp(ipHash, sinceIso) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM calls WHERE ip_hash = ? AND started_at >= ?').bind(ipHash, sinceIso).first();
    return row.n;
  }

  async expireStale(cutoffIso, nowIso) {
    await this.db.prepare("UPDATE calls SET status = 'incomplete', ended_at = ? WHERE status = 'in_progress' AND started_at < ?").bind(nowIso, cutoffIso).run();
  }

  async saveTurns(callId, turns) {
    const insert = this.db.prepare('INSERT INTO transcript_turns (call_id, idx, speaker, text_bn, text_en, ts) VALUES (?, ?, ?, ?, ?, ?)');
    await this.db.batch([
      this.db.prepare('DELETE FROM transcript_turns WHERE call_id = ?').bind(callId),
      ...turns.map((t) => insert.bind(callId, t.idx, t.speaker, t.textBn, t.textEn, t.ts)),
    ]);
  }

  async getTurns(callId) {
    const { results } = await this.db.prepare('SELECT idx, speaker, text_bn, text_en, ts FROM transcript_turns WHERE call_id = ? ORDER BY idx').bind(callId).all();
    return results.map((r) => ({ idx: r.idx, speaker: r.speaker, textBn: r.text_bn, textEn: r.text_en, ts: r.ts }));
  }

  async mergeExtraction(callId, fields) {
    const entries = Object.entries(fields).filter(([key, value]) => EXTRACTION_COLUMNS[key] && value !== undefined);
    await this.db.prepare('INSERT OR IGNORE INTO call_extractions (call_id) VALUES (?)').bind(callId).run();
    if (entries.length === 0) return;
    const set = entries.map(([key]) => `${EXTRACTION_COLUMNS[key]} = ?`).join(', ');
    await this.db.prepare(`UPDATE call_extractions SET ${set} WHERE call_id = ?`).bind(...entries.map(([, v]) => v), callId).run();
  }

  async getExtraction(callId) {
    return toExtraction(await this.db.prepare('SELECT * FROM call_extractions WHERE call_id = ?').bind(callId).first());
  }

  async stats(sinceIso) {
    const [totals, statuses, days] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) AS total, COALESCE(AVG(duration_s), 0) AS avg FROM calls').first(),
      this.db.prepare('SELECT status, COUNT(*) AS n FROM calls GROUP BY status').all(),
      this.db
        .prepare("SELECT substr(datetime(started_at, '+6 hours'), 1, 10) AS day, COUNT(*) AS n FROM calls WHERE started_at >= ? GROUP BY day")
        .bind(sinceIso)
        .all(),
    ]);
    return {
      total: totals.total,
      avgDurationS: totals.avg,
      byStatus: Object.fromEntries(statuses.results.map((r) => [r.status, r.n])),
      perDay: days.results.map((r) => ({ day: r.day, count: r.n })),
    };
  }
}
