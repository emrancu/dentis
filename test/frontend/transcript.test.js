import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { errorKindOf, sessionUpdateGreeting, toolCallFrom, toolOutputMessages } from '../../public/js/call-messages.js';
import { TranscriptBuilder } from '../../public/js/transcript.js';

const clock = (() => { let n = 0; return () => `2026-11-14T04:00:${String(n++).padStart(2, '0')}.000Z`; })();
const item = (id, role, type = 'message') => ({ type: 'conversation.item.added', item: { id, role, type } });

describe('TranscriptBuilder', () => {
  it('orders turns by when their items were announced, not by when transcripts arrive', () => {
    const t = new TranscriptBuilder();
    t.handle(item('u1', 'user'), clock);
    t.handle(item('a1', 'assistant'), clock);
    // the agent finishes speaking before the caller's transcription comes back
    t.handle({ type: 'response.output_audio_transcript.done', item_id: 'a1', transcript: 'আপনার নাম বলুন' }, clock);
    t.handle({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: ' আমি অ্যাপয়েন্টমেন্ট চাই ' }, clock);
    assert.deepEqual(t.toTurns().map((x) => [x.speaker, x.text]), [['patient', 'আমি অ্যাপয়েন্টমেন্ট চাই'], ['agent', 'আপনার নাম বলুন']]);
  });

  it('streams agent text from deltas and exposes the latest sentence for captions', () => {
    const t = new TranscriptBuilder();
    t.handle(item('a1', 'assistant'), clock);
    assert.equal(t.handle({ type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'আস' }, clock), true);
    t.handle({ type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'সালামু' }, clock);
    assert.equal(t.lastAgentText(), 'আসসালামু');
  });

  it('understands the older event names too', () => {
    const t = new TranscriptBuilder();
    t.handle({ type: 'conversation.item.created', item: { id: 'a1', role: 'assistant', type: 'message' } }, clock);
    t.handle({ type: 'response.audio_transcript.done', item_id: 'a1', transcript: 'hello' }, clock);
    assert.equal(t.toTurns()[0].text, 'hello');
  });

  it('takes the text from a finished item when no transcript event came', () => {
    const t = new TranscriptBuilder();
    t.handle({ type: 'conversation.item.done', item: { id: 'a1', role: 'assistant', type: 'message', content: [{ type: 'output_audio', transcript: 'ধন্যবাদ' }] } }, clock);
    assert.deepEqual(t.toTurns().map((x) => x.text), ['ধন্যবাদ']);
  });

  it('ignores function calls, system items, blank text and unrelated events', () => {
    const t = new TranscriptBuilder();
    t.handle(item('f1', 'assistant', 'function_call'), clock);
    t.handle(item('s1', 'system'), clock);
    t.handle(item('u1', 'user'), clock);
    t.handle({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: '   ' }, clock);
    assert.equal(t.handle({ type: 'session.updated' }, clock), false);
    assert.deepEqual(t.toTurns(), []);
  });

  it('keeps a transcript that arrives before its item was announced', () => {
    const t = new TranscriptBuilder();
    t.handle({ type: 'response.output_audio_transcript.done', item_id: 'late', transcript: 'hi' }, clock);
    assert.equal(t.toTurns().length, 1);
  });

  it('does not announce the same item twice', () => {
    const t = new TranscriptBuilder();
    t.handle(item('a1', 'assistant'), clock);
    t.handle({ type: 'response.output_audio_transcript.done', item_id: 'a1', transcript: 'one' }, clock);
    t.handle(item('a1', 'assistant'), clock);
    assert.equal(t.toTurns().length, 1);
  });

  it('produces the shape the finish endpoint expects', () => {
    const t = new TranscriptBuilder();
    t.handle(item('u1', 'user'), () => '2026-11-14T04:00:05.000Z');
    t.handle({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'hi' });
    assert.deepEqual(t.toTurns(), [{ speaker: 'patient', text: 'hi', ts: '2026-11-14T04:00:05.000Z' }]);
  });
});

describe('call messages', () => {
  const done = (item) => ({ type: 'response.output_item.done', item });

  it('extracts a function call with parsed arguments', () => {
    assert.deepEqual(toolCallFrom(done({ type: 'function_call', name: 'book_appointment', call_id: 'c1', arguments: '{"date":"2026-11-15"}' })), { name: 'book_appointment', callId: 'c1', args: { date: '2026-11-15' } });
  });

  it('survives empty or malformed arguments', () => {
    assert.deepEqual(toolCallFrom(done({ type: 'function_call', name: 'end_call', call_id: 'c1', arguments: '' })).args, {});
    assert.deepEqual(toolCallFrom(done({ type: 'function_call', name: 'x', call_id: 'c1', arguments: '{oops' })).args, {});
  });

  it('ignores everything that is not a finished function call', () => {
    assert.equal(toolCallFrom(done({ type: 'message' })), null);
    assert.equal(toolCallFrom({ type: 'response.done' }), null);
    assert.equal(toolCallFrom(done({ type: 'function_call', name: 'x' })), null);
    assert.equal(toolCallFrom(null), null);
  });

  it('answers a tool call with its output and asks the model to continue', () => {
    const [output, resume] = toolOutputMessages('c1', { ok: true });
    assert.deepEqual(output, { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: 'c1', output: '{"ok":true}' } });
    assert.deepEqual(resume, { type: 'response.create' });
  });

  it('starts the call by asking the model to greet', () => {
    assert.equal(sessionUpdateGreeting().type, 'response.create');
  });

  it('maps browser errors to message keys', () => {
    assert.equal(errorKindOf({ name: 'NotAllowedError' }), 'mic_denied');
    assert.equal(errorKindOf({ name: 'NotFoundError' }), 'no_mic');
    assert.equal(errorKindOf({ kind: 'rate_limited' }), 'rate_limited');
    assert.equal(errorKindOf(new Error('boom')), 'connection_failed');
    assert.equal(errorKindOf(undefined), 'connection_failed');
  });
});
