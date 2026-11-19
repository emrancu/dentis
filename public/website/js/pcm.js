export const PLAY_RATE = 24000; // what /api/voice/speak returns: 16-bit little-endian mono PCM
const START_LEAD = 0.06; // seconds of cushion when playback starts from silence

/** Turns a byte stream of 16-bit PCM into floats. A chunk may end in the middle of a sample: the odd byte waits for the next one. */
export class Pcm16Reader {
  #odd = null;

  feed(bytes) {
    let data = bytes;
    if (this.#odd !== null) {
      data = new Uint8Array(bytes.length + 1);
      data[0] = this.#odd;
      data.set(bytes, 1);
      this.#odd = null;
    }
    if (data.length % 2) {
      this.#odd = data[data.length - 1];
      data = data.subarray(0, data.length - 1);
    }
    const view = new DataView(data.buffer, data.byteOffset, data.length);
    const out = new Float32Array(data.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
    return out;
  }
}

/** Plays PCM chunks back to back through one AudioContext, and can stop at once (barge-in). */
export class PcmPlayer {
  #ctx;
  #out;
  #next = 0;
  #sources = new Set();
  #waiting = [];

  /** @param {AudioContext} ctx @param {AudioNode} out where the sound goes (an analyser feeding the speakers) */
  constructor(ctx, out) {
    this.#ctx = ctx;
    this.#out = out;
  }

  get playing() {
    return this.#sources.size > 0;
  }

  push(samples) {
    if (!samples.length) return;
    const buffer = this.#ctx.createBuffer(1, samples.length, PLAY_RATE);
    buffer.copyToChannel(samples, 0);
    const source = this.#ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#out);
    const start = Math.max(this.#next, this.#ctx.currentTime + (this.playing ? 0 : START_LEAD));
    source.start(start);
    this.#next = start + buffer.duration;
    this.#sources.add(source);
    source.onended = () => {
      this.#sources.delete(source);
      if (!this.#sources.size) this.#release();
    };
  }

  /** Resolves when everything pushed so far has been played (or at once when nothing is playing). */
  drained() {
    return this.playing ? new Promise((resolve) => this.#waiting.push(resolve)) : Promise.resolve();
  }

  /** Silences everything now and forgets what was queued. */
  stop() {
    for (const source of this.#sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already finished
      }
    }
    this.#sources.clear();
    this.#next = 0;
    this.#release();
  }

  #release() {
    this.#waiting.splice(0).forEach((resolve) => resolve());
  }
}
