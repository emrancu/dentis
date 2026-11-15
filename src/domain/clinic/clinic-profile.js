import { ValidationError } from '../shared/errors.js';

const FIELDS = {
  nameEn: 'name_en',
  nameBn: 'name_bn',
  phone: 'phone',
  address: 'address',
  addressBn: 'address_bn',
  directions: 'directions',
  directionsBn: 'directions_bn',
  hours: 'hours',
  hoursBn: 'hours_bn',
  prepNotes: 'prep_notes',
  prepNotesBn: 'prep_notes_bn',
  slotMinutes: 'slot_minutes',
};

const DEFAULTS = {
  nameEn: 'Dentis Dental Care',
  nameBn: 'ডেন্টিস ডেন্টাল কেয়ার',
  phone: '',
  address: '',
  addressBn: '',
  directions: '',
  directionsBn: '',
  hours: '',
  hoursBn: '',
  prepNotes: '',
  prepNotesBn: '',
  slotMinutes: 30,
};

/** Value object: the clinic's public profile. Persisted as a key/value map. */
export class ClinicProfile {
  constructor(values = {}) {
    const v = { ...DEFAULTS, ...values };
    v.slotMinutes = Number(v.slotMinutes);
    if (![15, 20, 30, 45, 60].includes(v.slotMinutes)) throw new ValidationError('slot_minutes_invalid', 'Slot length must be 15, 20, 30, 45 or 60 minutes.');
    if (!String(v.nameEn).trim()) throw new ValidationError('clinic_name_required', 'Clinic name is required.');
    for (const key of Object.keys(FIELDS)) if (key !== 'slotMinutes' && String(v[key]).length > 1000) throw new ValidationError('field_too_long', `${key} is too long.`);
    Object.assign(this, v);
    Object.freeze(this);
  }

  static fromMap(map = {}) {
    const values = {};
    for (const [prop, key] of Object.entries(FIELDS)) if (map[key] !== undefined) values[prop] = map[key];
    return new ClinicProfile(values);
  }

  /** Accepts snake_case keys from the admin form; unknown keys are ignored. */
  withChanges(changes) {
    const next = { ...this };
    for (const [prop, key] of Object.entries(FIELDS)) if (changes[key] !== undefined) next[prop] = changes[key];
    return new ClinicProfile(next);
  }

  toMap() {
    return Object.fromEntries(Object.entries(FIELDS).map(([prop, key]) => [key, String(this[prop])]));
  }

  toJSON() {
    return Object.fromEntries(Object.entries(FIELDS).map(([prop, key]) => [key, this[prop]]));
  }
}
