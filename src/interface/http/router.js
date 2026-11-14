import { ConflictError, NotFoundError, RateLimitError, UnauthorizedError, ValidationError } from '../../domain/shared/errors.js';

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

export const noContent = (headers = {}) => new Response(null, { status: 204, headers });

const STATUS = [
  [ValidationError, 400],
  [UnauthorizedError, 401],
  [NotFoundError, 404],
  [ConflictError, 409],
  [RateLimitError, 429],
];

export function errorResponse(error) {
  const status = STATUS.find(([type]) => error instanceof type)?.[1];
  if (!status) {
    console.error(error);
    return json({ error: { code: 'internal_error', message: 'Something went wrong.' } }, 500);
  }
  return json({ error: { code: error.code, message: error.message, ...(Object.keys(error.details).length ? { details: error.details } : {}) } }, status);
}

/** Reads a JSON body whatever its content type (sendBeacon uses text/plain). */
export async function readJson(request) {
  try {
    return (await request.json()) ?? {};
  } catch {
    throw new ValidationError('invalid_json', 'Request body must be valid JSON.');
  }
}

/** Like readJson, but an empty body means "no options". */
export async function readOptionalJson(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) ?? {};
  } catch {
    throw new ValidationError('invalid_json', 'Request body must be valid JSON.');
  }
}

/** Minimal path router: "/api/admin/calls/:id". */
export class Router {
  #routes = [];

  add(method, pattern, handler, { admin = false } = {}) {
    const names = [];
    const regex = new RegExp(`^${pattern.replace(/:([a-z]+)/g, (_, name) => (names.push(name), '([^/]+)'))}$`);
    this.#routes.push({ method, regex, names, handler, admin });
  }

  match(method, path) {
    for (const route of this.#routes) {
      const m = route.regex.exec(path);
      if (m && route.method === method) return { route, params: Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}
