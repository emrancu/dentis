import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closingOnlyMessage, interruptMessages, nudgeMessage } from '../../public/website/js/call-messages.js';
import { IDLE, IdleWatch } from '../../public/website/js/idle.js';

describe('IdleWatch', () => {
  it('nudges once after 25 seconds of silence and hangs up at 50', () => {
    const w = new IdleWatch(0);
    assert.equal(w.check(24999), null);
    assert.equal(w.check(25000), 'nudge');
    assert.equal(w.check(26000), null, 'only one nudge per silence');
    assert.equal(w.check(49999), null);
    assert.equal(w.check(50000), 'hangup');
  });

  it('the caller speaking restarts the silence and allows a new nudge later', () => {
    const w = new IdleWatch(0);
    assert.equal(w.check(25000), 'nudge');
    w.callerSpoke(30000);
    w.callerStopped(30000);
    assert.equal(w.check(54999), null);
    assert.equal(w.check(55000), 'nudge');
    assert.equal(w.check(79999), null);
    assert.equal(w.check(80000), 'hangup');
  });

  it('never nudges while the caller is speaking, and counts silence from when they stop', () => {
    const w = new IdleWatch(0);
    w.callerSpoke(1000); // starts saying a long phone number
    assert.equal(w.check(40000), null, 'still speaking');
    w.callerStopped(40000);
    assert.equal(w.check(64999), null);
    assert.equal(w.check(65000), 'nudge');
  });

  it('counts silence from when the agent finished a normal turn', () => {
    const w = new IdleWatch(0);
    w.agentFinished(10000); // the greeting ended at 10 s
    assert.equal(w.check(34999), null);
    assert.equal(w.check(35000), 'nudge');
  });

  it("the agent's own nudge does not restart the clock", () => {
    const w = new IdleWatch(0);
    assert.equal(w.check(25000), 'nudge');
    w.agentFinished(28000); // the nudge finished playing
    assert.equal(w.check(50000), 'hangup');
  });

  it('uses 25 and 50 seconds by default', () => {
    assert.deepEqual([IDLE.nudgeAfterMs, IDLE.hangupAfterMs], [25000, 50000]);
  });
});

describe('silence messages', () => {
  it('the nudge asks if the caller is there, word for word', () => {
    assert.ok(nudgeMessage().response.instructions.includes('হ্যালো, আপনি কি লাইনে আছেন?'));
  });
  it('the silent hang-up speaks only the closing line', () => {
    const m = closingOnlyMessage('ধন্যবাদ।');
    assert.equal(m.type, 'response.create');
    assert.ok(m.response.instructions.includes('ধন্যবাদ।'));
  });
});

describe('time limit', () => {
  it('cuts the agent off before the closing line', () => {
    assert.deepEqual(interruptMessages().map((m) => m.type), ['response.cancel', 'output_audio_buffer.clear']);
  });
});
