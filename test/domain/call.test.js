import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Call, CallStatus, Outcome, deriveCallStatus, mergeOutcome } from '../../src/domain/calls/call.js';

describe('deriveCallStatus', () => {
  it('uses the outcome first', () => {
    assert.equal(deriveCallStatus({ userTurns: 5, outcome: Outcome.BOOKED }), CallStatus.BOOKED);
    assert.equal(deriveCallStatus({ userTurns: 5, outcome: Outcome.RESCHEDULED }), CallStatus.RESCHEDULED);
    assert.equal(deriveCallStatus({ userTurns: 5, outcome: Outcome.CANCELLED }), CallStatus.CANCELLED);
    assert.equal(deriveCallStatus({ userTurns: 5, outcome: Outcome.CALLBACK }), CallStatus.FOLLOW_UP);
  });

  it('treats a callback intent as follow-up needed', () => {
    assert.equal(deriveCallStatus({ userTurns: 4, intent: 'callback' }), CallStatus.FOLLOW_UP);
  });

  it('is failed only when the call errored and the patient never spoke', () => {
    assert.equal(deriveCallStatus({ failed: true, userTurns: 0 }), CallStatus.FAILED);
    assert.equal(deriveCallStatus({ failed: true, userTurns: 3, outcome: Outcome.BOOKED }), CallStatus.BOOKED);
  });

  it('is incomplete when the patient said less than two things', () => {
    assert.equal(deriveCallStatus({ userTurns: 0 }), CallStatus.INCOMPLETE);
    assert.equal(deriveCallStatus({ userTurns: 1 }), CallStatus.INCOMPLETE);
  });

  it('is an enquiry for a real conversation with no outcome', () => {
    assert.equal(deriveCallStatus({ userTurns: 4, intent: 'enquiry' }), CallStatus.ENQUIRY);
  });
});

describe('mergeOutcome', () => {
  it('keeps the existing outcome when nothing new arrives', () => {
    assert.equal(mergeOutcome(Outcome.BOOKED, null), Outcome.BOOKED);
    assert.equal(mergeOutcome(null, null), null);
  });

  it('takes the new outcome when there is none yet', () => {
    assert.equal(mergeOutcome(null, Outcome.CALLBACK), Outcome.CALLBACK);
  });

  it('does not let a callback hide a booking', () => {
    assert.equal(mergeOutcome(Outcome.BOOKED, Outcome.CALLBACK), Outcome.BOOKED);
  });

  it('lets an action replace a callback and a later action replace an earlier one', () => {
    assert.equal(mergeOutcome(Outcome.CALLBACK, Outcome.BOOKED), Outcome.BOOKED);
    assert.equal(mergeOutcome(Outcome.BOOKED, Outcome.CANCELLED), Outcome.CANCELLED);
  });
});

describe('Call', () => {
  const start = new Date('2026-11-14T04:00:00Z');

  it('starts in progress', () => {
    const call = Call.start({ id: 'c1', now: start, ipHash: 'h' });
    assert.equal(call.status, CallStatus.IN_PROGRESS);
    assert.equal(call.isFinished, false);
  });

  it('records end time and duration on finish', () => {
    const call = Call.start({ id: 'c1', now: start });
    call.finish({ now: new Date('2026-11-14T04:02:30Z'), status: CallStatus.BOOKED });
    assert.equal(call.durationS, 150);
    assert.equal(call.endedAt, '2026-11-14T04:02:30.000Z');
    assert.equal(call.status, CallStatus.BOOKED);
  });

  it('keeps the first end time when finished again', () => {
    const call = Call.start({ id: 'c1', now: start });
    call.finish({ now: new Date('2026-11-14T04:01:00Z'), status: CallStatus.ENQUIRY });
    call.finish({ now: new Date('2026-11-14T04:09:00Z'), status: CallStatus.BOOKED });
    assert.equal(call.durationS, 60);
    assert.equal(call.status, CallStatus.BOOKED);
  });

  it('can be marked failed', () => {
    const call = Call.start({ id: 'c1', now: start });
    call.markFailed(start);
    assert.equal(call.status, CallStatus.FAILED);
    assert.equal(call.isFinished, true);
  });
});
