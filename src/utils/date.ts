/** Clave de día local (YYYY-MM-DD). */
export function dayKey(t: number | Date = Date.now()): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(t: number, days: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Últimos n días (el más antiguo primero). */
export function lastDays(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(addDays(now, i - n + 1)));
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function weekdayShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/** Lunes de la semana de una fecha, como clave de día. */
export function weekKey(t: number): string {
  const d = new Date(t);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return dayKey(d);
}

export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function relativeDue(t: number, now = Date.now()): string {
  const diff = t - now;
  if (diff <= 0) return 'ahora';
  const h = diff / 3_600_000;
  if (h < 1) return `en ${Math.max(1, Math.round(diff / 60_000))} min`;
  if (h < 24) return `en ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'mañana' : `en ${d} días`;
}

export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
