import { ValidationError } from '../shared/errors.js';
import { fromMinutes, toMinutes } from '../shared/time.js';

// Longest title first, otherwise "ডা" would match the start of "ডাক্তার".
const TITLE = /^(ডাক্তার|ডা\.?|dr\.?)\s*/i;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Entity: a doctor and the weekly window in which they take appointments. `days` uses 0=Sunday … 6=Saturday. */
export class Doctor {
  constructor({ id = null, nameEn, nameBn = '', specialty = '', specialtyBn = '', days = [6, 0, 1, 2, 3, 4], startTime = '10:00', endTime = '20:00', active = true }) {
    if (!nameEn || nameEn.trim().length < 2) throw new ValidationError('doctor_name_required', 'Doctor name is required.');
    if (!HHMM.test(startTime) || !HHMM.test(endTime) || toMinutes(startTime) >= toMinutes(endTime)) {
      throw new ValidationError('doctor_hours_invalid', 'Working hours must be HH:MM with start before end.');
    }
    if (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new ValidationError('doctor_days_invalid', 'Days must be numbers 0 (Sunday) to 6 (Saturday).');
    }
    Object.assign(this, { id, nameEn: nameEn.trim(), nameBn: nameBn.trim(), specialty: specialty.trim(), specialtyBn: String(specialtyBn ?? '').trim(), days: [...new Set(days)], startTime, endTime, active: Boolean(active) });
  }

  worksOn(weekday) {
    return this.active && this.days.includes(weekday);
  }

  /** All bookable start times in the working window, e.g. ["10:00","10:30",…]. */
  slotTimes(slotMinutes) {
    const out = [];
    for (let m = toMinutes(this.startTime); m + slotMinutes <= toMinutes(this.endTime); m += slotMinutes) out.push(fromMinutes(m));
    return out;
  }

  /** Loose name match used when a caller says "Dr. Rahman" in Bangla or English. */
  matches(query) {
    const q = String(query ?? '').toLowerCase().replace(TITLE, '').trim();
    if (!q) return false;
    return [this.nameEn, this.nameBn].some((name) => name && name.toLowerCase().replace(TITLE, '').includes(q));
  }
}
