export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
/** Gemini speaks the same Chat Completions protocol, and has a free tier. */
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
// Measured through the Worker: first spoken word in ~0.9-1.2 s and steady. gpt-5-mini (minimal reasoning) ranged 1.0-2.8 s. Set OPENAI_MODEL to change it.
export const DEFAULT_MODEL = 'gpt-4.1-mini';

/** Our tool definitions in the Chat Completions shape. */
export const toChatTools = (tools) => tools.map(({ name, description, parameters }) => ({ type: 'function', function: { name, description, parameters } }));

/** GPT-5 models think before they answer. Minimal reasoning and short answers keep the first word fast: this is a phone call. */
const speedOptions = (model) => (/^gpt-5/.test(model) ? { reasoning_effort: 'minimal', verbosity: 'low' } : {});

/** Splits an SSE byte stream into `data:` payloads. */
async function* sseData(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (data) yield data;
    }
  }
}

/**
 * The agent's brain: an OpenAI mini chat model with tool calling, streamed.
 * `stream()` yields `{type:'text', delta}` as words arrive, then one `{type:'done', toolCalls}`.
 */
export class OpenAIBrain {
  constructor({ apiKey, model = DEFAULT_MODEL, endpoint = OPENAI_ENDPOINT, fetchFn = (...args) => fetch(...args) }) {
    Object.assign(this, { apiKey, model, endpoint, fetchFn });
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  async *stream({ messages, tools, signal }) {
    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, tools: toChatTools(tools), stream: true, ...speedOptions(this.model) }),
      signal,
    });
    if (!response.ok) throw new Error(`Chat request failed with status ${response.status}: ${(await response.text().catch(() => '')).slice(0, 500)}`);
    const calls = [];
    for await (const data of sseData(response.body)) {
      if (data === '[DONE]') break;
      const delta = JSON.parse(data).choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) yield { type: 'text', delta: delta.content };
      for (const part of delta.tool_calls ?? []) {
        // Gemini's compatible stream can omit `index`: a part that names a function starts a new call, any other continues the last.
        const index = part.index ?? (part.function?.name ? calls.length : Math.max(calls.length - 1, 0));
        const call = (calls[index] ??= { id: '', name: '', arguments: '' });
        call.id ||= part.id ?? '';
        call.name ||= part.function?.name ?? '';
        call.arguments += part.function?.arguments ?? '';
      }
    }
    yield { type: 'done', toolCalls: calls.filter((c) => c.name) };
  }
}
