import { doctorDto } from '../shared/dto.js';

/** Public data for the landing page. */
export class GetPublicSite {
  constructor({ clinic, doctors }) {
    Object.assign(this, { clinic, doctors });
  }

  async execute() {
    const [profile, doctors] = await Promise.all([this.clinic.profile(), this.doctors.list()]);
    return {
      clinic: profile.toJSON(),
      doctors: doctors.filter((d) => d.active).map(doctorDto),
    };
  }
}
