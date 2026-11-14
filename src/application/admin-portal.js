import { NotFoundError, ValidationError } from '../domain/shared/errors.js';
import { addDays, dhakaParts } from '../domain/shared/time.js';
import { appointmentDto, callbackDto, doctorDto, extractionDto } from './dto.js';

const STALE_AFTER_MS = 30 * 60 * 1000;
const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;

/** Read side of the portal. */
export class AdminQueries {
  constructor({ calls, patients, appointments, doctors, callbacks, recordings, clock }) {
    Object.assign(this, { calls, patients, appointments, doctors, callbacks, recordings, clock });
  }

  async #expireStale() {
    const now = this.clock.now();
    await this.calls.expireStale(new Date(now.getTime() - STALE_AFTER_MS).toISOString(), now.toISOString());
  }

  async dashboard() {
    await this.#expireStale();
    const now = dhakaParts(this.clock.now());
    const days = Array.from({ length: 7 }, (_, i) => addDays(now.date, i - 6));
    const [stats, openCallbacks, upcoming] = await Promise.all([
      this.calls.stats(new Date(`${days[0]}T00:00:00+06:00`).toISOString()),
      this.callbacks.countOpen(),
      this.appointments.countUpcoming(`${now.date}T${now.time}`),
    ]);
    const counts = new Map(stats.perDay.map((d) => [d.day, d.count]));
    return {
      total: stats.total,
      avg_duration_s: Math.round(stats.avgDurationS),
      by_status: stats.byStatus,
      per_day: days.map((day) => ({ day, count: counts.get(day) ?? 0 })),
      open_callbacks: openCallbacks,
      upcoming_appointments: upcoming,
    };
  }

  async listCalls({ q, status, limit, offset } = {}) {
    await this.#expireStale();
    const rows = await this.calls.list({
      q: q?.trim() || undefined,
      status: status || undefined,
      limit: Math.min(Number(limit) || DEFAULT_PAGE, MAX_PAGE),
      offset: Math.max(Number(offset) || 0, 0),
    });
    return {
      items: rows.map(({ call, extraction }) => ({
        id: call.id,
        started_at: call.startedAt,
        duration_s: call.durationS,
        status: call.status,
        patient_name: extraction?.patientName ?? null,
        phone: extraction?.phone ?? null,
        reason_for_visit: extraction?.reasonForVisit ?? null,
      })),
    };
  }

  async getCall(id) {
    const call = await this.calls.findById(id);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    const [extraction, turns, appointments, callbacks, doctors] = await Promise.all([
      this.calls.getExtraction(id),
      this.calls.getTurns(id),
      this.appointments.listForCall(id),
      this.callbacks.listForCall(id),
      this.doctors.list(),
    ]);
    const patient = call.patientId ? await this.patients.findById(call.patientId) : null;
    return {
      call: {
        id: call.id,
        started_at: call.startedAt,
        ended_at: call.endedAt,
        duration_s: call.durationS,
        status: call.status,
        summary: call.summary,
        has_recording: Boolean(call.recordingKey),
      },
      extraction: extractionDto(extraction),
      turns: turns.map((t) => ({ idx: t.idx, speaker: t.speaker, text_bn: t.textBn, text_en: t.textEn, ts: t.ts })),
      appointments: appointments.map((a) => appointmentDto(a, patient, doctors.find((d) => d.id === a.doctorId))),
      callbacks: callbacks.map(callbackDto),
    };
  }

  async getRecording(id) {
    const call = await this.calls.findById(id);
    const recording = call?.recordingKey ? await this.recordings.get(call.recordingKey) : null;
    if (!recording) throw new NotFoundError('recording_not_found', 'No recording for this call.');
    return recording;
  }

  async listAppointments({ status } = {}) {
    const items = await this.appointments.list(status || undefined);
    const [patients, doctors] = await Promise.all([this.patients.findManyByIds([...new Set(items.map((a) => a.patientId))]), this.doctors.list()]);
    return { items: items.map((a) => appointmentDto(a, patients.find((p) => p.id === a.patientId), doctors.find((d) => d.id === a.doctorId))) };
  }

  async listPatients({ q } = {}) {
    const items = await this.patients.list(q?.trim() || undefined);
    return { items: items.map((p) => ({ id: p.id, full_name: p.fullName, phone: p.phone, created_at: p.createdAt })) };
  }

  async listCallbacks({ status } = {}) {
    return { items: (await this.callbacks.list(status || undefined)).map(callbackDto) };
  }

  async listDoctors() {
    return { items: (await this.doctors.list()).map(doctorDto) };
  }
}

export class UpdateAppointmentStatus {
  constructor({ appointments, patients, doctors }) {
    Object.assign(this, { appointments, patients, doctors });
  }

  async execute(id, status) {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new NotFoundError('appointment_not_found', 'Appointment not found.');
    if (status === 'cancelled') appointment.cancel();
    else if (status === 'completed') appointment.complete();
    else throw new ValidationError('status_invalid', 'Status must be cancelled or completed.');
    await this.appointments.save(appointment);
    return appointmentDto(appointment, await this.patients.findById(appointment.patientId), await this.doctors.findById(appointment.doctorId));
  }
}

export class ResolveCallback {
  constructor({ callbacks }) {
    this.callbacks = callbacks;
  }

  async execute(id) {
    const callback = await this.callbacks.findById(id);
    if (!callback) throw new NotFoundError('callback_not_found', 'Callback not found.');
    callback.resolve();
    await this.callbacks.save(callback);
    return callbackDto(callback);
  }
}
