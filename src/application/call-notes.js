import { NotFoundError } from '../domain/shared/errors.js';
import { mergeOutcome } from '../domain/calls/call.js';

/** Writes what use cases learn during a call onto the call's extraction. */
export class CallNotes {
  constructor({ calls }) {
    this.calls = calls;
  }

  async record(callId, fields, outcome = null) {
    const current = await this.calls.getExtraction(callId);
    const merged = mergeOutcome(current?.outcome ?? null, outcome);
    await this.calls.mergeExtraction(callId, { ...fields, ...(merged ? { outcome: merged } : {}) });
  }

  async attachPatient(callId, patientId) {
    const call = await this.calls.findById(callId);
    if (!call) throw new NotFoundError('call_not_found', 'Call not found.');
    call.attachPatient(patientId);
    await this.calls.save(call);
  }
}
