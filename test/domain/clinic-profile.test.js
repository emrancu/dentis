import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ClinicProfile } from '../../src/domain/clinic/clinic-profile.js';

describe('ClinicProfile', () => {
  it('has Dentis defaults', () => {
    const p = new ClinicProfile();
    assert.equal(p.nameEn, 'Dentis Dental Care');
    assert.equal(p.slotMinutes, 30);
  });

  it('reads a stored key/value map (slot length arrives as text)', () => {
    const p = ClinicProfile.fromMap({ name_en: 'Smile House', slot_minutes: '45', phone: '123' });
    assert.equal(p.nameEn, 'Smile House');
    assert.equal(p.slotMinutes, 45);
    assert.equal(p.phone, '123');
  });

  it('applies snake_case changes and ignores unknown keys', () => {
    const next = new ClinicProfile().withChanges({ address: 'Dhanmondi', nope: 'x' });
    assert.equal(next.address, 'Dhanmondi');
    assert.equal('nope' in next, false);
  });

  it('is immutable', () => {
    assert.throws(() => { 'use strict'; new ClinicProfile().nameEn = 'x'; });
  });

  it('rejects an invalid slot length, an empty name and too-long text', () => {
    assert.throws(() => new ClinicProfile({ slotMinutes: 25 }), (e) => e.code === 'slot_minutes_invalid');
    assert.throws(() => new ClinicProfile({ nameEn: ' ' }), (e) => e.code === 'clinic_name_required');
    assert.throws(() => new ClinicProfile({ address: 'x'.repeat(1001) }), (e) => e.code === 'field_too_long');
  });

  it('has Bangla twins for address, hours and directions, empty by default', () => {
    const p = new ClinicProfile();
    assert.deepEqual([p.addressBn, p.hoursBn, p.directionsBn], ['', '', '']);
    const q = ClinicProfile.fromMap({ address_bn: 'ধানমন্ডি', hours_bn: 'শনি–বৃহ', directions_bn: 'লেকের পাশে' });
    assert.deepEqual([q.addressBn, q.hoursBn, q.directionsBn], ['ধানমন্ডি', 'শনি–বৃহ', 'লেকের পাশে']);
    assert.deepEqual(Object.keys(q.toJSON()).sort(), ['address', 'address_bn', 'directions', 'directions_bn', 'hours', 'hours_bn', 'name_bn', 'name_en', 'phone', 'slot_minutes']);
  });

  it('applies Bangla changes from the admin form and limits their length', () => {
    assert.equal(new ClinicProfile().withChanges({ hours_bn: 'শনিবার থেকে' }).hoursBn, 'শনিবার থেকে');
    assert.throws(() => new ClinicProfile({ hoursBn: 'ক'.repeat(1001) }), (e) => e.code === 'field_too_long');
  });

  it('round-trips through the key/value map', () => {
    const p = new ClinicProfile({ nameEn: 'A', hours: '9-5', slotMinutes: 20 });
    assert.deepEqual(ClinicProfile.fromMap(p.toMap()).toJSON(), p.toJSON());
  });
});
