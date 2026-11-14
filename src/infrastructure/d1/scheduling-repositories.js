import { toAppointment, toDoctor, toPatient } from './mappers.js';

const placeholders = (n) => Array.from({ length: n }, () => '?').join(', ');

export class D1PatientRepository {
  constructor(db) {
    this.db = db;
  }

  async findByPhone(phone) {
    const row = await this.db.prepare('SELECT * FROM patients WHERE phone = ?').bind(phone).first();
    return row ? toPatient(row) : null;
  }

  async findById(id) {
    const row = await this.db.prepare('SELECT * FROM patients WHERE id = ?').bind(id).first();
    return row ? toPatient(row) : null;
  }

  async findManyByIds(ids) {
    if (ids.length === 0) return [];
    const { results } = await this.db.prepare(`SELECT * FROM patients WHERE id IN (${placeholders(ids.length)})`).bind(...ids).all();
    return results.map(toPatient);
  }

  async insert(patient) {
    const { meta } = await this.db.prepare('INSERT INTO patients (full_name, phone, created_at) VALUES (?, ?, ?)').bind(patient.fullName, patient.phone, patient.createdAt).run();
    patient.id = meta.last_row_id;
    return patient;
  }

  async list(q) {
    const like = q ? `%${q}%` : null;
    const { results } = await this.db
      .prepare('SELECT * FROM patients WHERE (?1 IS NULL OR full_name LIKE ?1 OR phone LIKE ?1) ORDER BY created_at DESC LIMIT 200')
      .bind(like)
      .all();
    return results.map(toPatient);
  }
}

export class D1AppointmentRepository {
  constructor(db) {
    this.db = db;
  }

  async insert(a) {
    const { meta } = await this.db
      .prepare('INSERT INTO appointments (patient_id, call_id, doctor_id, slot, service, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(a.patientId, a.callId, a.doctorId, a.slot, a.service, a.status, a.createdAt)
      .run();
    a.id = meta.last_row_id;
    return a;
  }

  async findById(id) {
    const row = await this.db.prepare('SELECT * FROM appointments WHERE id = ?').bind(id).first();
    return row ? toAppointment(row) : null;
  }

  async save(a) {
    await this.db.prepare('UPDATE appointments SET doctor_id = ?, slot = ?, status = ? WHERE id = ?').bind(a.doctorId, a.slot, a.status, a.id).run();
  }

  async #all(sql, ...params) {
    const { results } = await this.db.prepare(sql).bind(...params).all();
    return results.map(toAppointment);
  }

  listOnDate(date) {
    return this.#all('SELECT * FROM appointments WHERE slot LIKE ?', `${date}T%`);
  }

  listForPatient(patientId) {
    return this.#all('SELECT * FROM appointments WHERE patient_id = ? ORDER BY slot', patientId);
  }

  listForCall(callId) {
    return this.#all('SELECT * FROM appointments WHERE call_id = ? ORDER BY slot', callId);
  }

  list(status) {
    return this.#all('SELECT * FROM appointments WHERE (?1 IS NULL OR status = ?1) ORDER BY slot DESC LIMIT 200', status ?? null);
  }

  async countForDoctor(doctorId) {
    return (await this.db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ?').bind(doctorId).first()).n;
  }

  async countUpcoming(fromSlot) {
    return (await this.db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE status = 'booked' AND slot >= ?").bind(fromSlot).first()).n;
  }
}

export class D1DoctorRepository {
  constructor(db) {
    this.db = db;
  }

  async list() {
    const { results } = await this.db.prepare('SELECT * FROM doctors ORDER BY id').all();
    return results.map(toDoctor);
  }

  async findById(id) {
    const row = await this.db.prepare('SELECT * FROM doctors WHERE id = ?').bind(id).first();
    return row ? toDoctor(row) : null;
  }

  async insert(d) {
    const { meta } = await this.db
      .prepare('INSERT INTO doctors (name_en, name_bn, specialty, days, start_time, end_time, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(d.nameEn, d.nameBn, d.specialty, JSON.stringify(d.days), d.startTime, d.endTime, d.active ? 1 : 0)
      .run();
    d.id = meta.last_row_id;
    return d;
  }

  async save(d) {
    await this.db
      .prepare('UPDATE doctors SET name_en = ?, name_bn = ?, specialty = ?, days = ?, start_time = ?, end_time = ?, active = ? WHERE id = ?')
      .bind(d.nameEn, d.nameBn, d.specialty, JSON.stringify(d.days), d.startTime, d.endTime, d.active ? 1 : 0, d.id)
      .run();
  }

  async remove(id) {
    await this.db.prepare('DELETE FROM doctors WHERE id = ?').bind(id).run();
  }
}
