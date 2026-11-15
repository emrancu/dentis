import { UnauthorizedError } from '../shared/errors.js';

export const SESSION_SECONDS = 12 * 3600;

/** Access-key login. The token is "<expiry-epoch-seconds>.<hmac>" and carries no user data. */
export class AdminAuth {
  constructor({ accessKey, security, clock }) {
    Object.assign(this, { accessKey, security, clock });
  }

  async login(key) {
    const valid = Boolean(this.accessKey) && typeof key === 'string' && (await this.security.safeEqual(key, this.accessKey));
    if (!valid) throw new UnauthorizedError('invalid_access_key', 'Wrong access key.');
    const expires = Math.floor(this.clock.now().getTime() / 1000) + SESSION_SECONDS;
    return `${expires}.${await this.security.hmac(String(expires))}`;
  }

  async verify(token) {
    const [expires, signature] = String(token ?? '').split('.');
    if (!expires || !signature || Number(expires) * 1000 < this.clock.now().getTime()) return false;
    return this.security.safeEqual(signature, await this.security.hmac(expires));
  }
}
