import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_VOICE_ID, ElevenLabsVoice } from '../../src/agent/elevenlabs-voice.js';
import { OpenAIBrain, toChatTools } from '../../src/agent/openai-brain.js';
import { AGENT_TOOLS } from '../../src/agent/tools.js';

const sse = (...events) => new Response(events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join(''));
const chunk = (delta) => ({ choices: [{ delta }] });
const recorder = (response) => {
  const fn = async (url, init) => ((fn.last = { url, init, body: init?.body ? JSON.parse(init.body) : null }), typeof response === 'function' ? response() : response);
  return fn;
};

describe('OpenAIBrain', () => {
  it('streams text deltas and sends the mini model with tools', async () => {
    const fetchFn = recorder(sse(chunk({ content: 'জি' }), chunk({ content: ', বলুন' }), '[DONE]'));
    const brain = new OpenAIBrain({ apiKey: 'sk-test', fetchFn });
    const parts = [];
    for await (const p of brain.stream({ messages: [{ role: 'system', content: 's' }], tools: AGENT_TOOLS })) parts.push(p);
    assert.deepEqual(parts, [{ type: 'text', delta: 'জি' }, { type: 'text', delta: ', বলুন' }, { type: 'done', toolCalls: [] }]);
    const { url, init, body } = fetchFn.last;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer sk-test');
    assert.deepEqual([body.model, body.stream], ['gpt-4.1-mini', true]);
    assert.equal(body.tools.length, AGENT_TOOLS.length);
    assert.deepEqual(Object.keys(body.tools[0]), ['type', 'function']);
  });

  it('a GPT-5 model gets minimal reasoning and short answers, to keep the first word fast', async () => {
    const fetchFn = recorder(sse('[DONE]'));
    await new OpenAIBrain({ apiKey: 'k', model: 'gpt-5-mini', fetchFn }).stream({ messages: [], tools: [] }).next();
    assert.deepEqual([fetchFn.last.body.reasoning_effort, fetchFn.last.body.verbosity], ['minimal', 'low']);
  });

  it('does not send reasoning options to a model that has none (gpt-4.1-mini would refuse them)', async () => {
    const fetchFn = recorder(sse('[DONE]'));
    await new OpenAIBrain({ apiKey: 'k', model: 'gpt-4.1-mini', fetchFn }).stream({ messages: [], tools: [] }).next();
    assert.equal('reasoning_effort' in fetchFn.last.body, false);
    assert.equal('verbosity' in fetchFn.last.body, false);
  });

  it('assembles a tool call that arrives in pieces', async () => {
    const fetchFn = recorder(
      sse(
        chunk({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'check_availability', arguments: '{"date"' } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: ':"2026-11-16"}' } }] }),
        chunk({ tool_calls: [{ index: 1, id: 'call_2', function: { name: 'end_call', arguments: '{}' } }] }),
        '[DONE]',
      ),
    );
    const parts = [];
    for await (const p of new OpenAIBrain({ apiKey: 'k', fetchFn }).stream({ messages: [], tools: [] })) parts.push(p);
    assert.deepEqual(parts.at(-1).toolCalls, [
      { id: 'call_1', name: 'check_availability', arguments: '{"date":"2026-11-16"}' },
      { id: 'call_2', name: 'end_call', arguments: '{}' },
    ]);
  });

  it('reads an event that is split across network chunks', async () => {
    const body = new ReadableStream({
      start(c) {
        const text = `data: ${JSON.stringify(chunk({ content: 'আচ্ছা' }))}\n\ndata: [DONE]\n\n`;
        c.enqueue(new TextEncoder().encode(text.slice(0, 20)));
        c.enqueue(new TextEncoder().encode(text.slice(20)));
        c.close();
      },
    });
    const parts = [];
    for await (const p of new OpenAIBrain({ apiKey: 'k', fetchFn: recorder(new Response(body)) }).stream({ messages: [], tools: [] })) parts.push(p);
    assert.equal(parts[0].delta, 'আচ্ছা');
  });

  it('fails with the status only, never the key', async () => {
    const brain = new OpenAIBrain({ apiKey: 'sk-secret', fetchFn: recorder(new Response('{}', { status: 401 })) });
    await assert.rejects(brain.stream({ messages: [], tools: [] }).next(), (e) => /401/.test(e.message) && !/sk-secret/.test(e.message));
  });

  it('is not configured without a key', () => {
    assert.equal(new OpenAIBrain({ apiKey: undefined }).configured, false);
    assert.equal(toChatTools(AGENT_TOOLS)[0].function.name, 'get_current_datetime');
  });
});

describe('ElevenLabsVoice', () => {
  it('needs only a key: without a voice id it uses the default premade voice', async () => {
    assert.equal(new ElevenLabsVoice({ apiKey: 'k' }).configured, true);
    assert.equal(new ElevenLabsVoice({ apiKey: undefined, voiceId: 'v' }).configured, false);
    const fetchFn = recorder(new Response(new Uint8Array([1])));
    await new ElevenLabsVoice({ apiKey: 'k', fetchFn }).speak('হ্যালো');
    assert.equal(fetchFn.last.body.inputs[0].voice_id, DEFAULT_VOICE_ID);
    assert.equal(fetchFn.last.body.language_code, 'bn');
  });

  it('builds a Bangla Scribe v3 Live URL with turn prediction and a one-use token, not the API key', async () => {
    const fetchFn = recorder(Response.json({ token: 'sutkn_abc' }));
    const url = new URL(await new ElevenLabsVoice({ apiKey: 'xi-secret', voiceId: 'v', fetchFn }).createListenUrl());
    assert.equal(fetchFn.last.url, 'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe');
    assert.equal(fetchFn.last.init.headers['xi-api-key'], 'xi-secret');
    assert.equal(url.origin + url.pathname, 'wss://api.elevenlabs.io/v1/speech-to-text/realtime');
    const q = Object.fromEntries(url.searchParams);
    assert.deepEqual([q.model_id, q.language_code, q.audio_format, q.commit_strategy, q.token], ['scribe_v3_live', 'bn', 'pcm_16000', 'turn_prediction', 'sutkn_abc']);
    assert.doesNotMatch(url.href, /xi-secret/);
  });

  it('fails on a token error without leaking the key', async () => {
    const voice = new ElevenLabsVoice({ apiKey: 'xi-secret', voiceId: 'v', fetchFn: recorder(new Response('{}', { status: 401 })) });
    await assert.rejects(voice.createListenUrl(), (e) => /401/.test(e.message) && !/xi-secret/.test(e.message));
  });

  it('puts ElevenLabs\' own reason in the error, so the log says why (for example a key without permission)', async () => {
    const body = JSON.stringify({ detail: { status: 'missing_permissions', message: 'The API key is missing the permission single_use_token.' } });
    const voice = new ElevenLabsVoice({ apiKey: 'xi-secret', fetchFn: recorder(new Response(body, { status: 401 })) });
    await assert.rejects(voice.createListenUrl(), (e) => /401/.test(e.message) && /missing_permissions/.test(e.message) && !/xi-secret/.test(e.message));
  });

  it('asks for Bangla PCM from Eleven v4 Turbo and returns the stream', async () => {
    const fetchFn = recorder(new Response(new Uint8Array([9, 9])));
    const signal = new AbortController().signal;
    const response = await new ElevenLabsVoice({ apiKey: 'k', voiceId: 'voice1', fetchFn }).speak('নমস্কার', { signal });
    const { url, init, body } = fetchFn.last;
    assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-dialogue/stream?output_format=pcm_24000');
    assert.equal(init.signal, signal);
    assert.deepEqual(body, { inputs: [{ text: 'নমস্কার', voice_id: 'voice1' }], model_id: 'eleven_v4_turbo', language_code: 'bn' });
    assert.equal((await response.arrayBuffer()).byteLength, 2);
  });

  it('the TTS model can be changed, and a refused request fails clearly', async () => {
    const fetchFn = recorder(new Response('{}', { status: 422 }));
    const voice = new ElevenLabsVoice({ apiKey: 'k', voiceId: 'v', ttsModel: 'eleven_v3', fetchFn });
    await assert.rejects(voice.speak('x'), /422/);
    assert.equal(fetchFn.last.body.model_id, 'eleven_v3');
  });
});

describe('OpenAIBrain with Gemini', () => {
  it('posts to the endpoint it is given and tolerates tool-call parts without an index', async () => {
    const fetchFn = recorder(
      sse(
        chunk({ tool_calls: [{ id: 'a', function: { name: 'check_availability', arguments: '{"date"' } }] }),
        chunk({ tool_calls: [{ function: { arguments: ':"2026-11-16"}' } }] }),
        chunk({ tool_calls: [{ id: 'b', function: { name: 'end_call', arguments: '{}' } }] }),
        '[DONE]',
      ),
    );
    const brain = new OpenAIBrain({ apiKey: 'g', model: 'gemini-3.1-flash-lite', endpoint: 'https://example.test/chat', fetchFn });
    const parts = [];
    for await (const p of brain.stream({ messages: [], tools: [] })) parts.push(p);
    assert.equal(fetchFn.last.url, 'https://example.test/chat');
    assert.deepEqual(parts.at(-1).toolCalls.map((c) => [c.name, c.arguments]), [['check_availability', '{"date":"2026-11-16"}'], ['end_call', '{}']]);
  });
});

describe('Gemini thought signatures', () => {
  it('keeps the signature on a streamed tool call', async () => {
    const extra = { google: { thought_signature: 'sig' } };
    const fetchFn = recorder(sse(chunk({ tool_calls: [{ index: 0, id: 'a', function: { name: 'end_call', arguments: '{}' }, extra_content: extra }] }), '[DONE]'));
    const parts = [];
    for await (const p of new OpenAIBrain({ apiKey: 'g', fetchFn }).stream({ messages: [], tools: [] })) parts.push(p);
    assert.deepEqual(parts.at(-1).toolCalls[0].extra_content, extra);
  });
});
