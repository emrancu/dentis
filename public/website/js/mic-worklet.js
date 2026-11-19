/** AudioWorklet: turns the microphone into 16 kHz 16-bit PCM, in blocks of about 100 ms. */
const TARGET = 16000;
const BLOCK = 1600;

class MicToPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / TARGET;
    this.position = 0; // read position in the incoming samples, can be fractional
    this.carry = new Float32Array(0);
    this.out = new Int16Array(BLOCK);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const samples = new Float32Array(this.carry.length + input.length);
    samples.set(this.carry);
    samples.set(input, this.carry.length);
    let pos = this.position;
    while (pos + 1 < samples.length) {
      const i = Math.floor(pos);
      const value = samples[i] + (samples[i + 1] - samples[i]) * (pos - i); // linear interpolation
      this.out[this.filled++] = Math.max(-1, Math.min(1, value)) * 32767;
      if (this.filled === BLOCK) {
        this.port.postMessage(this.out.slice());
        this.filled = 0;
      }
      pos += this.step;
    }
    const keep = Math.floor(pos);
    this.carry = samples.slice(keep);
    this.position = pos - keep;
    return true;
  }
}

registerProcessor('mic-to-pcm', MicToPcm);
