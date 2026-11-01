// Fechas y texto. Sin imports: se verifica con `node scripts/check-calc.mjs`.
// Las fechas del API son "YYYY-MM-DD" y se tratan siempre como día local.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAY = 86400000;

/**
 * Formats a Date as the API's "YYYY-MM-DD", in local time.
 *
 * @param value Date to format
 */
export const toYMD = (value: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`;
};

/**
 * Parses "YYYY-MM-DD" as a local date; undefined when it is not a real date.
 *
 * @param ymd Date string
 */
export const toDate = (ymd: string): Date | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
  if (!m) return undefined;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return toYMD(d) === ymd ? d : undefined;
};

export const isYMD = (ymd: string): boolean => !!toDate(ymd);

export const today = (): string => toYMD(new Date());

/**
 * Adds days to a "YYYY-MM-DD" date.
 */
export const addDays = (ymd: string, days: number): string => {
  const d = toDate(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + days);
  return toYMD(d);
};

/**
 * Whole days from a to b (positive when b is later).
 */
export const diffDays = (a: string, b: string): number => {
  const [da, db] = [toDate(a), toDate(b)];
  return da && db ? Math.round((db.getTime() - da.getTime()) / DAY) : 0;
};

/**
 * "08-10-2026", how a date is shown in the date fields.
 */
export const dmy = (ymd: string): string => (toDate(ymd) ? ymd.split('-').reverse().join('-') : '');

/**
 * "8 oct", with the year when it is not the current one.
 */
export const viewDate = (ymd: string): string => {
  const d = toDate(ymd);
  if (!d) return '—';
  const year = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MESES[d.getMonth()]}${year}`;
};

/**
 * "Hoy · jueves 8 oct", "Ayer · …" or "lunes 5 oct".
 */
export const dayLabel = (ymd: string): string => {
  const d = toDate(ymd);
  if (!d) return '—';
  const diff = diffDays(ymd, today());
  const text = `${DIAS[d.getDay()]} ${viewDate(ymd)}`;
  return diff === 0 ? `Hoy · ${text}` : diff === 1 ? `Ayer · ${text}` : text;
};

/**
 * "hace 5 días", "hoy", "en 3 días".
 */
export const relDays = (ymd: string): string => {
  const n = diffDays(ymd, today());
  if (n === 0) return 'hoy';
  if (n === 1) return 'ayer';
  if (n === -1) return 'mañana';
  return n > 0 ? `hace ${n} días` : `en ${-n} días`;
};

/**
 * First and last day of the week containing ymd. diaInicio: 0 = domingo … 6 = sábado.
 */
export const weekBounds = (ymd: string, diaInicio = 1): { start: string; end: string } => {
  const d = toDate(ymd) ?? new Date();
  const start = addDays(toYMD(d), -((d.getDay() - diaInicio + 7) % 7));
  return { start, end: addDays(start, 6) };
};

/**
 * ISO-8601 week number of a date.
 */
export const weekNumber = (ymd: string): number => {
  const d = toDate(ymd) ?? new Date();
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
};

/**
 * "1 parto", "3 partos".
 */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * Initials of a name, at most two letters.
 */
export const getUserInitials = (fullName = ''): string =>
  fullName
    .trim()
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'U';

/**
 * Number typed by the user ("1,5" or "1.5"); 0 when it is not one.
 */
export const num = (text: string | number | undefined | null): number => {
  const n = typeof text === 'number' ? text : Number(String(text ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Strips accents and case, for searching.
 */
export const normalizeText = (value: string): string =>
  (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * A new id for a record created on this device, in UUID v4 shape.
 *
 * ponytail: Math.random — the id only has to be unique, not secret. Switch
 * to expo-crypto if ids ever need to be unguessable.
 */
export const newId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
