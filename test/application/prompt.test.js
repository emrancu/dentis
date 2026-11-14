import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInstructions } from '../../src/application/agent/prompt.js';
import { ClinicProfile } from '../../src/domain/clinic/clinic-profile.js';
import { Doctor } from '../../src/domain/scheduling/doctor.js';

const base = {
  profile: new ClinicProfile({ nameEn: 'Dentis Dental Care', nameBn: 'ডেন্টিস ডেন্টাল কেয়ার', hours: 'Sat-Thu 10-8' }),
  doctors: [new Doctor({ id: 1, nameEn: 'Dr. Nusrat Jahan', nameBn: 'ডা. নুসরাত জাহান', specialty: 'General', days: [6, 0], startTime: '10:00', endTime: '17:00' })],
  skillTitles: ['Scaling and polishing'],
  now: { date: '2026-11-14', time: '10:00', weekday: 6 },
};

describe('buildInstructions', () => {
  const text = buildInstructions(base);

  it('names the clinic and today in Dhaka, with the weekday', () => {
    assert.match(text, /Dentis Dental Care \(ডেন্টিস ডেন্টাল কেয়ার\)/);
    assert.match(text, /Saturday \(শনিবার\), 2026-11-14, 10:00/);
  });

  it('asks for colloquial Bangla and code-switching', () => {
    assert.match(text, /colloquial Dhaka Bangla/);
    assert.match(text, /mix English words/);
  });

  it('tells the model to read the phone back digit by digit and confirm before booking', () => {
    assert.match(text, /digit by digit/);
    assert.match(text, /Only after the caller agrees, call book_appointment/);
  });

  it('forbids medical advice and invented facts, and routes facts to tools', () => {
    assert.match(text, /Never give medical advice/);
    assert.match(text, /Never invent a price/);
    assert.match(text, /lookup_skill/);
    assert.match(text, /get_clinic_info/);
  });

  it('lists doctors and skill titles', () => {
    assert.match(text, /Dr\. Nusrat Jahan \(ডা\. নুসরাত জাহান\), General: Sat, Sun 10:00-17:00/);
    assert.match(text, /- Scaling and polishing/);
  });

  it('copes with no doctors and no skills', () => {
    const empty = buildInstructions({ ...base, doctors: [], skillTitles: [] });
    assert.match(empty, /none listed: use list_doctors/);
    assert.match(empty, /\(none yet\)/);
  });

  it('sends a booking caller straight to booking, and a general caller to the normal greeting', () => {
    assert.match(buildInstructions({ ...base, intent: 'booking' }), /pressed "Book an appointment"[\s\S]*go straight to booking/);
    assert.doesNotMatch(buildInstructions({ ...base, intent: 'general' }), /pressed "Book an appointment"/);
    assert.doesNotMatch(buildInstructions(base), /pressed "Book an appointment"/);
  });
});
