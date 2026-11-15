/** Calls to /api/admin. A 401 shows the login page through the handler main.js registers. */
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

class ApiError extends Error {
  constructor(status, error) {
    super(error?.message ?? 'Something went wrong.');
    this.status = status;
    this.code = error?.code;
  }
}

export async function api(method, path, body) {
  const response = await fetch(`/api/admin${path}`, {
    method,
    headers: { 'X-Requested-With': 'dentis', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 && path !== '/login') {
    onUnauthorized();
    throw new ApiError(401, { message: 'Please log in.' });
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error);
  return data;
}
