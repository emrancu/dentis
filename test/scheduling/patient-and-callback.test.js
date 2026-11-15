import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CallbackRequest } from '../../src/calls/callback-request.js';
import { Patient, cleanName } from '../../src/scheduling/patient.js';

const now = new Date('2026-11-14T04:00:00Z');

describe('Patient', () => {
  it('registers with a cleaned name and a normalised phone', () => {
    const p = Patient.register({ fullName: '  Rahim   Uddin ', phone: '+8801712345678', now });
    assert.equal(p.fullName, 'Rahim Uddin');
    assert.equal(p.phone, '01712345678');
  });

  it('rejects bad names and phones', () => {
    assert.throws(() => cleanName('R'), (e) => e.code === 'name_invalid');
    assert.throws(() => cleanName('x'.repeat(81)), (e) => e.code === 'name_invalid');
    assert.throws(() => Patient.register({ fullName: 'Rahim', phone: '123', now }), (e) => e.code === 'phone_invalid');
  });
});

describe('CallbackRequest', () => {
  const make = (over = {}) => CallbackRequest.create({ callId: 'c1', name: 'Karim', phone: '01712345678', reason: 'Asked about braces for a child', preferredTime: 'evening', now, ...over });

  it('is created open', () => {
    assert.equal(make().status, 'open');
  });

  it('requires a reason, a valid name and a valid phone', () => {
    assert.throws(() => make({ reason: ' ' }), (e) => e.code === 'reason_required');
    assert.throws(() => make({ name: '' }), (e) => e.code === 'name_invalid');
    assert.throws(() => make({ phone: '1' }), (e) => e.code === 'phone_invalid');
  });

  it('can be resolved once', () => {
    const c = make();
    c.resolve();
    assert.equal(c.status, 'resolved');
    assert.throws(() => c.resolve(), (e) => e.code === 'callback_already_resolved');
  });
});
