import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENT_TOOLS } from '../../src/application/agent/tools.js';
import { OpenAICallAnalyzer } from '../../src/infrastructure/openai/call-analyzer.js';
import { OpenAIRealtimeGateway } from '../../src/infrastructure/openai/realtime-gateway.js';

const reply = (body, status = 200) => async (url, init) => {
  reply.last = { url, init, body: init.body ? JSON.parse(init.body) : null };
  return { ok: status < 400, status, json: async () => body };
};

describe('OpenAIRealtimeGateway', () => {
  it('requests a client secret with the Realtime session config and returns only the short-lived value', async () => {
    const fetchFn = reply({ value: 'ek_abc', expires_at: 1 });
    const gateway = new OpenAIRealtimeGateway({ apiKey: 'sk-test', fetchFn });
    const result = await gateway.createClientSecret({ instructions: 'Be kind', tools: AGENT_TOOLS });
    assert.deepEqual(result, { value: 'ek_abc', model: 'gpt-realtime' });

    const { url, init, body } = reply.last;
    assert.equal(url, 'https://api.openai.com/v1/realtime/client_secrets');
    assert.equal(init.headers.Authorization, 'Bearer sk-test');
    assert.equal(body.session.type, 'realtime');
    assert.equal(body.session.model, 'gpt-realtime');
    assert.equal(body.session.instructions, 'Be kind');
    assert.equal(body.session.tools.length, AGENT_TOOLS.length);
    assert.equal(body.session.audio.output.voice, 'marin');
  });

  it('transcribes the caller in Bangla and uses semantic turn detection', async () => {
    await new OpenAIRealtimeGateway({ apiKey: 'k', fetchFn: reply({ value: 'ek' }) }).createClientSecret({ instructions: '', tools: [] });
    const input = reply.last.body.session.audio.input;
    assert.deepEqual(input.transcription, { model: 'gpt-4o-transcribe', language: 'bn' });
    assert.equal(input.turn_detection.type, 'semantic_vad');
  });

  it('fails clearly without leaking the key when OpenAI refuses', async () => {
    const gateway = new OpenAIRealtimeGateway({ apiKey: 'sk-secret', fetchFn: reply({}, 401) });
    await assert.rejects(gateway.createClientSecret({ instructions: '', tools: [] }), (e) => /401/.test(e.message) && !/sk-secret/.test(e.message));
  });

  it('fails when the response has no secret', async () => {
    await assert.rejects(new OpenAIRealtimeGateway({ apiKey: 'k', fetchFn: reply({}) }).createClientSecret({ instructions: '', tools: [] }), /no value/);
  });
});

describe('OpenAICallAnalyzer', () => {
  const turns = [
    { speaker: 'agent', textBn: 'আসসালামু আলাইকুম' },
    { speaker: 'patient', textBn: 'আমি অ্যাপয়েন্টমেন্ট চাই' },
  ];
  const content = { summary: 'Wants an appointment.', english: ['Peace be upon you', 'I want an appointment'], extraction: { patient_name: null, phone: '01712345678', reason_for_visit: 'toothache', preferred_datetime: 'Sunday evening', intent: 'booking' } };

  it('sends the numbered transcript with a strict JSON schema and maps the answer to camelCase', async () => {
    const fetchFn = reply({ choices: [{ message: { content: JSON.stringify(content) } }] });
    const result = await new OpenAICallAnalyzer({ apiKey: 'sk', fetchFn }).analyze({ turns });
    assert.deepEqual(result, {
      summary: 'Wants an appointment.',
      english: ['Peace be upon you', 'I want an appointment'],
      extraction: { patientName: null, phone: '01712345678', reasonForVisit: 'toothache', preferredDatetime: 'Sunday evening', intent: 'booking' },
    });
    const { body } = reply.last;
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.match(body.messages[1].content, /1\. Receptionist: আসসালামু আলাইকুম\n2\. Patient: আমি অ্যাপয়েন্টমেন্ট চাই/);
  });

  it('throws when the API fails so the caller can skip analysis', async () => {
    await assert.rejects(new OpenAICallAnalyzer({ apiKey: 'sk', fetchFn: reply({}, 500) }).analyze({ turns }), /500/);
  });
});

describe('default fetch', () => {
  it('is called without the adapter as `this` (Workers throw "Illegal invocation" otherwise)', async () => {
    const original = globalThis.fetch;
    let thisSeen;
    globalThis.fetch = function () { thisSeen = this; return Promise.resolve({ ok: true, status: 200, json: async () => ({ value: 'ek' }) }); };
    try {
      await new OpenAIRealtimeGateway({ apiKey: 'k' }).createClientSecret({ instructions: '', tools: [] });
      await new OpenAICallAnalyzer({ apiKey: 'k' }).analyze?.({ transcript: [], intent: 'general' }).catch(() => {});
    } finally { globalThis.fetch = original; }
    assert.ok(thisSeen === undefined || thisSeen === globalThis, 'fetch must not be bound to the adapter');
  });
});
