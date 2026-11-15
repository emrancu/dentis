import { api } from './api.js';

export function showLogin() {
  document.getElementById('app').innerHTML = `
    <main class="login"><div class="login-card">
      <img src="/logo.svg" alt="Dentis Dental Care">
      <h1>Staff portal</h1><p class="muted">Enter the access key to see calls, bookings and settings.</p>
      <form id="login-form">
        <label class="field"><span>Access key</span><input type="password" name="key" autocomplete="current-password" required autofocus></label>
        <p class="error-text" id="login-error" role="alert"></p>
        <button class="btn btn-primary" type="submit">Log in</button>
      </form>
    </div></main>`;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('POST', '/login', { access_key: new FormData(e.target).get('key') });
      location.reload();
    } catch (error) {
      document.getElementById('login-error').textContent = error.code === 'invalid_access_key' ? 'That access key is not correct.' : error.message;
    }
  });
}
