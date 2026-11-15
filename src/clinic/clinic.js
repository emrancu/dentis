import { ClinicProfile } from './clinic-profile.js';

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
