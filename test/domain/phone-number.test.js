import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PhoneNumber } from '../../src/domain/scheduling/phone-number.js';

describe('PhoneNumber', () => {
  it('keeps a valid national number', () => {
    assert.equal(PhoneNumber.parse('01712345678').value, '01712345678');
  });

  it('normalises +880 and 880 prefixes', () => {
    assert.equal(PhoneNumber.parse('+8801712345678').value, '01712345678');
    assert.equal(PhoneNumber.parse('8801712345678').value, '01712345678');
  });

  it('accepts a number missing the leading zero', () => {
    assert.equal(PhoneNumber.parse('1712345678').value, '01712345678');
  });

  it('accepts Bangla digits, spaces and dashes', () => {
    assert.equal(PhoneNumber.parse('০১৭১২-৩৪৫ ৬৭৮').value, '01712345678');
  });

  it('rejects numbers that are too short, too long or not mobile', () => {
    for (const bad of ['0171234567', '017123456789', '0212345678', '01012345678', 'abc', '', null]) {
      assert.throws(() => PhoneNumber.parse(bad), (e) => e.code === 'phone_invalid', String(bad));
    }
  });

  it('reads digits one by one', () => {
    assert.equal(PhoneNumber.parse('01712345678').spoken(), '0 1 7 1 2 3 4 5 6 7 8');
  });
});
