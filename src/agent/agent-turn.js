import { ConflictError, NotFoundError, NotConfiguredError, ValidationError } from '../shared/errors.js';
import { dhakaParts } from '../shared/time.js';
import { ClinicProfile } from '../clinic/clinic-profile.js';
import { MAX_CALL_SECONDS } from '../calls/call-records.js';
import { AgentPrompt } from './agent-prompt.js';
import { buildInstructions } from './prompt.js';
import { AGENT_TOOLS } from './tools.js';

/** Gemini 3 thought signature, kept only in its known shape and size, so a tampered history cannot smuggle other data. */
const signature = (extra) => (typeof extra?.google?.thought_signature === 'string' && extra.google.thought_signature.length < 20000 ? { extra_content: { google: { thought_signature: extra.google.thought_signature } } } : {});

const MAX_MESSAGES = 80;
const MAX_CONTENT_CHARS = 4000;
const MAX_TOOL_ROUNDS = 5;
const TIME_LIMIT_GRACE_SECONDS = 15;
const ROLES = ['user', 'assistant', 'tool'];

const TOOL_UNAVAILABLE = { ok: false, error: 'tool_unavailable', message: 'The system could not do that right now. Offer a human callback.' };

/** Keeps only well-formed chat messages, so a client cannot smuggle in a system prompt. */
function cleanMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) throw new ValidationError('messages_required', 'messages must be a non-empty list.');
  if (messages.length > MAX_MESSAGES) throw new ValidationError('messages_too_long', 'This conversation is too long.');
  return messages.map((m) => {
    if (!ROLES.includes(m?.role)) throw new ValidationError('message_invalid', 'Each message needs a role of user, assistant or tool.');
    const content = typeof m.content === 'string' ? m.content.slice(0, MAX_CONTENT_CHARS) : '';
    if (m.role === 'tool') return { role: 'tool', tool_call_id: String(m.tool_call_id ?? ''), content };
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const tool_calls = m.tool_calls.map((c) => ({ id: String(c.id), type: 'function', function: { name: String(c.function?.name ?? ''), arguments: String(c.function?.arguments ?? '{}') }, ...signature(c.extra_content) }));
      return { role: 'assistant', content: content || null, tool_calls };
    }
    return { role: m.role, content };
  });
}

/**
 * One turn of the conversation: the caller said something, the brain answers, tools run on the way.
 * `start()` checks the call and builds the prompt. `events()` then streams:
 * `{type:'text', delta}` words to speak, `{type:'messages', messages}` new history (a tool round, or the final reply),
 * and `{type:'end_call'}` when the agent decided the call is over.
 */
export class RunAgentTurn {
  constructor({ brain, toolExecutor, calls, doctors, skills, settings, clock }) {
    Object.assign(this, { brain, toolExecutor, calls, doctors, skills, settings, clock });
  }

  async start({ callId, messages, intent }) {
    if (!this.brain.configured) throw new NotConfiguredError('not_configured', 'The AI key is not set up.');
    const history = cleanMessages(messages);
    const call = await this.calls.findById(callId);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    if (call.isFinished) throw new ConflictError('call_finished', 'This call has ended.');
    const now = this.clock.now();
    if ((now - new Date(call.startedAt)) / 1000 > MAX_CALL_SECONDS + TIME_LIMIT_GRACE_SECONDS) throw new ConflictError('call_time_limit', 'The call time limit has passed.');
    const [doctors, skills, map] = await Promise.all([this.doctors.list(), this.skills.list(), this.settings.all()]);
    const instructions = buildInstructions({
      profile: ClinicProfile.fromMap(map),
      doctors: doctors.filter((d) => d.active),
      skills,
      now: dhakaParts(now),
      intent: intent === 'booking' ? 'booking' : 'general',
      agentPrompt: AgentPrompt.fromSettings(map),
    });
    return { callId, system: { role: 'system', content: instructions }, history };
  }

  async *events({ callId, system, history }, signal) {
    const conversation = [...history];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let text = '';
      let toolCalls = [];
      for await (const part of this.brain.stream({ messages: [system, ...conversation], tools: AGENT_TOOLS, signal })) {
        if (part.type === 'text') {
          text += part.delta;
          yield part;
        } else toolCalls = part.toolCalls;
      }
      if (!toolCalls.length) {
        if (text) yield { type: 'messages', messages: [{ role: 'assistant', content: text }] };
        return;
      }
      const assistant = { role: 'assistant', content: text || null, tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments }, ...signature(c.extra_content) })) };
      const results = [];
      let ending = false;
      for (const call of toolCalls) {
        results.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(await this.#run(call, callId)) });
        if (call.name === 'end_call') ending = true;
      }
      conversation.push(assistant, ...results);
      yield { type: 'messages', messages: [assistant, ...results] };
      if (ending) {
        yield { type: 'end_call' };
        return;
      }
    }
    yield { type: 'text', delta: 'দুঃখিত, একটু সমস্যা হচ্ছে।' };
  }

  async #run(call, callId) {
    let args = {};
    try {
      args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch {
      args = {};
    }
    try {
      return await this.toolExecutor.execute(call.name, args, callId);
    } catch {
      return TOOL_UNAVAILABLE;
    }
  }
}
