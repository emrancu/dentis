/**
 * Cuts the brain's streamed text into sentences, so each one can be spoken the moment it is complete.
 * A danda, "?" or "!" ends a sentence at once. A "." or a newline ends it only when whitespace follows,
 * so "10.30" is never split. A very long run without punctuation is cut at a space.
 */
const SURE_END = new Set(['।', '?', '!']);
export const MAX_SENTENCE = 400;

const CLAUSE_END = new Set([',', '،', ';', ':', '—', '–']);
export const FIRST_CLAUSE_MIN = 14; // characters, so "জি," alone is not spoken as a piece

function boundary(text, first) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (SURE_END.has(c)) {
      let end = i + 1;
      while (SURE_END.has(text[end])) end++; // "?!" stays together
      return end;
    }
    if ((c === '.' || c === '…' || c === '\n') && i + 1 < text.length && /\s/.test(text[i + 1])) return i + 1;
    if (c === '\n') return i + 1;
    // The first piece of a reply is spoken at its first clause, so the caller hears something sooner.
    if (first && CLAUSE_END.has(c) && i + 1 >= FIRST_CLAUSE_MIN && i + 1 < text.length && /\s/.test(text[i + 1])) return i + 1;
  }
  if (text.length > MAX_SENTENCE) {
    const cut = text.lastIndexOf(' ', MAX_SENTENCE);
    return cut > 0 ? cut : MAX_SENTENCE;
  }
  return -1;
}

export class SentenceChunker {
  #buffer = '';
  #first = true;

  /** Adds streamed text and returns the sentences that are now complete. */
  push(delta) {
    this.#buffer += delta;
    const out = [];
    for (let end = boundary(this.#buffer, this.#first); end > 0; end = boundary(this.#buffer, this.#first)) {
      const sentence = this.#buffer.slice(0, end).trim();
      this.#buffer = this.#buffer.slice(end);
      if (sentence) {
        out.push(sentence);
        this.#first = false;
      }
    }
    return out;
  }

  /** The end of the reply: whatever is left. */
  flush() {
    const rest = this.#buffer.trim();
    this.#buffer = '';
    if (rest) this.#first = false;
    return rest ? [rest] : [];
  }
}
