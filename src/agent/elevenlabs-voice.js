const API = 'https://api.elevenlabs.io/v1';
export const STT_MODEL = 'scribe_v3_live';
// Flash v2.5 has no Bangla. Eleven v4 Turbo supports Bengali (bn), is built for real time (~100 ms) and is served by the dialogue endpoint.
export const DEFAULT_TTS_MODEL = 'eleven_v4_turbo';
export const TTS_SAMPLE_RATE = 24000;
// A premade ElevenLabs voice ("Sarah", warm and calm). The v4 models are multilingual, so it speaks Bangla when `language_code` is `bn`.
// Set ELEVENLABS_VOICE_ID to use a Bangla voice from the voice library instead.
export const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

/**
 * ElevenLabs: speech recognition (a single-use token for the browser's Scribe WebSocket)
 * and speech synthesis (streamed PCM). The API key never leaves the Worker.
 */
/** What ElevenLabs said was wrong (never the key), for the server log. */
async function reason(response) {
  try {
    const { detail } = await response.json();
    const text = typeof detail === 'string' ? detail : [detail?.status, detail?.message].filter(Boolean).join(': ');
    return text ? ` (${text.slice(0, 200)})` : '';
  } catch {
    return '';
  }
}

export class ElevenLabsVoice {
  constructor({ apiKey, voiceId = DEFAULT_VOICE_ID, ttsModel = DEFAULT_TTS_MODEL, fetchFn = (...args) => fetch(...args) }) {
    Object.assign(this, { apiKey, voiceId, ttsModel, fetchFn });
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  /** The URL the browser opens for live Bangla transcription. Valid for one connection and 15 minutes. */
  async createListenUrl() {
    const response = await this.fetchFn(`${API}/single-use-token/realtime_scribe`, { method: 'POST', headers: { 'xi-api-key': this.apiKey } });
    if (!response.ok) throw new Error(`ElevenLabs token request failed with status ${response.status}${await reason(response)}`);
    const { token } = await response.json();
    if (!token) throw new Error('ElevenLabs token response had no token');
    const query = new URLSearchParams({
      model_id: STT_MODEL,
      language_code: 'bn',
      audio_format: 'pcm_16000',
      // The model judges when the caller has finished, so a pause between phone digits is not the end of the turn.
      commit_strategy: 'turn_prediction',
      vad_silence_threshold_secs: '0.8',
      keepalive_interval_ms: '1000',
      token,
    });
    return `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${query}`;
  }

  /** Starts synthesis and returns the streaming Response (raw 16-bit PCM, 24 kHz, mono). */
  async speak(text, { signal } = {}) {
    const response = await this.fetchFn(`${API}/text-to-dialogue/stream?output_format=pcm_${TTS_SAMPLE_RATE}`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: [{ text, voice_id: this.voiceId }], model_id: this.ttsModel, language_code: 'bn' }),
      signal,
    });
    if (!response.ok) throw new Error(`ElevenLabs speech request failed with status ${response.status}${await reason(response)}`);
    return response;
  }
}
