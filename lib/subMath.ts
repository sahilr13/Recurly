import dayjs from 'dayjs';

// Live rate ~₹96.4 per USD
export const USD_TO_INR = 96.4;

// Typical annual commitment savings rate (e.g. YouTube Premium annual plan: 16.7% off)
export const ANNUAL_DISCOUNT_RATE = 0.167;

// Fixed obligations that are not "subscriptions" (rent, EMIs, insurance, utilities...).
export const BILL_REGEX =
  /\b(rent|emi|loan|insurance|premium|electric\w*|broadband|maintenance|mortgage|tuition|school fee|postpaid|recharge)\b/i;

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

/** Next due date, rolled forward if the stored date is already in the past. */
export function nextDue(s: Subscription): dayjs.Dayjs | null {
  if (!s.renewalDate) return null;
  let d = dayjs(s.renewalDate).startOf('day');
  if (!d.isValid()) return null;
  const today = dayjs().startOf('day');
  const step = cycleMonths(s);
  let guard = 0;
  while (d.isBefore(today) && guard++ < 600) d = d.add(step, 'month');
  return d;
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