import { esc, statusLabel } from '../../shared/util.js';

const toastEl = () => document.getElementById('toast');

/** Re-draws the current page. main.js registers the function. */
let redraw = () => {};
export const setRerender = (fn) => (redraw = fn);
export const rerender = () => redraw();

let toastTimer;
export function toast(message, isError = false) {
  toastEl().textContent = message;
  toastEl().className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl().className = 'toast'), 3200);
}
export const guard = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    if (error.status !== 401) toast(error.message, true);
  }
};

export const chip = (status) => `<span class="chip ${esc(status)}">${esc(statusLabel(status))}</span>`;
export const empty = (text) => `<div class="empty">${esc(text)}</div>`;

export const head = (title, subtitle = '', actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><div>${actions}</div></div>`;

/** Table rows with a data-href open that page on click or Enter. */
export function bindRows(root) {
  root.querySelectorAll('tr[data-href]').forEach((row) => {
    row.onclick = () => (location.hash = row.dataset.href);
    row.onkeydown = (e) => e.key === 'Enter' && row.click();
  });
}

/** A small yes/no modal. Resolves true on confirm, false on cancel, Escape or backdrop click. */
export function confirmDialog({ title, text, confirm: confirmLabel, cancel: cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm';
    dlg.setAttribute('aria-labelledby', 'confirm-title');
    dlg.innerHTML = `<form method="dialog"><h2 id="confirm-title">${esc(title)}</h2><p class="muted" style="margin:0">${esc(text)}</p><div class="dialog-actions"><button type="button" class="btn" data-no>${esc(cancelLabel)}</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmLabel)}</button></div></form>`;
    document.body.append(dlg);
    let answer = false;
    dlg.querySelector('[data-no]').onclick = () => dlg.close();
    dlg.querySelector('[data-yes]').onclick = () => ((answer = true), dlg.close());
    dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
    dlg.onclose = () => { dlg.remove(); resolve(answer); };
    dlg.showModal();
    dlg.querySelector('[data-no]').focus();
  });
}

export function dialog(html, onSubmit) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog">${html}<p class="error-text" data-error role="alert"></p><div class="dialog-actions"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>`;
  document.body.append(dlg);
  dlg.querySelector('[data-cancel]').onclick = () => dlg.close();
  dlg.onclose = () => dlg.remove();
  dlg.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(new FormData(e.target));
      dlg.close();
      route();
    } catch (error) {
      if (error.status === 401) dlg.close();
      else dlg.querySelector('[data-error]').textContent = error.message;
    }
  };
  dlg.showModal();
  return dlg;
}
