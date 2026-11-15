import { ValidationError } from '../shared/errors.js';
import { toAsciiDigits } from '../shared/bangla.js';
import { requireDate, weekdayOf } from '../shared/time.js';

/** Value object: a clinic-local date + time ("2026-11-16T18:30"). */
export class Slot {
  constructor(date, time) {
    this.date = date;
    this.time = time;
    Object.freeze(this);
  }

  static of(date, time) {
    const d = requireDate(date);
    const t = /^(\d{1,2}):(\d{2})$/.exec(toAsciiDigits(time).trim());
    if (!t || Number(t[1]) > 23 || Number(t[2]) > 59) {
      throw new ValidationError('time_invalid', 'The time must be 24-hour HH:MM, for example 18:30.');
    }
    return new Slot(d, `${t[1].padStart(2, '0')}:${t[2]}`);
  }

  static parse(value) {
    const [date, time] = String(value).split('T');
    return Slot.of(date, time);
  }

  get weekday() {
    return weekdayOf(this.date);
  }

  toString() {
    return `${this.date}T${this.time}`;
  }
}
