import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closingOnlyMessage, nudgeMessage } from '../../public/js/call-messages.js';
import { IDLE, IdleWatch } from '../../public/js/idle.js';

describe('IdleWatch', () => {
  it('nudges once after 15 seconds of silence and hangs up at 30', () => {
    const w = new IdleWatch(0);
    assert.equal(w.check(14999), null);
    assert.equal(w.check(15000), 'nudge');
    assert.equal(w.check(16000), null, 'only one nudge per silence');
    assert.equal(w.check(29999), null);
    assert.equal(w.check(30000), 'hangup');
  });

  it('the caller speaking restarts the silence and allows a new nudge later', () => {
    const w = new IdleWatch(0);
    assert.equal(w.check(15000), 'nudge');
    w.callerSpoke(20000);
    assert.equal(w.check(34999), null);
    assert.equal(w.check(35000), 'nudge');
    assert.equal(w.check(49999), null);
    assert.equal(w.check(50000), 'hangup');
  });

  it('counts silence from when the agent finished a normal turn', () => {
    const w = new IdleWatch(0);
    w.agentFinished(10000); // the greeting ended at 10 s
    assert.equal(w.check(24999), null);
    assert.equal(w.check(25000), 'nudge');
  });

  it("the agent's own nudge does not restart the clock", () => {
    const w = new IdleWatch(0);
    assert.equal(w.check(15000), 'nudge');
    w.agentFinished(18000); // the nudge finished playing
    assert.equal(w.check(30000), 'hangup');
  });

  it('uses 15 and 30 seconds by default', () => {
    assert.deepEqual([IDLE.nudgeAfterMs, IDLE.hangupAfterMs], [15000, 30000]);
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
