import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../../src/domain/shared/errors.js';
import { addDays, dhakaParts, fromMinutes, isRealDate, requireDate, toMinutes, weekdayOf } from '../../src/domain/shared/time.js';
import { toAsciiDigits } from '../../src/domain/shared/bangla.js';

describe('clinic time (Asia/Dhaka)', () => {
  it('converts a UTC instant to Dhaka date, time and weekday', () => {
    assert.deepEqual(dhakaParts(new Date('2026-11-14T04:00:00Z')), { date: '2026-11-14', time: '10:00', weekday: 6 });
  });

  it('rolls over to the next day after 18:00 UTC', () => {
    assert.deepEqual(dhakaParts(new Date('2026-11-14T19:30:00Z')), { date: '2026-11-15', time: '01:30', weekday: 0 });
  });

  it('adds days across month ends', () => {
    assert.equal(addDays('2026-11-29', 3), '2026-12-02');
    assert.equal(addDays('2026-11-14', -6), '2026-11-08');
  });

  it('knows the weekday of a date', () => {
    assert.equal(weekdayOf('2026-11-16'), 1);
  });

  it('rejects impossible calendar dates', () => {
    assert.equal(isRealDate('2026-02-30'), false);
    assert.equal(isRealDate('2026-13-01'), false);
    assert.equal(isRealDate('16-11-2026'), false);
    assert.equal(isRealDate('2026-11-16'), true);
  });

  it('requireDate accepts Bangla digits and throws a coded error otherwise', () => {
    assert.equal(requireDate('২০২৬-১১-১৬'), '2026-11-16');
    assert.throws(() => requireDate('tomorrow'), (e) => e instanceof ValidationError && e.code === 'date_invalid');
  });

  it('converts between minutes and HH:MM', () => {
    assert.equal(toMinutes('18:30'), 1110);
    assert.equal(fromMinutes(1110), '18:30');
    assert.equal(fromMinutes(65), '01:05');
  });
});

describe('Bangla digits', () => {
  it('converts to ASCII and leaves other text alone', () => {
    assert.equal(toAsciiDigits('০১৭১২-৩৪৫৬৭৮ abc 9'), '01712-345678 abc 9');
    assert.equal(toAsciiDigits(null), '');
  });
});
