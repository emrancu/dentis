import { BanglaCall } from './voice.js';
import { DEFAULT_LANG, LANGUAGES, daysLabel, t } from './i18n.js';
import { esc } from './util.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* ---------- language ---------- */
let lang = (() => {
  try {
    const saved = localStorage.getItem('dentis-lang');
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    // storage can be blocked; use the default
  }
  return DEFAULT_LANG;
})();
let site = null;
let callError = null;

function applyLanguage() {
  document.documentElement.lang = lang;
  document.title = t(lang, 'meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t(lang, 'meta.description'));
  $$('[data-i18n]').forEach((el) => (el.textContent = t(lang, el.dataset.i18n)));
  $$('[data-i18n-html]').forEach((el) => (el.innerHTML = t(lang, el.dataset.i18nHtml))); // our own constants, not user data
  $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(lang, el.dataset.i18nAria)));
  $('#lang-btn').lang = lang === 'bn' ? 'en' : 'bn';
  $('#mute-btn').textContent = t(lang, call.muted ? 'call.unmute' : 'call.mute');
  renderStatus();
  if (site) renderSite();
}

$('#lang-btn').addEventListener('click', () => {
  lang = lang === 'bn' ? 'en' : 'bn';
  try {
    localStorage.setItem('dentis-lang', lang);
  } catch {
    // not persisted; still works for this visit
  }
  applyLanguage();
});

/* ---------- live clinic content ---------- */
function renderSite() {
  const { clinic, skills, doctors } = site;
  $('#services-list').innerHTML = skills.length
    ? skills.map((s, i) => `<article class="card reveal in" style="--i:${i % 6}"><span class="card-icon" aria-hidden="true"></span><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p></article>`).join('')
    : `<p class="muted">${esc(t(lang, 'services.empty'))}</p>`;

  $('#doctors-list').innerHTML = doctors
    .map((d) => {
      const name = lang === 'bn' && d.name_bn ? d.name_bn : d.name_en;
      const initials = d.name_en.replace(/^Dr\.?\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
      return `<article class="doctor reveal in"><span class="avatar" aria-hidden="true">${esc(initials)}</span><h3>${esc(name)}</h3><p class="doctor-role">${esc(d.specialty)}</p><p class="doctor-hours">${esc(daysLabel(d.days, lang))} · ${esc(d.start_time)}–${esc(d.end_time)}</p></article>`;
    })
    .join('');

  const rows = [
    ['visit.address', clinic.address],
    ['visit.hours', clinic.hours],
    ['visit.phone', clinic.phone],
    ['visit.directions', clinic.directions],
    ['visit.prep', clinic.prep_notes],
  ].filter(([, value]) => value);
  $('#visit-facts').innerHTML = rows.map(([key, value]) => `<div><dt>${esc(t(lang, key))}</dt><dd>${esc(value)}</dd></div>`).join('');

  $('#footer-contact').innerHTML = [clinic.address, clinic.phone].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join('');
}

fetch('/api/public/site')
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((data) => {
    site = data;
    renderSite();
  })
  .catch(() => {
    $('#services-list').innerHTML = `<p class="muted">${esc(t(lang, 'services.empty'))}</p>`;
  });

/* ---------- call panel ---------- */
const call = new BanglaCall();
const panel = $('#call-panel');
const wave = $('#wave');
wave.innerHTML = '<i></i>'.repeat(28);
const bars = [...wave.children];

function renderStatus() {
  const state = panel.dataset.state;
  $('#call-status').textContent = state === 'connecting' ? t(lang, 'call.connecting') : state === 'live' ? t(lang, 'call.live') : state === 'ended' ? t(lang, 'call.ended') : '';
  if (state === 'error' && callError) $('#call-error').textContent = t(lang, `error.${callError}`);
  if (state === 'connecting' || (state === 'live' && !$('#call-caption').textContent)) $('#call-caption').textContent = t(lang, 'call.greeting');
}

call.addEventListener('state', ({ detail }) => {
  callError = detail.error;
  panel.hidden = false;
  document.body.classList.add('panel-open');
  panel.dataset.state = detail.state;
  document.body.classList.toggle('in-call', detail.state === 'connecting' || detail.state === 'live');
  renderStatus();
  if (detail.state === 'live') {
    $('#call-timer').textContent = '0:00';
    $('#mute-btn').focus();
  }
  if (detail.state === 'error' || detail.state === 'ended') $('[data-restart]', panel.querySelector(`.when-${detail.state}`)).focus();
});
call.addEventListener('tick', ({ detail }) => {
  $('#call-timer').textContent = `${Math.floor(detail.seconds / 60)}:${String(detail.seconds % 60).padStart(2, '0')}`;
});
call.addEventListener('caption', ({ detail }) => {
  if (detail.text) $('#call-caption').textContent = detail.text;
});

function startCall(intent) {
  $('#call-caption').textContent = '';
  document.body.classList.add('panel-open');
  call.start(intent);
}
$$('[data-start-booking]').forEach((b) => b.addEventListener('click', () => startCall('booking')));
$('#fab-call').addEventListener('click', () => startCall('general'));
$$('[data-start-call]').forEach((b) => b.addEventListener('click', () => startCall('general')));
$$('[data-restart]').forEach((b) => b.addEventListener('click', () => startCall(call.intent)));
$('[data-close]').addEventListener('click', () => {
  panel.hidden = true;
  document.body.classList.remove('panel-open');
  $('#fab-call').focus();
});
$('#end-btn').addEventListener('click', () => call.end());
$('#mute-btn').addEventListener('click', () => {
  const muted = call.toggleMute();
  $('#mute-btn').setAttribute('aria-pressed', String(muted));
  $('#mute-btn').textContent = t(lang, muted ? 'call.unmute' : 'call.mute');
});
addEventListener('pagehide', () => call.reportOnPageHide());

/* ---------- hero: the round stage cycles through four treatments ---------- */
const TREATMENTS = ['checkup', 'whitening', 'braces', 'implant'];
const orb = $('#orb');
const txTabs = $$('.tx-tab');
let treatment = 0;
let hero = null; // the 3D scene, once loaded (without WebGL only the cards change)

function showTreatment(i) {
  treatment = (i + TREATMENTS.length) % TREATMENTS.length;
  const key = TREATMENTS[treatment];
  const card = $('.fcard-a');
  card.classList.add('swap');
  setTimeout(() => {
    $('#tx-name').dataset.i18n = `tx.${key}.name`;
    $('#tx-text').dataset.i18n = `tx.${key}.text`;
    $('#tx-name').textContent = t(lang, `tx.${key}.name`);
    $('#tx-text').textContent = t(lang, `tx.${key}.text`);
    card.classList.remove('swap');
  }, 200);
  txTabs.forEach((tab, n) => tab.setAttribute('aria-selected', String(n === treatment)));
  hero?.show(treatment);
}
txTabs.forEach((tab, n) => tab.addEventListener('click', () => { showTreatment(n); restartTimer(); }));

let paused = false;
let timer;
const restartTimer = () => {
  clearInterval(timer);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => !paused && !document.hidden && showTreatment(treatment + 1), 5000);
};
orb.addEventListener('pointerenter', () => (paused = true));
orb.addEventListener('pointerleave', () => (paused = false));
restartTimer();

import('./hero3d.js')
  .then(({ startHero }) => {
    hero = startHero($('#stage-canvas'), { onTap: () => { showTreatment(treatment + 1); restartTimer(); } });
    if (hero) document.body.classList.add('has-3d');
  })
  .catch(() => {});

(function animateWave() {
  requestAnimationFrame(animateWave);
  if (panel.hidden || panel.dataset.state !== 'live') return;
  const { user, agent } = call.levels();
  const level = Math.max(user, agent);
  const now = performance.now() / 180;
  bars.forEach((bar, i) => {
    const shape = 0.35 + 0.65 * Math.abs(Math.sin(now + i * 0.55));
    bar.style.transform = `scaleY(${0.12 + level * shape * 1.1})`;
  });
})();

/* ---------- mobile menu and active section ---------- */
const nav = $('#nav');
const menuBtn = $('#menu-btn');
const setMenu = (open) => {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
};
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

const sectionLinks = new Map($$('.nav a').map((a) => [a.getAttribute('href').slice(1), a]));
const spy = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && sectionLinks.forEach((a, id) => a.setAttribute('aria-current', String(id === e.target.id)))),
  { rootMargin: '-45% 0px -50% 0px' },
);
sectionLinks.forEach((_, id) => document.getElementById(id) && spy.observe(document.getElementById(id)));

/* ---------- header and reveal on scroll ---------- */
const header = $('#header');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const reveal = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), reveal.unobserve(e.target))),
  { threshold: 0.12 },
);
$$('.reveal:not(.in)').forEach((el) => reveal.observe(el));

applyLanguage();
