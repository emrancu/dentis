import { ConflictError, ValidationError } from '../shared/errors.js';
import { cleanName } from '../scheduling/patient.js';
import { PhoneNumber } from '../scheduling/phone-number.js';

/** Entity: a request for a human to call the patient back. */
export class CallbackRequest {
  constructor({ id = null, callId, name, phone, reason, preferredTime = '', urgent = false, status = 'open', createdAt }) {
    Object.assign(this, { id, callId, name, phone, reason, preferredTime, urgent: Boolean(urgent), status, createdAt });
  }

  static create({ callId, name, phone, reason, preferredTime, urgent = false, now }) {
    const why = String(reason ?? '').trim();
    if (!why) throw new ValidationError('reason_required', 'Say why the caller needs a callback.');
    return new CallbackRequest({
      callId,
      name: cleanName(name),
      phone: PhoneNumber.parse(phone).value,
      reason: why.slice(0, 500),
      preferredTime: String(preferredTime ?? '').trim().slice(0, 100),
      urgent: urgent === true,
      createdAt: now.toISOString(),
    });
  }

  resolve() {
    if (this.status === 'resolved') throw new ConflictError('callback_already_resolved', 'This callback is already resolved.');
    this.status = 'resolved';
  }
}
