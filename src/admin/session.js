import { UnauthorizedError } from '../shared/errors.js';

const COOKIE = 'dentis_admin';

const cookieValue = (request, name) => request.headers.get('Cookie')?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

/** The Set-Cookie value for the admin session. maxAge 0 clears it. */
export function sessionCookie(token, request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api${secure}; Max-Age=${maxAge}`;
}

/** The guard every admin route runs first: a valid session cookie, and a CSRF header on writes. */
export const adminGuard = (services) => async (request) => {
  if (!(await services.adminAuth.verify(cookieValue(request, COOKIE)))) throw new UnauthorizedError('unauthorized', 'Please log in.');
  // Cookies are SameSite=Strict; this header is a second guard for state-changing calls.
  if (request.method !== 'GET' && request.headers.get('X-Requested-With') !== 'dentis') throw new UnauthorizedError('csrf_rejected', 'Missing X-Requested-With header.');
};
