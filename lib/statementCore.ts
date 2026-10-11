// Pure parsing logic (no Expo imports) so it can be unit-tested in plain Node.
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { CATEGORY_COLORS, isBillName, isSelfMerchant, spendCategory, subscriptionCategory } from './categories';

dayjs.extend(customParseFormat);

export interface StatementTx {
  date: string; // YYYY-MM-DD
  merchant: string; // cleaned payee name (no UPI refs / VPAs are stored)
  category: string;
  debit: number;
  credit: number;
  balance?: number;
}

export interface StatementSummary {
  fileName: string;
  importedAt: string;
  startDate: string;
  endDate: string;
  totalDebits: number; // raw, includes transfers between own accounts
  totalCredits: number;
  netCashflow: number;
  transactionCount: number;
  currency: string;
  // Missing on data imported with the old version -> app asks for a re-import.
  transactions?: StatementTx[];
}

export interface ParseResult {
  subscriptions: Subscription[];
  summary: StatementSummary;
}

const titleCaseIfShouting = (s: string) =>
  s === s.toUpperCase()
    ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : s;

/** "WDL TFR UPI/DR/610122666134/Google A/utib/playstoreg" -> "Google Play" ; "UPI/DR/123/KIRAN RA/..." -> "Kiran Ra" */
export function cleanMerchantName(raw: string): string {
  if (/playstore|google\s*play/i.test(raw)) return 'Google Play';

  let cleaned = raw;
  if (/UPI\/(DR|CR)\//i.test(cleaned)) {
    const parts = cleaned.split('/');
    const i = parts.findIndex((p) => /^(DR|CR)$/i.test(p.trim()));
    const cand = (i >= 0 ? parts[i + 2] : parts[3])?.trim();
    if (cand && cand.length > 1) cleaned = cand;
  }

  cleaned = cleaned
    .replace(
      /(wdl tfr|dep tfr|direct dr|pos debit|purchase|recurring|card transaction|payment to|withdrawal|ach debit|upi|autopay|imps|neft|to transfer|by transfer)/gi,
      ' '
    )
    .replace(/\bat\s+\d{3,6}\s+[a-z]+/gi, ' ') // branch suffix like "AT 03918 TARAPUR"
    .replace(/[0-9*#@_/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return titleCaseIfShouting(cleaned);
}

function parseFlexibleDate(str: string): dayjs.Dayjs {
  const cleaned = str.trim();
  const formats = ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD/MM/YY', 'DD-MM-YY', 'D MMM YYYY', 'DD MMM YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD'];
  for (const fmt of formats) {
    const parsed = dayjs(cleaned, fmt, true);
    if (parsed.isValid()) return parsed;
  }
  return dayjs(cleaned);
}

export function parseRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result.map((c) => c.replace(/^["']|["']$/g, '').trim());
}

interface ColMap {
  date: number;
  details: number;
  debit: number;
  credit: number;
  balance: number;
}

function mapColumns(header: string[]): ColMap {
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const pick = (idx: number, fallback: number) => (idx >= 0 ? idx : fallback);
  return {
    date: pick(find('txn date', 'transaction date', 'value date', 'date'), 0),
    details: pick(find('details', 'narration', 'description', 'particulars'), 1),
    debit: pick(find('debit', 'withdrawal'), 3), // SBI layout fallback
    credit: pick(find('credit', 'deposit'), 4),
    balance: pick(find('balance'), 5),
  };
}

const num = (v?: string) => parseFloat((v ?? '').replace(/[^0-9.-]/g, ''));

export function parseStatementCsv(rawCsv: string, fileName: string): { transactions: StatementTx[]; summary: StatementSummary } {
  const lines = rawCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);

  let headerIndex = -1;
  let cols: ColMap = { date: 0, details: 1, debit: 3, credit: 4, balance: 5 };
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const row = parseRow(lines[i].toLowerCase());
    if (
      row.some((c) => c.includes('date')) &&
      row.some((c) => c.includes('debit') || c.includes('details') || c.includes('narration') || c.includes('withdrawal'))
    ) {
      headerIndex = i;
      cols = mapColumns(row);
      break;
    }
  }
  if (headerIndex === -1) throw new Error('Could not identify the transaction header row in this statement.');

  interface Raw {
    date: dayjs.Dayjs;
    details: string;
    debit: number;
    credit: number;
    balance?: number;
  }
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  const flush = () => {
    if (cur && (cur.debit > 0 || cur.credit > 0)) raws.push(cur);
  };

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const c = parseRow(lines[i]);
    if (c.length === 0) continue;
    const first = (c[0] || '').toLowerCase();
    if (first.includes('statement summary') || first.includes('brought forward') || first.includes('please do not share')) break;

    const dateCell = c[cols.date] ?? c[0] ?? '';
    const isDate = /^\d{1,2}[/\- ](\d{1,2}|[A-Za-z]{3})[/\- ]\d{2,4}$/.test(dateCell);

    if (isDate) {
      flush();
      const bal = num(c[cols.balance]);
      cur = {
        date: parseFlexibleDate(dateCell),
        details: c[cols.details] || '',
        debit: Math.abs(num(c[cols.debit]) || 0),
        credit: Math.abs(num(c[cols.credit]) || 0),
        balance: Number.isFinite(bal) ? bal : undefined,
      };
    } else if (cur) {
      // Continuation row (multi-line SBI narration)
      if (c[0]) cur.details += ' ' + c[0];
      const a = num(c[2]) || 0;
      const b = num(c[3]) || 0;
      if (!cur.debit && a > 0) cur.debit = Math.abs(a);
      if (!cur.credit && b > 0) cur.credit = Math.abs(b);
    }
  }
  flush();

  if (raws.length === 0) throw new Error('No valid debit or credit transactions were found in this file.');

  let totalDebits = 0;
  let totalCredits = 0;
  const transactions: StatementTx[] = raws.map((r) => {
    totalDebits += r.debit;
    totalCredits += r.credit;
    const merchant = cleanMerchantName(r.details) || 'Other';
    return {
      date: r.date.format('YYYY-MM-DD'),
      merchant,
      category: r.debit > 0 ? spendCategory(r.details, merchant) : 'Income',
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
    };
  });

  const dates = transactions.map((t) => t.date).sort();
  const summary: StatementSummary = {
    fileName,
    importedAt: dayjs().toISOString(),
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    totalDebits: Number(totalDebits.toFixed(2)),
    totalCredits: Number(totalCredits.toFixed(2)),
    netCashflow: Number((totalCredits - totalDebits).toFixed(2)),
    transactionCount: transactions.length,
    currency: 'INR',
    transactions,
  };
  return { transactions, summary };
}

// ---------------- recurring detection ----------------

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function detectRecurring(txs: StatementTx[], selfNames: string[] = []): Subscription[] {
  const groups: Record<string, StatementTx[]> = {};
  txs.forEach((t) => {
    if (t.debit <= 0 || t.category === 'Cash') return;
    if (isSelfMerchant(t.merchant, selfNames)) return;
    const key = t.merchant.toLowerCase();
    if (key.length < 3) return;
    (groups[key] ||= []).push(t);
  });

  const out: Subscription[] = [];
  const today = dayjs().startOf('day');

  Object.entries(groups).forEach(([key, all]) => {
    if (all.length < 2) return;

    // Only compare payments of a similar amount (+-10% of the median) so random UPI payments don't qualify.
    const med = median(all.map((t) => t.debit));
    const series = all.filter((t) => Math.abs(t.debit - med) <= med * 0.1).sort((a, b) => a.date.localeCompare(b.date));
    if (series.length < 2) return;

    let monthly = 0, quarterly = 0, yearly = 0;
    for (let i = 1; i < series.length; i++) {
      const gap = dayjs(series[i].date).diff(dayjs(series[i - 1].date), 'day');
      if (gap >= 25 && gap <= 35) monthly++;
      else if (gap >= 85 && gap <= 95) quarterly++;
      else if (gap >= 350 && gap <= 380) yearly++;
    }

    const name = series[series.length - 1].merchant;
    const known = subscriptionCategory(name) !== 'Other';

    let frequency: 'Monthly' | 'Quarterly' | 'Yearly' | null = null;
    if (yearly >= 1) frequency = 'Yearly';
    else if (monthly >= 2 || (monthly >= 1 && known)) frequency = 'Monthly';
    else if (quarterly >= 2 || (quarterly >= 1 && known)) frequency = 'Quarterly';
    if (!frequency) return;

    const last = series[series.length - 1];
    const step = frequency === 'Yearly' ? 12 : frequency === 'Quarterly' ? 3 : 1;
    let renewal = dayjs(last.date).add(step, 'month');
    let guard = 0;
    while (renewal.isBefore(today) && guard++ < 600) renewal = renewal.add(step, 'month');

    const category = isBillName(name) ? 'Bills & Rent' : subscriptionCategory(name);
    out.push({
      id: `detected-${key.replace(/[^a-z0-9]+/g, '-')}`, // stable id -> re-imports don't duplicate
      name,
      price: last.debit,
      currency: 'INR',
      frequency,
      category,
      status: 'active',
      startDate: dayjs(series[0].date).toISOString(),
      renewalDate: renewal.toISOString(),
      billing: frequency,
      color: CATEGORY_COLORS[category] || '#f5c542',
    } as Subscription);
  });

  return out;
}
