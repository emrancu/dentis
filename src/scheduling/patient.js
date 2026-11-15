import { ValidationError } from '../shared/errors.js';
import { PhoneNumber } from './phone-number.js';

/** Normalises and validates a person's name (2–80 characters). */
export function cleanName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    throw new ValidationError('name_invalid', 'The name must be 2–80 characters. Ask the caller for their full name.');
  }
  return name;
}

/** Entity: the person behind the calls, uniquely identified by phone number. */
export class Patient {
  constructor({ id = null, fullName, phone, createdAt }) {
    Object.assign(this, { id, fullName, phone, createdAt });
  }

  static register({ fullName, phone, now }) {
    return new Patient({ fullName: cleanName(fullName), phone: PhoneNumber.parse(phone).value, createdAt: now.toISOString() });
  }
}
