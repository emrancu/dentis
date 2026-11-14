import { dhakaParts } from '../../src/domain/shared/time.js';

/** Copies an object so tests see persistence semantics (changes need a save). */
const clone = (o) => (o && typeof o === 'object' ? Object.assign(Object.create(Object.getPrototypeOf(o)), o) : o);

class Table {
  rows = new Map();
  next = 1;

  insert(entity) {
    entity.id = this.next++;
    this.rows.set(entity.id, clone(entity));
    return entity;
  }

  save(entity) {
    this.rows.set(entity.id, clone(entity));
  }

  get(id) {
    return clone(this.rows.get(id)) ?? null;
  }

  all() {
    return [...this.rows.values()].map(clone);
  }
}

export class InMemoryCalls {
  #calls = new Map();
  #turns = new Map();
  #extractions = new Map();

  async create(call) { this.#calls.set(call.id, clone(call)); }
  async findById(id) { return clone(this.#calls.get(id)) ?? null; }
  async save(call) { this.#calls.set(call.id, clone(call)); }

  async list({ q, status, limit, offset }) {
    const needle = q?.toLowerCase();
    return [...this.#calls.values()]
      .filter((c) => !status || c.status === status)
      .map((c) => ({ call: clone(c), extraction: this.#extractions.get(c.id) ? { ...this.#extractions.get(c.id) } : null }))
      .filter(({ call, extraction }) => !needle || [extraction?.patientName, extraction?.phone, extraction?.reasonForVisit, call.summary].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => b.call.startedAt.localeCompare(a.call.startedAt))
      .slice(offset, offset + limit);
  }

  async countRecentByIp(ipHash, sinceIso) {
    return [...this.#calls.values()].filter((c) => c.ipHash === ipHash && c.startedAt >= sinceIso).length;
  }

  async expireStale(cutoffIso, nowIso) {
    for (const c of this.#calls.values()) if (c.status === 'in_progress' && c.startedAt < cutoffIso) Object.assign(c, { status: 'incomplete', endedAt: nowIso });
  }

  async saveTurns(callId, turns) { this.#turns.set(callId, turns.map((t) => ({ ...t }))); }
  async getTurns(callId) { return (this.#turns.get(callId) ?? []).map((t) => ({ ...t })); }

  async mergeExtraction(callId, fields) {
    const current = this.#extractions.get(callId) ?? {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) current[k] = v;
    this.#extractions.set(callId, current);
  }

  async getExtraction(callId) { return this.#extractions.has(callId) ? { ...this.#extractions.get(callId) } : null; }

  async stats(sinceIso) {
    const calls = [...this.#calls.values()];
    const byStatus = {};
    const perDay = new Map();
    for (const c of calls) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      if (c.startedAt >= sinceIso) {
        const day = dhakaParts(new Date(c.startedAt)).date;
        perDay.set(day, (perDay.get(day) ?? 0) + 1);
      }
    }
    const durations = calls.map((c) => c.durationS).filter((d) => d !== null);
    return {
      total: calls.length,
      avgDurationS: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      byStatus,
      perDay: [...perDay].map(([day, count]) => ({ day, count })),
    };
  }
}

export class InMemoryPatients extends Table {
  async findByPhone(phone) { return this.all().find((p) => p.phone === phone) ?? null; }
  async findById(id) { return this.get(id); }
  async findManyByIds(ids) { return this.all().filter((p) => ids.includes(p.id)); }
  async insert(p) { return super.insert(p); }
  async list(q) { return this.all().filter((p) => !q || p.fullName.includes(q) || p.phone.includes(q)); }
}

export class InMemoryAppointments extends Table {
  async insert(a) { return super.insert(a); }
  async findById(id) { return this.get(id); }
  async save(a) { super.save(a); }
  async listOnDate(date) { return this.all().filter((a) => a.slot.startsWith(`${date}T`)); }
  async listForPatient(patientId) { return this.all().filter((a) => a.patientId === patientId); }
  async listForCall(callId) { return this.all().filter((a) => a.callId === callId); }
  async list(status) { return this.all().filter((a) => !status || a.status === status); }
  async countForDoctor(doctorId) { return this.all().filter((a) => a.doctorId === doctorId).length; }
  async countUpcoming(fromSlot) { return this.all().filter((a) => a.status === 'booked' && a.slot >= fromSlot).length; }
}

export class InMemoryDoctors extends Table {
  async list() { return this.all(); }
  async findById(id) { return this.get(id); }
  async insert(d) { return super.insert(d); }
  async save(d) { super.save(d); }
  async remove(id) { this.rows.delete(id); }
}

export class InMemorySkills extends InMemoryDoctors {}

export class InMemorySettings {
  map = {};
  async all() { return { ...this.map }; }
  async setMany(map) { Object.assign(this.map, map); }
}

export class InMemoryCallbacks extends Table {
  async insert(c) { return super.insert(c); }
  async findById(id) { return this.get(id); }
  async save(c) { super.save(c); }
  async list(status) { return this.all().filter((c) => !status || c.status === status); }
  async listForCall(callId) { return this.all().filter((c) => c.callId === callId); }
  async countOpen() { return this.all().filter((c) => c.status === 'open').length; }
}

export class InMemoryRecordings {
  files = new Map();
  async put(key, body, contentType) { this.files.set(key, { body, contentType }); }
  async get(key) { return this.files.get(key) ?? null; }
}
