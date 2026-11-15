import { ConflictError, NotFoundError } from '../domain/shared/errors.js';
import { ClinicProfile } from '../domain/clinic/clinic-profile.js';
import { Doctor } from '../domain/scheduling/doctor.js';
import { doctorDto } from './dto.js';

export class ClinicService {
  constructor({ settings }) {
    this.settings = settings;
  }

  async profile() {
    return ClinicProfile.fromMap(await this.settings.all());
  }

  async update(changes) {
    const next = (await this.profile()).withChanges(changes);
    await this.settings.setMany(next.toMap());
    return next;
  }
}

/** Public data for the landing page. */
export class GetPublicSite {
  constructor({ clinic, skills, doctors }) {
    Object.assign(this, { clinic, skills, doctors });
  }

  async execute() {
    const [profile, skills, doctors] = await Promise.all([this.clinic.profile(), this.skills.list(), this.doctors.list()]);
    return {
      clinic: profile.toJSON(),
      skills: skills.filter((s) => s.enabled && s.onWebsite && s.kind === 'service').map(({ id, title, description, titleBn, descriptionBn }) => ({ id, title, description, title_bn: titleBn, description_bn: descriptionBn })),
      doctors: doctors.filter((d) => d.active).map(doctorDto),
    };
  }
}

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

