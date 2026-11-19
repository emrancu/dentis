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

/** ElevenLabs stand-in: hands out a listen URL and records what was spoken. */
export class FakeVoice {
  configured = true;
  fail = false;
  spoken = [];
  async createListenUrl() {
    if (this.fail) throw new Error('voice down');
    return 'wss://stt.test/realtime?token=sutkn_test';
  }
  async speak(text) {
    this.spoken.push(text);
    return new Response(new Uint8Array([1, 2, 3, 4]));
  }
}

/**
 * OpenAI stand-in. `replies` is a queue of replies; each reply is a list of text deltas,
 * or `{ toolCalls: [{ id, name, arguments }] }`. With the queue empty it answers "ঠিক আছে।".
 * Every request is kept in `requests`, so tests can read the system prompt and the history.
 */
export class FakeBrain {
  configured = true;
  requests = [];
  replies = [];
  async *stream({ messages, tools }) {
    this.requests.push({ messages, tools });
    const reply = this.replies.shift() ?? ['ঠিক আছে।'];
    if (reply.toolCalls) return yield { type: 'done', toolCalls: reply.toolCalls };
    for (const delta of reply) yield { type: 'text', delta };
    yield { type: 'done', toolCalls: [] };
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
    voice: new FakeVoice(),
    brain: new FakeBrain(),
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

/** Starts a call, runs one turn, and returns the system prompt the brain saw. */
export async function promptOf(world, { ip = '203.0.113.7', intent } = {}) {
  const callId = await startCall(world, ip);
  const turn = await world.services.runAgentTurn.start({ callId, messages: [{ role: 'user', content: 'হ্যালো' }], intent });
  return turn.system.content;
}
