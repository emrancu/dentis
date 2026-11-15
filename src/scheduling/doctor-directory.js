import { ConflictError, NotFoundError } from '../shared/errors.js';
import { Doctor } from './doctor.js';

/** Admin CRUD for doctors. */
export class DoctorDirectory {
  constructor({ doctors, appointments }) {
    Object.assign(this, { doctors, appointments });
  }

  list() {
    return this.doctors.list();
  }

  async create(input) {
    return this.doctors.insert(new Doctor(input));
  }

  async update(id, input) {
    await this.#require(id);
    const doctor = new Doctor({ ...input, id });
    await this.doctors.save(doctor);
    return doctor;
  }

  async remove(id) {
    await this.#require(id);
    if ((await this.appointments.countForDoctor(id)) > 0) {
      throw new ConflictError('doctor_has_appointments', 'This doctor has appointments. Mark the doctor inactive instead.');
    }
    await this.doctors.remove(id);
  }

  async #require(id) {
    const doctor = await this.doctors.findById(id);
    if (!doctor) throw new NotFoundError('doctor_not_found', 'Doctor not found.');
    return doctor;
  }
}
