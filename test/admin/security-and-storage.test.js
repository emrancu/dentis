import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WebCryptoSecurity } from '../../src/admin/security.js';

describe('WebCryptoSecurity', () => {
  const security = new WebCryptoSecurity({ secret: 'one' });

  it('hmac is deterministic, hex, and depends on the secret and the data', async () => {
    const a = await security.hmac('data');
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, await security.hmac('data'));
    assert.notEqual(a, await security.hmac('other'));
    assert.notEqual(a, await new WebCryptoSecurity({ secret: 'two' }).hmac('data'));
  });

  it('sha256 matches the known digest', async () => {
    assert.equal(await security.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('safeEqual compares values of any length', async () => {
    assert.equal(await security.safeEqual('secret', 'secret'), true);
    assert.equal(await security.safeEqual('secret', 'secreT'), false);
    assert.equal(await security.safeEqual('secret', 'secret-and-more'), false);
    assert.equal(await security.safeEqual('', ''), true);
  });
});
