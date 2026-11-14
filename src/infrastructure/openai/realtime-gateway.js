const ENDPOINT = 'https://api.openai.com/v1/realtime/client_secrets';
const SECRET_TTL_SECONDS = 300;

/** Mints a short-lived client secret so the browser can open the Realtime WebRTC session without our API key. */
export class OpenAIRealtimeGateway {
  constructor({ apiKey, model = 'gpt-realtime', voice = 'marin', fetchFn = fetch }) {
    Object.assign(this, { apiKey, model, voice, fetchFn });
  }

  async createClientSecret({ instructions, tools }) {
    const response = await this.fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: SECRET_TTL_SECONDS },
        session: {
          type: 'realtime',
          model: this.model,
          instructions,
          tools,
          tool_choice: 'auto',
          audio: {
            input: {
              transcription: { model: 'gpt-4o-transcribe', language: 'bn' },
              turn_detection: { type: 'semantic_vad' },
              noise_reduction: { type: 'near_field' },
            },
            output: { voice: this.voice },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI client secret request failed with status ${response.status}`);
    const data = await response.json();
    if (!data.value) throw new Error('OpenAI client secret response had no value');
    return { value: data.value, model: this.model };
  }
}
