import { NotFoundError, RateLimitError, ValidationError } from '../domain/shared/errors.js';
import { Call, deriveCallStatus, INTENTS, Outcome } from '../domain/calls/call.js';
import { CallbackRequest } from '../domain/calls/callback-request.js';
import { cleanName } from '../domain/scheduling/patient.js';
import { PhoneNumber } from '../domain/scheduling/phone-number.js';
import { ClinicProfile } from '../domain/clinic/clinic-profile.js';
import { dhakaParts } from '../domain/shared/time.js';
import { AgentPrompt } from '../domain/agent/agent-prompt.js';
import { buildInstructions } from './agent/prompt.js';
import { AGENT_TOOLS } from './agent/tools.js';

export const MAX_SESSIONS_PER_HOUR = 10;
export const MAX_CALL_SECONDS = 300;
const STALE_AFTER_MS = 30 * 60 * 1000;
const MAX_TURNS = 500;
const MAX_TURN_CHARS = 2000;
const RECORDING_EXTENSIONS = { webm: 'webm', ogg: 'ogg', mp4: 'm4a', mpeg: 'mp3' };

const ago = (now, ms) => new Date(now.getTime() - ms).toISOString();
const definedOnly = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export class StartCall {
  constructor({ calls, doctors, skills, settings, gateway, security, clock, newId = () => crypto.randomUUID() }) {
    Object.assign(this, { calls, doctors, skills, settings, gateway, security, clock, newId });
  }

  async execute({ ip, intent }) {
    const now = this.clock.now();
    const ipHash = await this.security.sha256(`dentis:${ip || 'unknown'}`);
    await this.calls.expireStale(ago(now, STALE_AFTER_MS), now.toISOString());
    if ((await this.calls.countRecentByIp(ipHash, ago(now, 3600 * 1000))) >= MAX_SESSIONS_PER_HOUR) {
      throw new RateLimitError('rate_limited', 'Too many calls from this network. Please try again later.');
    }
    const call = Call.start({ id: this.newId(), now, ipHash });
    await this.calls.create(call);
    try {
      const [doctors, skills, map] = await Promise.all([this.doctors.list(), this.skills.list(), this.settings.all()]);
      const instructions = buildInstructions({
        profile: ClinicProfile.fromMap(map),
        doctors: doctors.filter((d) => d.active),
        skills,
        now: dhakaParts(now),
        intent: intent === 'booking' ? 'booking' : 'general',
        agentPrompt: AgentPrompt.fromSettings(map),
      });
      const secret = await this.gateway.createClientSecret({ instructions, tools: AGENT_TOOLS });
      return { callId: call.id, clientSecret: secret.value, model: secret.model, maxSeconds: MAX_CALL_SECONDS };
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
    return { saved: Object.keys(fields) };
  }
}

export class RequestCallback {
  constructor({ callbacks, notes, clock }) {
    Object.assign(this, { callbacks, notes, clock });
  }

  async execute({ callId, name, phone, reason, preferredTime }) {
    const request = CallbackRequest.create({ callId, name, phone, reason, preferredTime, now: this.clock.now() });
    const saved = await this.callbacks.insert(request);
    await this.notes.record(callId, { intent: 'callback', patientName: request.name, phone: request.phone }, Outcome.CALLBACK);
    return { callback_id: saved.id };
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

/** After the call: English summary and translation, and fills extraction gaps. Never overrides data the tools captured. */
export class AnalyzeCall {
  constructor({ calls, analyzer }) {
    Object.assign(this, { calls, analyzer });
  }

  async execute({ callId }) {
    const call = await this.calls.findById(callId);
    const turns = await this.calls.getTurns(callId);
    if (!call || turns.length === 0) return;
    const result = await this.analyzer.analyze({ turns });
    await this.calls.saveTurns(callId, turns.map((t, i) => ({ ...t, textEn: result.english?.[i] ?? t.textEn })));
    const current = (await this.calls.getExtraction(callId)) ?? {};
    const guess = result.extraction ?? {};
    const fill = {};
    for (const key of ['patientName', 'reasonForVisit', 'preferredDatetime']) if (!current[key] && guess[key]) fill[key] = guess[key];
    if (!current.intent && INTENTS.includes(guess.intent)) fill.intent = guess.intent;
    if (!current.phone && guess.phone) {
      try {
        fill.phone = PhoneNumber.parse(guess.phone).value;
      } catch {
        // an unreadable guessed number is dropped rather than stored
      }
    }
    await this.calls.mergeExtraction(callId, fill);
    call.summary = result.summary || null;
    await this.calls.save(call);
  }
}

export class StoreRecording {
  constructor({ calls, recordings }) {
    Object.assign(this, { calls, recordings });
  }

  async execute({ callId, body, contentType }) {
    const call = await this.calls.findById(callId);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    const subtype = /^audio\/([a-z0-9]+)/i.exec(contentType ?? '')?.[1]?.toLowerCase();
    if (!subtype) throw new ValidationError('recording_type_invalid', 'Recording must be audio.');
    const key = `calls/${callId}.${RECORDING_EXTENSIONS[subtype] ?? 'bin'}`;
    await this.recordings.put(key, body, contentType);
    call.attachRecording(key);
    await this.calls.save(call);
  }
}
