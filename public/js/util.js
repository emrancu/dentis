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

export const STATUS_LABELS = {
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
