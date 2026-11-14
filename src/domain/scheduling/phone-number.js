import { ValidationError } from '../shared/errors.js';
import { toAsciiDigits } from '../shared/bangla.js';

/** Value object: a Bangladeshi mobile number, normalised to the national 11-digit form (01XXXXXXXXX). */
export class PhoneNumber {
  constructor(value) {
    this.value = value;
    Object.freeze(this);
  }

  static parse(raw) {
    let s = toAsciiDigits(raw).replace(/[\s\-().]/g, '');
    if (s.startsWith('+880')) s = `0${s.slice(4)}`;
    else if (s.startsWith('880')) s = `0${s.slice(3)}`;
    else if (/^1[3-9]\d{8}$/.test(s)) s = `0${s}`;
    if (!/^01[3-9]\d{8}$/.test(s)) {
      throw new ValidationError(
        'phone_invalid',
        'That is not a valid Bangladeshi mobile number (11 digits starting with 01). Ask the caller to repeat it slowly, digit by digit.',
      );
    }
    return new PhoneNumber(s);
  }

  /** "01712345678" -> "0 1 7 1 2 3 4 5 6 7 8" for reading back digit by digit. */
  spoken() {
    return this.value.split('').join(' ');
  }

  toString() {
    return this.value;
  }
}
