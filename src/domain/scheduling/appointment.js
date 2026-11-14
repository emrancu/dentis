import { ConflictError } from '../shared/errors.js';
import { Slot } from './slot.js';

export const AppointmentStatus = Object.freeze({ BOOKED: 'booked', CANCELLED: 'cancelled', COMPLETED: 'completed' });

function requireActive(appointment) {
  if (!appointment.isActive) throw new ConflictError('appointment_not_active', `This appointment is already ${appointment.status}.`);
}

/** Aggregate root for a booking. `slot` is stored as "YYYY-MM-DDTHH:MM" in clinic-local time. */
export class Appointment {
  constructor({ id = null, patientId, callId = null, doctorId, slot, service = '', status = AppointmentStatus.BOOKED, createdAt }) {
    Object.assign(this, { id, patientId, callId, doctorId, slot: String(slot), service, status, createdAt });
  }

  static book({ patientId, callId, doctorId, slot, service, now }) {
    return new Appointment({ patientId, callId, doctorId, slot: slot.toString(), service, createdAt: now.toISOString() });
  }

  get isActive() {
    return this.status === AppointmentStatus.BOOKED;
  }

  get date() {
    return Slot.parse(this.slot).date;
  }

  get time() {
    return Slot.parse(this.slot).time;
  }

  cancel() {
    requireActive(this);
    this.status = AppointmentStatus.CANCELLED;
  }

  complete() {
    requireActive(this);
    this.status = AppointmentStatus.COMPLETED;
  }

  moveTo(slot, doctorId = this.doctorId) {
    requireActive(this);
    this.slot = slot.toString();
    this.doctorId = doctorId;
  }
}
