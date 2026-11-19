import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APOLOGY_TEXT, errorKindOf } from '../../public/website/js/call-messages.js';
import { TranscriptBuilder } from '../../public/website/js/transcript.js';

describe('TranscriptBuilder', () => {
  it('keeps turns in the order they were added, trimmed, in the shape the finish endpoint expects', () => {
    const t = new TranscriptBuilder();
    t.add('agent', ' আসসালামু আলাইকুম ', () => '2026-11-14T04:00:00.000Z');
    t.add('patient', 'অ্যাপয়েন্টমেন্ট চাই', () => '2026-11-14T04:00:05.000Z');
    assert.deepEqual(t.toTurns(), [
      { speaker: 'agent', text: 'আসসালামু আলাইকুম', ts: '2026-11-14T04:00:00.000Z' },
      { speaker: 'patient', text: 'অ্যাপয়েন্টমেন্ট চাই', ts: '2026-11-14T04:00:05.000Z' },
    ]);
  });

  it('drops blank text', () => {
    const t = new TranscriptBuilder();
    assert.equal(t.add('patient', '   '), false);
    assert.equal(t.add('agent', undefined), false);
    assert.deepEqual(t.toTurns(), []);
  });

  it('hands out copies, so callers cannot change the record', () => {
    const t = new TranscriptBuilder();
    t.add('agent', 'hi');
    t.toTurns()[0].text = 'changed';
    assert.equal(t.toTurns()[0].text, 'hi');
  });
});

describe('call messages', () => {
  it('maps browser and app failures to the message the visitor sees', () => {
    assert.equal(errorKindOf({ kind: 'rate_limited' }), 'rate_limited');
    assert.equal(errorKindOf({ name: 'NotAllowedError' }), 'mic_denied');
    assert.equal(errorKindOf({ name: 'NotFoundError' }), 'no_mic');
    assert.equal(errorKindOf(new Error('x')), 'connection_failed');
  });

  it('has an apology in Bangla for a failed turn', () => {
    assert.match(APOLOGY_TEXT, /দুঃখিত/);
  });
});
