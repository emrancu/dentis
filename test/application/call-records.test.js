import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MAX_CALL_SECONDS, MAX_SESSIONS_PER_HOUR } from '../../src/application/call-records.js';
import { AGENT_TOOLS } from '../../src/application/agent/tools.js';
import { VALID_PHONE, buildWorld, startCall } from '../support/fixtures.js';

let world;
let s;
const code = (c) => (e) => e.code === c;
const turn = (speaker, text, ts = '2026-11-14T04:00:05.000Z') => ({ speaker, text, ts });

beforeEach(async () => {
  world = await buildWorld();
  s = world.services;
});

describe('StartCall', () => {
  it('creates an in-progress call and returns the short-lived key', async () => {
    const r = await s.startCall.execute({ ip: '1.2.3.4' });
    assert.deepEqual([r.callId, r.clientSecret, r.model, r.maxSeconds], ['call-1', 'ek_test', 'gpt-realtime-mini', MAX_CALL_SECONDS]);
    const call = await world.ports.calls.findById('call-1');
    assert.equal(call.status, 'in_progress');
    assert.match(call.ipHash, /^[0-9a-f]{64}$/);
    assert.notEqual(call.ipHash, '1.2.3.4');
  });

  it('gives the model the clinic prompt, doctors, enabled skills only, and every tool', async () => {
    await s.startCall.execute({ ip: '1.2.3.4' });
    const { instructions, tools } = world.ports.gateway.sessions[0];
    assert.match(instructions, /Dentis Dental Care/);
    assert.match(instructions, /Dr\. Tanvir Rahman/);
    assert.match(instructions, /Scaling and polishing/);
    assert.doesNotMatch(instructions, /Secret draft/);
    assert.match(instructions, /2026-11-14/);
    assert.equal(tools, AGENT_TOOLS);
  });

  it('starts in booking mode only when asked, and ignores unknown intents', async () => {
    await s.startCall.execute({ ip: '1.1.1.1', intent: 'booking' });
    await s.startCall.execute({ ip: '1.1.1.2', intent: 'general' });
    await s.startCall.execute({ ip: '1.1.1.3', intent: 'hack' });
    await s.startCall.execute({ ip: '1.1.1.4' });
    const [booking, ...others] = world.ports.gateway.sessions.map((x) => /pressed "Book an appointment"/.test(x.instructions));
    assert.equal(booking, true);
    assert.deepEqual(others, [false, false, false]);
  });

  it('allows a limited number of sessions per IP per hour', async () => {
    for (let i = 0; i < MAX_SESSIONS_PER_HOUR; i++) await s.startCall.execute({ ip: '9.9.9.9' });
    await assert.rejects(s.startCall.execute({ ip: '9.9.9.9' }), code('rate_limited'));
    await s.startCall.execute({ ip: '8.8.8.8' });
  });

  it('allows the IP again an hour later', async () => {
    for (let i = 0; i < MAX_SESSIONS_PER_HOUR; i++) await s.startCall.execute({ ip: '9.9.9.9' });
    world.clock.set('2026-11-14T05:01:00Z');
    await s.startCall.execute({ ip: '9.9.9.9' });
  });

  it('marks the call failed when the voice provider is down', async () => {
    world.ports.gateway.fail = true;
    await assert.rejects(s.startCall.execute({ ip: '1.2.3.4' }), /gateway down/);
    assert.equal((await world.ports.calls.findById('call-1')).status, 'failed');
  });

  it('reuses the clinic profile edited in settings on the next call', async () => {
    await s.clinic.update({ name_en: 'Smile House' });
    await s.startCall.execute({ ip: '1.2.3.4' });
    assert.match(world.ports.gateway.sessions[0].instructions, /Smile House/);
  });
});

describe('SaveCallDetails', () => {
  it('stores details as they are learnt and links the patient when name and phone are known', async () => {
    const callId = await startCall(world);
    const r = await s.saveCallDetails.execute({ callId, patientName: 'Rahim Uddin', phone: '০১৭১২৩৪৫৬৭৮', reason: 'toothache', intent: 'booking' });
    assert.deepEqual(r.saved.sort(), ['intent', 'patientName', 'phone', 'reasonForVisit']);
    const e = await world.ports.calls.getExtraction(callId);
    assert.deepEqual([e.patientName, e.phone, e.reasonForVisit], ['Rahim Uddin', VALID_PHONE, 'toothache']);
    assert.ok((await world.ports.calls.findById(callId)).patientId);
  });

  it('keeps earlier details when a later save only has some fields', async () => {
    const callId = await startCall(world);
    const save = (a) => s.saveCallDetails.execute({ callId, ...a });
    await save({ patientName: 'Rahim Uddin' });
    await save({ reason: 'cleaning' });
    const e = await world.ports.calls.getExtraction(callId);
    assert.deepEqual([e.patientName, e.reasonForVisit], ['Rahim Uddin', 'cleaning']);
  });

  it('rejects a bad phone, name or intent', async () => {
    const callId = await startCall(world);
    const save = (a) => s.saveCallDetails.execute({ callId, ...a });
    await assert.rejects(save({ phone: '123' }), code('phone_invalid'));
    await assert.rejects(save({ patientName: 'R' }), code('name_invalid'));
    await assert.rejects(save({ intent: 'sing' }), code('intent_invalid'));
  });
});

describe('RequestCallback', () => {
  it('records a follow-up and marks the call as needing one', async () => {
    const callId = await startCall(world);
    const r = await s.requestCallback.execute({ callId, name: 'Karim', phone: VALID_PHONE, reason: 'Medical question', preferredTime: 'evening' });
    assert.ok(r.callback_id);
    assert.equal((await world.ports.callbacks.listForCall(callId)).length, 1);
    assert.equal((await world.ports.calls.getExtraction(callId)).outcome, 'callback_needed');
  });

  it('needs a reason and a valid phone', async () => {
    const callId = await startCall(world);
    await assert.rejects(s.requestCallback.execute({ callId, name: 'Karim', phone: VALID_PHONE, reason: '' }), code('reason_required'));
    await assert.rejects(s.requestCallback.execute({ callId, name: 'Karim', phone: '1', reason: 'x' }), code('phone_invalid'));
  });
});

describe('FinishCall', () => {
  const finish = (callId, turns, reason = 'hangup') => s.finishCall.execute({ callId, turns, reason });

  it('stores the transcript in order and sets duration and status', async () => {
    const callId = await startCall(world);
    world.clock.set('2026-11-14T04:03:00Z');
    const call = await finish(callId, [turn('agent', 'আসসালামু আলাইকুম'), turn('patient', 'আমি অ্যাপয়েন্টমেন্ট নিতে চাই'), turn('agent', 'নাম বলুন'), turn('patient', 'রহিম')]);
    assert.equal(call.durationS, 180);
    assert.equal(call.status, 'enquiry');
    const turns = await world.ports.calls.getTurns(callId);
    assert.deepEqual(turns.map((t) => [t.idx, t.speaker]), [[0, 'agent'], [1, 'patient'], [2, 'agent'], [3, 'patient']]);
    assert.equal(turns[1].textBn, 'আমি অ্যাপয়েন্টমেন্ট নিতে চাই');
  });

  it('is booked when the call booked an appointment', async () => {
    const callId = await startCall(world);
    await s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'toothache', date: '2026-11-15', time: '11:00' });
    const call = await finish(callId, [turn('agent', 'hi'), turn('patient', 'hello')]);
    assert.equal(call.status, 'booked');
  });

  it('is follow_up_needed after a callback request', async () => {
    const callId = await startCall(world);
    await s.requestCallback.execute({ callId, name: 'Karim', phone: VALID_PHONE, reason: 'question' });
    assert.equal((await finish(callId, [turn('patient', 'a'), turn('patient', 'b')])).status, 'follow_up_needed');
  });

  it('is incomplete when the patient barely spoke and failed when the call errored with no speech', async () => {
    const a = await startCall(world);
    assert.equal((await finish(a, [turn('agent', 'hello'), turn('patient', 'hi')])).status, 'incomplete');
    const b = await startCall(world);
    assert.equal((await finish(b, [], 'error')).status, 'failed');
  });

  it('drops blank or malformed turns, fixes bad timestamps, and caps the number of turns', async () => {
    const callId = await startCall(world);
    await finish(callId, [turn('agent', '  '), turn('robot', 'x'), { speaker: 'patient', text: 'ok', ts: 'garbage' }, null, ...Array.from({ length: 600 }, () => turn('agent', 'x'))]);
    const turns = await world.ports.calls.getTurns(callId);
    assert.equal(turns.length, 500);
    assert.equal(turns[0].textBn, 'ok');
    assert.equal(turns[0].ts, '2026-11-14T04:00:00.000Z');
  });

  it('is idempotent: finishing again changes nothing', async () => {
    const callId = await startCall(world);
    await finish(callId, [turn('agent', 'one'), turn('patient', 'two')]);
    world.clock.set('2026-11-14T04:30:00Z');
    const again = await finish(callId, [turn('agent', 'different')]);
    assert.equal(again.durationS, 0);
    assert.equal((await world.ports.calls.getTurns(callId)).length, 2);
  });

  it('fails for an unknown call', async () => {
    await assert.rejects(finish('nope', []), code('call_not_found'));
  });
});

describe('StoreRecording', () => {
  const body = new Uint8Array([1, 2, 3]).buffer;

  it('stores audio under the call id and links it', async () => {
    const callId = await startCall(world);
    await s.storeRecording.execute({ callId, body, contentType: 'audio/webm;codecs=opus' });
    assert.equal((await world.ports.calls.findById(callId)).recordingKey, `calls/${callId}.webm`);
    assert.equal(world.ports.recordings.files.get(`calls/${callId}.webm`).contentType, 'audio/webm;codecs=opus');
  });

  it('rejects non-audio and unknown calls', async () => {
    const callId = await startCall(world);
    await assert.rejects(s.storeRecording.execute({ callId, body, contentType: 'text/html' }), code('recording_type_invalid'));
    await assert.rejects(s.storeRecording.execute({ callId, body, contentType: null }), code('recording_type_invalid'));
    await assert.rejects(s.storeRecording.execute({ callId: 'nope', body, contentType: 'audio/webm' }), code('call_not_found'));
  });
});
