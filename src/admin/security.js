const encoder = new TextEncoder();
const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** HMAC, SHA-256 and constant-time comparison with the standard WebCrypto API (Workers and Node). */
export class WebCryptoSecurity {
  constructor({ secret }) {
    this.keyPromise = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }

  async hmac(data) {
    return toHex(await crypto.subtle.sign('HMAC', await this.keyPromise, encoder.encode(data)));
  }

  async sha256(data) {
    return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(data)));
  }

  /** Compares digests, so the comparison time does not depend on how much of the strings match. */
  async safeEqual(a, b) {
    const [x, y] = await Promise.all([this.sha256(String(a)), this.sha256(String(b))]);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return diff === 0;
  }
}
