const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for safe insertion into HTML. Use for every dynamic value. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** 125 -> "2:05", 3725 -> "1:02:05"; null -> "–". */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '–';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const DHAKA = { timeZone: 'Asia/Dhaka' };

/** ISO instant -> "14 Nov 2026, 10:00 am" in Dhaka time. */
export function formatDateTime(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-GB', { ...DHAKA, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { ...DHAKA, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${date}, ${time}`;
}

export function formatTime(iso) {
  return iso ? new Intl.DateTimeFormat('en-GB', { ...DHAKA, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(new Date(iso)) : '–';
}

/** "2026-11-16T18:30" (clinic-local) -> "Mon 16 Nov, 6:30 pm". */
export function formatSlot(slot) {
  if (!slot) return '–';
  const [date, time] = slot.split('T');
  const d = new Date(`${date}T00:00:00Z`);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  const [h, m] = time.split(':').map(Number);
  return `${day}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

const STATUS_LABELS = {
  in_progress: 'In progress',
  booked: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  enquiry: 'Enquiry',
  follow_up_needed: 'Follow-up needed',
  incomplete: 'Incomplete',
  failed: 'Failed',
  completed: 'Completed',
  open: 'Open',
  resolved: 'Resolved',
};

export const statusLabel = (status) => STATUS_LABELS[status] ?? status;

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Bangla digits for the Bangla page, Latin digits for the English page. */
export const localDigits = (text, lang) => (lang === 'bn' ? String(text ?? '').replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]) : String(text ?? ''));

/** The visitor's language first, the other language only when that field is empty. */
export const pick = (lang, en, bn) => (lang === 'bn' ? bn || en : en || bn) || '';

/** "10:00" -> "10:00 am" in English, "সকাল ১০:০০" in Bangla. */
export function formatClock(hhmm, lang) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const clock = `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  if (lang !== 'bn') return `${clock} ${h < 12 ? 'am' : 'pm'}`;
  const part = h < 4 ? 'রাত' : h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
  return `${part} ${localDigits(clock, 'bn')}`;
}

export const formatClockRange = (start, end, lang) => `${formatClock(start, lang)}–${formatClock(end, lang)}`;

/** "09638-001122" -> "tel:09638001122". Empty when there is no number. */
export const telHref = (phone) => {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
};
