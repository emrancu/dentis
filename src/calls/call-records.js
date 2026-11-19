import { NotConfiguredError, NotFoundError, RateLimitError, ValidationError } from '../shared/errors.js';
import { Call, deriveCallStatus, INTENTS, Outcome } from './call.js';
import { CallbackRequest } from './callback-request.js';
import { cleanName } from '../scheduling/patient.js';
import { PhoneNumber } from '../scheduling/phone-number.js';
import { ClinicProfile } from '../clinic/clinic-profile.js';
import { AgentPrompt } from '../agent/agent-prompt.js';

export const MAX_SESSIONS_PER_HOUR = 10;
export const MAX_CALL_SECONDS = 300;
const STALE_AFTER_MS = 30 * 60 * 1000;
const MAX_TURNS = 500;
const MAX_TURN_CHARS = 2000;

const ago = (now, ms) => new Date(now.getTime() - ms).toISOString();
const definedOnly = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export class StartCall {
  constructor({ settings, calls, voice, brain, security, clock, newId = () => crypto.randomUUID() }) {
    Object.assign(this, { settings, calls, voice, brain, security, clock, newId });
  }

  async execute({ ip }) {
    if (!this.voice.configured || !this.brain.configured) throw new NotConfiguredError('not_configured', 'The voice agent is not set up: an API key is missing.');
    const now = this.clock.now();
    const ipHash = await this.security.sha256(`dentis:${ip || 'unknown'}`);
    await this.calls.expireStale(ago(now, STALE_AFTER_MS), now.toISOString());
    if ((await this.calls.countRecentByIp(ipHash, ago(now, 3600 * 1000))) >= MAX_SESSIONS_PER_HOUR) {
      throw new RateLimitError('rate_limited', 'Too many calls from this network. Please try again later.');
    }
    const call = Call.start({ id: this.newId(), now, ipHash });
    await this.calls.create(call);
    try {
      const map = await this.settings.all();
      const { greeting, closing } = AgentPrompt.fromSettings(map).resolve(ClinicProfile.fromMap(map).nameEn);
      const listenUrl = await this.voice.createListenUrl();
      return { callId: call.id, listenUrl, maxSeconds: MAX_CALL_SECONDS, greeting, closing };
    } catch (error) {
      call.markFailed(now);
      await this.calls.save(call);
      throw error;
    }
  }
}

export class SaveCallDetails {
  constructor({ notes, patientRegistry }) {
    Object.assign(this, { notes, patientRegistry });
  }

  async execute({ callId, patientName, phone, reason, preferredDatetimeText, intent, notes }) {
    const name = patientName === undefined ? undefined : cleanName(patientName);
    const number = phone === undefined ? undefined : PhoneNumber.parse(phone).value;
    if (intent !== undefined && !INTENTS.includes(intent)) throw new ValidationError('intent_invalid', `intent must be one of: ${INTENTS.join(', ')}.`);
    const fields = definedOnly({ patientName: name, phone: number, reasonForVisit: reason, preferredDatetime: preferredDatetimeText, intent, notes });
    await this.notes.record(callId, fields);
    if (name && number) {
      const patient = await this.patientRegistry.ensure({ fullName: name, phone: number });
      await this.notes.attachPatient(callId, patient.id);
    }
    return { saved: Object.keys(fields), ...(number ? { phone_spoken: PhoneNumber.speak(number) } : {}) };
  }
}

export class RequestCallback {
  constructor({ callbacks, notes, clock }) {
    Object.assign(this, { callbacks, notes, clock });
  }

  async execute({ callId, name, phone, reason, preferredTime, urgent }) {
    const request = CallbackRequest.create({ callId, name, phone, reason, preferredTime, urgent, now: this.clock.now() });
    const saved = await this.callbacks.insert(request);
    await this.notes.record(callId, { intent: 'callback', patientName: request.name, phone: request.phone }, Outcome.CALLBACK);
    return { callback_id: saved.id, phone_spoken: PhoneNumber.speak(request.phone) };
  }
}

function cleanTurns(turns, now) {
  return (Array.isArray(turns) ? turns : [])
    .filter((t) => (t?.speaker === 'agent' || t?.speaker === 'patient') && typeof t.text === 'string' && t.text.trim())
    .slice(0, MAX_TURNS)
    .map((t, idx) => ({
      idx,
      speaker: t.speaker,
      textBn: t.text.trim().slice(0, MAX_TURN_CHARS),
      textEn: null,
      ts: Number.isNaN(Date.parse(t.ts)) ? now.toISOString() : new Date(t.ts).toISOString(),
    }));
}

export class FinishCall {
  constructor({ calls, clock }) {
    Object.assign(this, { calls, clock });
  }

  /** Idempotent: a call that already finished is returned unchanged. */
  async execute({ callId, turns, reason }) {
    const call = await this.calls.findById(callId);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    if (call.isFinished) return call;
    const now = this.clock.now();
    const clean = cleanTurns(turns, now);
    await this.calls.saveTurns(callId, clean);
    const extraction = await this.calls.getExtraction(callId);
    call.finish({
      now,
      status: deriveCallStatus({
        failed: reason === 'error',
        userTurns: clean.filter((t) => t.speaker === 'patient').length,
        outcome: extraction?.outcome,
        intent: extraction?.intent,
      }),
    });
    await this.calls.save(call);
    return call;
  }
}
