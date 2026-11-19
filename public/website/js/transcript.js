/** The ordered, speaker-labelled transcript of a call. Pure logic, unit-tested in Node. */
export class TranscriptBuilder {
  #turns = [];

  /** @param {'patient'|'agent'} speaker */
  add(speaker, text, now = () => new Date().toISOString()) {
    const clean = String(text ?? '').trim();
    if (!clean) return false;
    this.#turns.push({ speaker, text: clean, ts: now() });
    return true;
  }

  /** The turns in the shape POST /api/calls/:id/finish expects. */
  toTurns() {
    return this.#turns.map((t) => ({ ...t }));
  }
}
