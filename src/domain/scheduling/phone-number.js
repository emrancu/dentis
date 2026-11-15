import { ValidationError } from '../shared/errors.js';
import { toAsciiDigits } from '../shared/bangla.js';

const DIGIT_WORDS = Object.freeze({ 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' });

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

  /** "01712345678" -> "zero one seven, one two three four, five six seven eight": the one standard way to say a number aloud. */
  spoken() {
    return PhoneNumber.speak(this.value);
  }

  /** Any phone text -> English digit words in small groups (3-4-4 for 11 digits, otherwise threes). Digits only, so it is safe for "+880 1712-345678". */
  static speak(text) {
    const digits = toAsciiDigits(text).replace(/\D/g, '').split('');
    if (!digits.length) return '';
    const sizes = digits.length === 11 ? [3, 4, 4] : null;
    const groups = [];
    for (let i = 0, g = 0; i < digits.length; g += 1) {
      const size = sizes ? sizes[g] : 3;
      groups.push(digits.slice(i, i + size).map((d) => DIGIT_WORDS[d]).join(' '));
      i += size;
    }
    return groups.join(', ');
  }

  toString() {
    return this.value;
  }
}
