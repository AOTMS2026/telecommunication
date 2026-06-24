// Centralized date/time formatting — always renders in Indian Standard Time
// (Asia/Kolkata), regardless of the viewer's machine/browser timezone.
// Use these helpers anywhere a date needs to be shown to the user so all
// dates across the app (Tasks, Leads, Dashboard, etc.) stay consistent.

const IST_TZ = 'Asia/Kolkata';

export function formatISTDate(date, opts = {}) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { timeZone: IST_TZ, day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

export function formatISTTime(date, opts = {}) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: true, ...opts });
}

// "24 Jun 2026, 02:51 PM IST"
export function formatISTDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return `${formatISTDate(d)}, ${formatISTTime(d)} IST`;
}

export default { formatISTDate, formatISTTime, formatISTDateTime };