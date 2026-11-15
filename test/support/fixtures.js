import { buildServices } from '../../src/composition.js';
import { Doctor } from '../../src/scheduling/doctor.js';
import { Skill } from '../../src/knowledge/skill.js';
import { WebCryptoSecurity } from '../../src/admin/security.js';
import { InMemoryAppointments, InMemoryCallbacks, InMemoryCalls, InMemoryDoctors, InMemoryPatients, InMemorySettings, InMemorySkills } from './in-memory.js';

/** Saturday 2026-11-14, 10:00 in Dhaka (UTC+6). */
export const NOW = new Date('2026-11-14T04:00:00.000Z');
export const ACCESS_KEY = 'test-access-key';
export const VALID_PHONE = '01712345678';

export class FixedClock {
  constructor(now = NOW) { this.current = now; }
  now() { return this.current; }
  set(iso) { this.current = new Date(iso); }
}

export class FakeGateway {
  sessions = [];
  fail = false;
  async createClientSecret(session) {
    if (this.fail) throw new Error('gateway down');
    this.sessions.push(session);
    return { value: 'ek_test', model: 'gpt-realtime-mini' };
  }
}

/** Wires the real use cases to in-memory ports, seeded with two doctors and three skills. */
export async function buildWorld({ now = NOW } = {}) {
  let n = 0;
  const ports = {
    calls: new InMemoryCalls(),
    patients: new InMemoryPatients(),
    appointments: new InMemoryAppointments(),
    doctors: new InMemoryDoctors(),
    skills: new InMemorySkills(),
    settings: new InMemorySettings(),
    callbacks: new InMemoryCallbacks(),
    gateway: new FakeGateway(),
    security: new WebCryptoSecurity({ secret: 'test-secret' }),
    clock: new FixedClock(now),
    accessKey: ACCESS_KEY,
    newId: () => `call-${++n}`,
  };
  await ports.doctors.insert(new Doctor({ nameEn: 'Dr. Nusrat Jahan', nameBn: 'ডা. নুসরাত জাহান', specialty: 'General dentistry', days: [6, 0, 1, 2, 3, 4], startTime: '10:00', endTime: '17:00' }));
  await ports.doctors.insert(new Doctor({ nameEn: 'Dr. Tanvir Rahman', nameBn: 'ডা. তানভীর রহমান', specialty: 'Root canal', days: [6, 1, 3], startTime: '14:00', endTime: '20:00' }));
  await ports.skills.insert(new Skill({ title: 'Scaling and polishing', content: 'Fee: 1500 taka.' }));
  await ports.skills.insert(new Skill({ title: 'Root canal treatment', content: 'Fee: 6000 to 12000 taka.' }));
  await ports.skills.insert(new Skill({ title: 'Secret draft', content: 'hidden', enabled: false }));
  await ports.settings.setMany({ name_en: 'Dentis Dental Care', hours: 'Sat-Thu 10am-8pm', address: 'Dhanmondi, Dhaka' });
  return { ports, services: buildServices(ports), clock: ports.clock };
}

/** Starts a call and returns its id. */
export async function startCall(world, ip = '203.0.113.7') {
  return (await world.services.startCall.execute({ ip })).callId;
}
