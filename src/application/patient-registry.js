import { Patient } from '../domain/scheduling/patient.js';
import { PhoneNumber } from '../domain/scheduling/phone-number.js';

/** Finds a patient by phone number, or registers a new one. The first recorded name is kept. */
export class PatientRegistry {
  constructor({ patients, clock }) {
    this.patients = patients;
    this.clock = clock;
  }

  async ensure({ fullName, phone }) {
    const number = PhoneNumber.parse(phone).value;
    const existing = await this.patients.findByPhone(number);
    if (existing) return existing;
    return this.patients.insert(Patient.register({ fullName, phone: number, now: this.clock.now() }));
  }
}
