import { ValidationError } from './errors.js';
import { toAsciiDigits } from './bangla.js';

/** Clinic-local time helpers. Bangladesh (Asia/Dhaka) is UTC+6 with no DST. */
const OFFSET_MS = 6 * 3600 * 1000;

export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

/** @param {Date} instant @returns {{date:string,time:string,weekday:number}} */
export function dhakaParts(instant) {
  const iso = new Date(instant.getTime() + OFFSET_MS).toISOString();
  const date = iso.slice(0, 10);
  return { date, time: iso.slice(11, 16), weekday: weekdayOf(date) };
}

export function isRealDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** Accepts Bangla or English digits and returns a validated YYYY-MM-DD. */
export function requireDate(value) {
  const date = toAsciiDigits(value).trim();
  if (!isRealDate(date)) throw new ValidationError('date_invalid', 'The date must be a real calendar date in YYYY-MM-DD format.');
  return date;
}

export function weekdayOf(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export class SystemClock {
  now() {
    return new Date();
  }
}
