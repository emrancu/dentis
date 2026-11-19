import { ConflictError, NotConfiguredError, NotFoundError, ValidationError } from '../shared/errors.js';

export const MAX_SPEECH_CHARS = 600;

/** Speaks one piece of text for a live call. The browser calls this once per sentence. */
export class SynthesizeSpeech {
  constructor({ voice, calls }) {
    Object.assign(this, { voice, calls });
  }

  async execute({ callId, text, signal }) {
    if (!this.voice.configured) throw new NotConfiguredError('not_configured', 'The voice key is not set up.');
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) throw new ValidationError('text_required', 'text is required.');
    if (clean.length > MAX_SPEECH_CHARS) throw new ValidationError('text_too_long', `text must be at most ${MAX_SPEECH_CHARS} characters.`);
    const call = await this.calls.findById(callId);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    if (call.isFinished) throw new ConflictError('call_finished', 'This call has ended.');
    return this.voice.speak(clean, { signal });
  }
}

/** A fresh listen URL for a live call whose speech connection dropped. */
export class RenewListenUrl {
  constructor({ voice, calls }) {
    Object.assign(this, { voice, calls });
  }

  async execute({ callId }) {
    if (!this.voice.configured) throw new NotConfiguredError('not_configured', 'The voice key is not set up.');
    const call = await this.calls.findById(callId);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    if (call.isFinished) throw new ConflictError('call_finished', 'This call has ended.');
    return this.voice.createListenUrl();
  }
}
