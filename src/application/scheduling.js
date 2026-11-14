import { ConflictError, NotFoundError, ValidationError } from '../domain/shared/errors.js';
import { addDays, dhakaParts, requireDate, WEEKDAYS_BN } from '../domain/shared/time.js';
import { PhoneNumber } from '../domain/scheduling/phone-number.js';
import { Slot } from '../domain/scheduling/slot.js';
import { Appointment } from '../domain/scheduling/appointment.js';
import { findOpenings } from '../domain/scheduling/availability.js';
import { ClinicProfile } from '../domain/clinic/clinic-profile.js';
import { Outcome } from '../domain/calls/call.js';

export const MAX_ADVANCE_DAYS = 60;
const MAX_SLOTS_OFFERED = 8;
const MAX_ALTERNATIVES = 5;

const openingDto = (o) => ({ time: o.time, doctor_name_en: o.doctor.nameEn, doctor_name_bn: o.doctor.nameBn });

/** Loads the pieces every scheduling use case needs. */
async function loadContext({ doctors, settings, clock }) {
  const [allDoctors, map] = await Promise.all([doctors.list(), settings.all()]);
  return { doctors: allDoctors.filter((d) => d.active), slotMinutes: ClinicProfile.fromMap(map).slotMinutes, now: dhakaParts(clock.now()) };
}

function findDoctor(doctors, name) {
  if (!name) return null;
  const doctor = doctors.find((d) => d.matches(name));
  if (!doctor) throw new NotFoundError('doctor_not_found', 'No doctor with that name. Use list_doctors and offer the real names.');
  return doctor;
}

function requireBookable(slot, now) {
  if (slot.date < now.date || (slot.date === now.date && slot.time <= now.time)) {
    throw new ValidationError('slot_in_past', 'That time has already passed. Ask for a future date and time.');
  }
  if (slot.date > addDays(now.date, MAX_ADVANCE_DAYS)) {
    throw new ValidationError('slot_too_far', `Appointments can only be booked up to ${MAX_ADVANCE_DAYS} days ahead.`);
  }
}

/** The caller's single upcoming active appointment, found by phone (and date when they have several). */
async function findUpcoming({ patients, appointments }, phone, date, now) {
  const number = PhoneNumber.parse(phone).value;
  const patient = await patients.findByPhone(number);
  const notFound = new NotFoundError('appointment_not_found', 'No upcoming appointment found for this phone number. Check the number with the caller.');
  if (!patient) throw notFound;
  const day = date ? requireDate(date) : null;
  const upcoming = (await appointments.listForPatient(patient.id)).filter(
    (a) => a.isActive && a.slot >= `${now.date}T${now.time}` && (!day || a.date === day),
  );
  if (upcoming.length === 0) throw notFound;
  if (upcoming.length > 1) {
    throw new ConflictError('appointment_ambiguous', 'There are several upcoming appointments. Ask which date the caller means.', {
      appointments: upcoming.map((a) => ({ appointment_id: a.id, slot: a.slot })),
    });
  }
  return upcoming[0];
}

export class CheckAvailability {
  constructor(deps) {
    this.deps = deps;
  }

  async execute({ date, doctorName, period }) {
    const day = requireDate(date);
    const ctx = await loadContext(this.deps);
    const doctor = findDoctor(ctx.doctors, doctorName);
    const booked = await this.deps.appointments.listOnDate(day);
    const openings = findOpenings({ doctors: ctx.doctors, booked, date: day, now: ctx.now, slotMinutes: ctx.slotMinutes, period, doctorId: doctor?.id });
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    return {
      date: day,
      weekday_bn: WEEKDAYS_BN[weekday],
      slots: openings.slice(0, MAX_SLOTS_OFFERED).map(openingDto),
      ...(openings.length === 0 ? { message: 'No openings on this date. Offer another day.' } : {}),
    };
  }
}

export class BookAppointment {
  constructor({ doctors, settings, appointments, patientRegistry, notes, clock }) {
    Object.assign(this, { doctors, settings, appointments, patientRegistry, notes, clock });
  }

  async execute({ callId, patientName, phone, reason, date, time, doctorName }) {
    const number = PhoneNumber.parse(phone);
    const slot = Slot.of(date, time);
    const ctx = await loadContext(this);
    requireBookable(slot, ctx.now);
    const wanted = findDoctor(ctx.doctors, doctorName);
    const booked = await this.appointments.listOnDate(slot.date);
    const openings = findOpenings({ doctors: ctx.doctors, booked, date: slot.date, now: ctx.now, slotMinutes: ctx.slotMinutes, doctorId: wanted?.id });
    const opening = openings.find((o) => o.time === slot.time);
    if (!opening) {
      throw new ConflictError('slot_unavailable', 'That slot is not free. Offer the alternatives, or another day.', {
        alternatives: openings.slice(0, MAX_ALTERNATIVES).map(openingDto),
      });
    }
    const patient = await this.patientRegistry.ensure({ fullName: patientName, phone: number.value });
    const appointment = await this.appointments.insert(
      Appointment.book({ patientId: patient.id, callId, doctorId: opening.doctor.id, slot, service: String(reason ?? '').trim().slice(0, 200), now: this.clock.now() }),
    );
    await this.notes.attachPatient(callId, patient.id);
    await this.notes.record(
      callId,
      { patientName: patient.fullName, phone: number.value, reasonForVisit: appointment.service || undefined, preferredDatetime: slot.toString(), intent: 'booking' },
      Outcome.BOOKED,
    );
    return {
      appointment_id: appointment.id,
      slot: slot.toString(),
      doctor_name_en: opening.doctor.nameEn,
      doctor_name_bn: opening.doctor.nameBn,
      patient_name: patient.fullName,
      phone_spoken: number.spoken(),
    };
  }
}

export class RescheduleAppointment {
  constructor({ doctors, settings, appointments, patients, notes, clock }) {
    Object.assign(this, { doctors, settings, appointments, patients, notes, clock });
  }

  async execute({ callId, phone, newDate, newTime, oldDate, doctorName }) {
    const slot = Slot.of(newDate, newTime);
    const ctx = await loadContext(this);
    requireBookable(slot, ctx.now);
    const appointment = await findUpcoming(this, phone, oldDate, ctx.now);
    const wanted = findDoctor(ctx.doctors, doctorName);
    const booked = (await this.appointments.listOnDate(slot.date)).filter((a) => a.id !== appointment.id);
    const openings = findOpenings({ doctors: ctx.doctors, booked, date: slot.date, now: ctx.now, slotMinutes: ctx.slotMinutes, doctorId: wanted?.id });
    const keepDoctor = wanted?.id ?? appointment.doctorId;
    const opening = openings.find((o) => o.time === slot.time && o.doctor.id === keepDoctor) ?? (wanted ? null : openings.find((o) => o.time === slot.time));
    if (!opening) {
      throw new ConflictError('slot_unavailable', 'That slot is not free. Offer the alternatives, or another day.', {
        alternatives: openings.slice(0, MAX_ALTERNATIVES).map(openingDto),
      });
    }
    appointment.moveTo(slot, opening.doctor.id);
    await this.appointments.save(appointment);
    await this.notes.record(callId, { intent: 'reschedule', preferredDatetime: slot.toString() }, Outcome.RESCHEDULED);
    return { appointment_id: appointment.id, slot: slot.toString(), doctor_name_en: opening.doctor.nameEn, doctor_name_bn: opening.doctor.nameBn };
  }
}

export class CancelAppointment {
  constructor({ appointments, patients, notes, clock }) {
    Object.assign(this, { appointments, patients, notes, clock });
  }

  async execute({ callId, phone, date }) {
    const appointment = await findUpcoming(this, phone, date, dhakaParts(this.clock.now()));
    appointment.cancel();
    await this.appointments.save(appointment);
    await this.notes.record(callId, { intent: 'cancel' }, Outcome.CANCELLED);
    return { appointment_id: appointment.id, slot: appointment.slot };
  }
}
