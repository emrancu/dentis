export const CallStatus = Object.freeze({
  IN_PROGRESS: 'in_progress',
  BOOKED: 'booked',
  RESCHEDULED: 'rescheduled',
  CANCELLED: 'cancelled',
  ENQUIRY: 'enquiry',
  FOLLOW_UP: 'follow_up_needed',
  INCOMPLETE: 'incomplete',
  FAILED: 'failed',
});

export const INTENTS = Object.freeze(['booking', 'reschedule', 'cancel', 'enquiry', 'callback', 'other']);

/** What the call achieved, recorded by use cases as they happen. Higher rank wins when merging. */
export const Outcome = Object.freeze({ BOOKED: 'booked', RESCHEDULED: 'rescheduled', CANCELLED: 'cancelled', CALLBACK: 'callback_needed' });
const RANK = { [Outcome.CALLBACK]: 1, [Outcome.CANCELLED]: 2, [Outcome.RESCHEDULED]: 2, [Outcome.BOOKED]: 2 };

export function mergeOutcome(current, next) {
  if (!next) return current ?? null;
  if (!current) return next;
  return (RANK[next] ?? 0) >= (RANK[current] ?? 0) ? next : current;
}

/** Domain rule: final call status from what happened on the call. */
export function deriveCallStatus({ failed = false, userTurns = 0, outcome = null, intent = null }) {
  if (failed && userTurns === 0) return CallStatus.FAILED;
  if (outcome === Outcome.BOOKED) return CallStatus.BOOKED;
  if (outcome === Outcome.RESCHEDULED) return CallStatus.RESCHEDULED;
  if (outcome === Outcome.CANCELLED) return CallStatus.CANCELLED;
  if (outcome === Outcome.CALLBACK || intent === 'callback') return CallStatus.FOLLOW_UP;
  if (userTurns < 2) return CallStatus.INCOMPLETE;
  return CallStatus.ENQUIRY;
}

/** Aggregate root: one phone conversation. Transcript turns and the extraction live behind the same repository. */
export class Call {
  constructor({ id, startedAt, endedAt = null, durationS = null, status = CallStatus.IN_PROGRESS, patientId = null, recordingKey = null, summary = null, ipHash = null }) {
    Object.assign(this, { id, startedAt, endedAt, durationS, status, patientId, recordingKey, summary, ipHash });
  }

  static start({ id, now, ipHash = null }) {
    return new Call({ id, startedAt: now.toISOString(), ipHash });
  }

  get isFinished() {
    return this.endedAt !== null;
  }

  attachPatient(patientId) {
    this.patientId = patientId;
  }

  attachRecording(key) {
    this.recordingKey = key;
  }

  /** Idempotent: the first finish fixes the end time and duration; later calls only update the status. */
  finish({ now, status }) {
    if (!this.isFinished) {
      this.endedAt = now.toISOString();
      this.durationS = Math.max(0, Math.round((now - new Date(this.startedAt)) / 1000));
    }
    this.status = status;
  }

  markFailed(now) {
    this.finish({ now, status: CallStatus.FAILED });
  }
}
