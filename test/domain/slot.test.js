import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Slot } from '../../src/domain/scheduling/slot.js';

describe('Slot', () => {
  it('builds from date and time and prints as ISO-like text', () => {
    assert.equal(String(Slot.of('2026-11-16', '18:30')), '2026-11-16T18:30');
  });

  it('pads single-digit hours and accepts Bangla digits', () => {
    assert.equal(String(Slot.of('২০২৬-১১-১৬', '৬:৩০')), '2026-11-16T06:30');
  });

  it('parses its own string form', () => {
    const slot = Slot.parse('2026-11-16T18:30');
    assert.equal(slot.date, '2026-11-16');
    assert.equal(slot.time, '18:30');
    assert.equal(slot.weekday, 1);
  });

  it('rejects a bad date', () => {
    assert.throws(() => Slot.of('2026-02-30', '10:00'), (e) => e.code === 'date_invalid');
  });

  it('rejects a bad time', () => {
    for (const t of ['25:00', '10:60', 'noon', '', undefined]) {
      assert.throws(() => Slot.of('2026-11-16', t), (e) => e.code === 'time_invalid', String(t));
    }
  });
});
