import dayjs from 'dayjs';

// Fallback FX rate. A hardcoded number goes stale: refresh it by hand now and then,
// or fetch it from an API and cache it.
export const USD_TO_INR = 96.4;

// Typical annual commitment savings rate (e.g. YouTube Premium annual plan: 16.7% off)
export const ANNUAL_DISCOUNT_RATE = 0.167;

// Fixed obligations that are not "subscriptions" (rent, EMIs, insurance, utilities...).
// NOTE: bare "premium" was removed on purpose. It matched "YouTube Premium",
// "Spotify Premium", "Tinder Premium"... and filed them under Bills & Rent.
// "insurance premium" is still caught by the word "insurance".
export const BILL_REGEX =
  /\b(rent|emi|loans?|insurance|lic|electric\w*|broadband|maintenance|mortgage|tuition|school fee|postpaid|recharge|property tax)\b/i;

export const isBill = (s: Subscription): boolean =>
  s.category === 'Bills & Rent' || BILL_REGEX.test(s.name || '');

export const cycleMonths = (s: Subscription): number => {
  const f = s.frequency || s.billing;
  return f === 'Yearly' ? 12 : f === 'Quarterly' ? 3 : 1;
};

export const toINR = (amount: number, currency?: string): number =>
  currency === 'USD' ? amount * USD_TO_INR : amount;

/** Price of one billing cycle, in INR. */
export const cyclePriceINR = (s: Subscription): number => toINR(s.price, s.currency);

/** Cost normalised to one month, in INR. */
export const monthlyCost = (s: Subscription): number => cyclePriceINR(s) / cycleMonths(s);

/**
 * First occurrence of (from + k * stepMonths) that is on or after `today`.
 * Jumps from the original anchor instead of adding one month at a time, so
 * month-end dates don't drift (Jan 31 -> Feb 28 -> Mar 28 ...).
 */
export function rollForward(
  from: dayjs.Dayjs,
  stepMonths: number,
  today: dayjs.Dayjs = dayjs().startOf('day')
): dayjs.Dayjs {
  if (!from.isBefore(today)) return from;
  const step = Math.max(1, stepMonths);
  let k = Math.max(1, Math.floor(today.diff(from, 'month') / step));
  let d = from.add(k * step, 'month');
  while (d.isBefore(today)) {
    k++;
    d = from.add(k * step, 'month');
  }
  return d;
}

/** Next due date, rolled forward if the stored date is already in the past. */
export function nextDue(s: Subscription): dayjs.Dayjs | null {
  if (!s.renewalDate) return null;
  const d = dayjs(s.renewalDate).startOf('day');
  if (!d.isValid()) return null;
  return rollForward(d, cycleMonths(s), dayjs().startOf('day'));
}

/** Sum of cycle prices (INR) due in [start, end). */
export function dueBetween(subs: Subscription[], start: dayjs.Dayjs, end: dayjs.Dayjs): number {
  return subs.reduce((sum, s) => {
    if (s.status !== 'active') return sum;
    const d = nextDue(s);
    if (!d) return sum;
    return (d.isSame(start, 'day') || d.isAfter(start)) && d.isBefore(end) ? sum + cyclePriceINR(s) : sum;
  }, 0);
}