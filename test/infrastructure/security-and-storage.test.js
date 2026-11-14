import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { R2RecordingStore } from '../../src/infrastructure/r2/r2-recording-store.js';
import { WebCryptoSecurity } from '../../src/infrastructure/security/web-crypto-security.js';

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

describe('R2RecordingStore', () => {
  it('puts with the content type and reads it back', async () => {
    const objects = new Map();
    const bucket = {
      put: async (key, body, options) => objects.set(key, { body, httpMetadata: options.httpMetadata }),
      get: async (key) => objects.get(key) ?? null,
    };
    const store = new R2RecordingStore(bucket);
    await store.put('calls/c1.webm', new Uint8Array([1]).buffer, 'audio/webm');
    const found = await store.get('calls/c1.webm');
    assert.equal(found.contentType, 'audio/webm');
    assert.ok(found.body);
    assert.equal(await store.get('calls/none.webm'), null);
  });
});
