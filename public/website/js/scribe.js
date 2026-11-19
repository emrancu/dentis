export const SCRIBE_RATE = 16000;

const toBase64 = (int16) => {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/** One audio chunk as the realtime speech-to-text API wants it. */
export const audioChunkMessage = (int16) => ({ message_type: 'input_audio_chunk', audio_base_64: toBase64(int16), commit: false, sample_rate: SCRIBE_RATE });

/** Maps a message from Scribe to `{type: 'partial'|'committed'|'error'|'ready'|'other', text?}`. */
export function parseScribeMessage(data) {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch {
    return { type: 'other' };
  }
  const kind = String(msg?.message_type ?? '');
  if (kind === 'session_started') return { type: 'ready' };
  if (kind === 'partial_transcript') return { type: 'partial', text: String(msg.text ?? '').trim() };
  if (kind === 'committed_transcript') return { type: 'committed', text: String(msg.text ?? '').trim() };
  if (msg?.error || /error|exceeded|limit/i.test(kind)) return { type: 'error', text: String(msg.error ?? kind) };
  return { type: 'other' }; // timestamps, entities and the like
}

/** The live Bangla speech-to-text connection. Events: `partial`, `committed` ({text}), `ready`, `error`, `close`. */
export class ScribeConnection extends EventTarget {
  #ws;

  open(url) {
    return new Promise((resolve, reject) => {
      const ws = (this.#ws = new WebSocket(url));
      let opened = false;
      ws.onmessage = (e) => {
        const m = parseScribeMessage(e.data);
        if (m.type === 'ready') {
          opened = true;
          resolve();
        }
        if (m.type !== 'other') this.dispatchEvent(new CustomEvent(m.type, { detail: m }));
        if (m.type === 'error' && !opened) reject(new Error(m.text));
      };
      ws.onerror = () => !opened && reject(new Error('scribe_connect_failed'));
      ws.onclose = () => {
        if (!opened) reject(new Error('scribe_closed'));
        this.dispatchEvent(new CustomEvent('close'));
      };
    });
  }

  get isOpen() {
    return this.#ws?.readyState === WebSocket.OPEN;
  }

  sendAudio(int16) {
    if (this.isOpen) this.#ws.send(JSON.stringify(audioChunkMessage(int16)));
  }

  close() {
    if (!this.#ws) return;
    this.#ws.onclose = null;
    this.#ws.close();
  }
}
