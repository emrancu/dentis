/**
 * Builds the ordered, speaker-labelled transcript from OpenAI Realtime data-channel events.
 * Pure logic with no browser APIs, so it is unit-tested in Node.
 */
const SPEAKER = { user: 'patient', assistant: 'agent' };

export class TranscriptBuilder {
  #items = new Map(); // item id -> { speaker, text, ts }

  /** Feed every parsed event. Returns true when the transcript changed. */
  handle(event, now = () => new Date().toISOString()) {
    switch (event.type) {
      case 'conversation.item.added':
      case 'conversation.item.created':
        return this.#add(event.item, now);
      case 'conversation.item.input_audio_transcription.completed':
        return this.#set(event.item_id, event.transcript, now);
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        return this.#append(event.item_id, event.delta, now);
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        return this.#set(event.item_id, event.transcript, now);
      case 'conversation.item.done':
        return this.#fromContent(event.item, now);
      default:
        return false;
    }
  }

  #add(item, now) {
    const speaker = SPEAKER[item?.role];
    if (!item?.id || item.type !== 'message' || !speaker || this.#items.has(item.id)) return false;
    this.#items.set(item.id, { speaker, text: '', ts: now() });
    return false;
  }

  #entry(id, now) {
    // A transcript can arrive before its item was announced; assume the agent when unknown.
    if (!this.#items.has(id)) this.#items.set(id, { speaker: 'agent', text: '', ts: now() });
    return this.#items.get(id);
  }

  #set(id, text, now) {
    if (!id || typeof text !== 'string') return false;
    this.#entry(id, now).text = text.trim();
    return true;
  }

  #append(id, delta, now) {
    if (!id || typeof delta !== 'string') return false;
    this.#entry(id, now).text += delta;
    return true;
  }

  #fromContent(item, now) {
    const speaker = SPEAKER[item?.role];
    if (!item?.id || item.type !== 'message' || !speaker) return false;
    const text = (item.content ?? []).map((c) => c.transcript ?? '').join(' ').trim();
    if (!text) return false;
    this.#add(item, now);
    this.#items.get(item.id).text = text;
    return true;
  }

  /** The latest agent sentence, for live captions. */
  lastAgentText() {
    return [...this.#items.values()].reverse().find((i) => i.speaker === 'agent' && i.text)?.text ?? '';
  }

  /** Turns in conversation order, empty ones dropped, in the shape POST /api/calls/:id/finish expects. */
  toTurns() {
    return [...this.#items.values()].filter((i) => i.text.trim()).map((i) => ({ speaker: i.speaker, text: i.text.trim(), ts: i.ts }));
  }
}
