import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Doctor } from '../../src/scheduling/doctor.js';

const doctor = (over = {}) => new Doctor({ id: 1, nameEn: 'Dr. Nusrat Jahan', nameBn: 'ডা. নুসরাত জাহান', days: [6, 0], startTime: '10:00', endTime: '12:00', ...over });

describe('Doctor', () => {
  it('lists slot start times that fit in the working window', () => {
    assert.deepEqual(doctor().slotTimes(30), ['10:00', '10:30', '11:00', '11:30']);
    assert.deepEqual(doctor({ endTime: '11:15' }).slotTimes(30), ['10:00', '10:30']);
  });

  it('works only on its days and only while active', () => {
    assert.equal(doctor().worksOn(6), true);
    assert.equal(doctor().worksOn(5), false);
    assert.equal(doctor({ active: false }).worksOn(6), false);
  });

  it('matches a spoken name in English or Bangla, with or without title', () => {
    const d = doctor();
    assert.equal(d.matches('Dr. Nusrat'), true);
    assert.equal(d.matches('nusrat'), true);
    assert.equal(d.matches('ডাক্তার নুসরাত'), true);
    assert.equal(d.matches('Tanvir'), false);
    assert.equal(d.matches(''), false);
  });

  it('keeps degree, gender and experience, and cleans them', () => {
    const d = doctor({ degree: ' BDS, MS ', degreeBn: ' বিডিএস ', gender: ' Female ', experienceYears: '8' });
    assert.deepEqual([d.degree, d.degreeBn, d.gender, d.experienceYears], ['BDS, MS', 'বিডিএস', 'female', 8]);
    const none = doctor();
    assert.deepEqual([none.degree, none.gender, none.experienceYears], ['', '', null]);
    assert.equal(doctor({ experienceYears: '' }).experienceYears, null);
  });

  it('rejects a missing name, bad hours and bad days', () => {
    assert.throws(() => doctor({ nameEn: ' ' }), (e) => e.code === 'doctor_name_required');
    assert.throws(() => doctor({ startTime: '12:00', endTime: '10:00' }), (e) => e.code === 'doctor_hours_invalid');
    assert.throws(() => doctor({ startTime: '9am' }), (e) => e.code === 'doctor_hours_invalid');
    assert.throws(() => doctor({ days: [7] }), (e) => e.code === 'doctor_days_invalid');
    assert.throws(() => doctor({ gender: 'robot' }), (e) => e.code === 'doctor_gender_invalid');
    assert.throws(() => doctor({ experienceYears: -1 }), (e) => e.code === 'doctor_experience_invalid');
    assert.throws(() => doctor({ experienceYears: 2.5 }), (e) => e.code === 'doctor_experience_invalid');
    assert.throws(() => doctor({ degree: 'x'.repeat(201) }), (e) => e.code === 'doctor_text_too_long');
  });

  it('keeps a Bangla specialty, empty by default', () => {
    assert.equal(doctor().specialtyBn, '');
    assert.equal(doctor({ specialty: 'Braces', specialtyBn: '  ব্রেসেস ' }).specialtyBn, 'ব্রেসেস');
  });

  it('removes duplicate days', () => {
    assert.deepEqual(doctor({ days: [1, 1, 2] }).days, [1, 2]);
  });
});
