import dayjs from 'dayjs';
import { isSelfMerchant } from './categories';
import type { StatementSummary } from './statementCore';

export type Tier = 'needs_work' | 'fair' | 'good' | 'excellent';

export const TIERS: { key: Tier; label: string; color: string; min: number }[] = [
  { key: 'needs_work', label: 'Needs Work', color: '#dc2626', min: 0 },
  { key: 'fair', label: 'Fair', color: '#ea7a53', min: 40 },
  { key: 'good', label: 'Good', color: '#208aef', min: 60 },
  { key: 'excellent', label: 'Excellent', color: '#16a34a', min: 80 },
];

export const tierFor = (score: number) => [...TIERS].reverse().find((t) => score >= t.min) || TIERS[0];

export interface MerchantRow {
  name: string;
  amount: number;
  count: number;
  category: string;
  isPerson: boolean;
}

export interface BankMetrics {
  realIncome: number;
  realSpend: number;
  net: number;
  savingsRate: number; // % of real income kept
  selfIn: number;
  selfOut: number;
  selfCount: number;
  days: number;
  months: number;
  monthlyIncome: number;
  monthlySpend: number;
  dailySpend: number;
  commitmentShareOfIncome: number; // fixed commitments (subs + bills) / monthly income, %
  commitmentShareOfSpend: number;
  avgBalance: number | null;
  minBalance: number | null;
  score: number;
  tier: (typeof TIERS)[number];
  merchants: MerchantRow[];
  categories: { name: string; amount: number; pct: number }[];
  monthly: { key: string; label: string; income: number; spend: number; partial: boolean }[];
  transactionCount: number;
  startDate: string;
  endDate: string;
}

export function computeBankMetrics(
  summary: StatementSummary | null,
  selfNames: string[],
  commitmentsMonthly: number
): BankMetrics | null {
  const txs = summary?.transactions;
  if (!summary || !txs || txs.length === 0) return null;

  let realIncome = 0, realSpend = 0, selfIn = 0, selfOut = 0, selfCount = 0;
  const merch: Record<string, MerchantRow> = {};
  const cats: Record<string, number> = {};
  const byMonth: Record<string, { income: number; spend: number }> = {};
  const balances: number[] = [];

  txs.forEach((t) => {
    if (typeof t.balance === 'number') balances.push(t.balance);
    if (isSelfMerchant(t.merchant, selfNames)) {
      selfIn += t.credit;
      selfOut += t.debit;
      selfCount++;
      return;
    }
    realIncome += t.credit;
    realSpend += t.debit;

    const mk = t.date.slice(0, 7);
    (byMonth[mk] ||= { income: 0, spend: 0 });
    byMonth[mk].income += t.credit;
    byMonth[mk].spend += t.debit;

    if (t.debit > 0) {
      const key = t.merchant.toLowerCase();
      (merch[key] ||= { name: t.merchant, amount: 0, count: 0, category: t.category, isPerson: t.category === 'Transfers & People' });
      merch[key].amount += t.debit;
      merch[key].count += 1;
      cats[t.category] = (cats[t.category] || 0) + t.debit;
    }
  });

  const start = dayjs(summary.startDate);
  const end = dayjs(summary.endDate);
  const days = Math.max(1, end.diff(start, 'day') + 1);
  const months = Math.max(days / 30.4, 1);
  const monthlyIncome = realIncome / months;
  const monthlySpend = realSpend / months;
  const net = realIncome - realSpend;
  const savingsRate = realIncome > 0 ? (net / realIncome) * 100 : 0;
  const commitmentShareOfIncome = monthlyIncome > 0 ? (commitmentsMonthly / monthlyIncome) * 100 : 0;
  const commitmentShareOfSpend = monthlySpend > 0 ? (commitmentsMonthly / monthlySpend) * 100 : 0;
  const avgBalance = balances.length ? balances.reduce((a, b) => a + b, 0) / balances.length : null;
  const minBalance = balances.length ? Math.min(...balances) : null;

  // --- score (transparent heuristic, not a real credit score) ---
  let score = 35;
  if (savingsRate >= 20) score += 30;
  else if (savingsRate >= 10) score += 22;
  else if (savingsRate > 0) score += 12;
  else score -= 10;

  if (monthlyIncome > 0) {
    if (commitmentShareOfIncome <= 25) score += 20;
    else if (commitmentShareOfIncome <= 40) score += 12;
    else if (commitmentShareOfIncome <= 55) score += 4;
    else score -= 5;
  }
  if (avgBalance !== null && avgBalance >= monthlySpend * 0.5) score += 10;
  score = Math.min(100, Math.max(10, Math.round(score)));

  const monthly = Object.keys(byMonth)
    .sort()
    .slice(-6)
    .map((k) => {
      const m = dayjs(`${k}-01`);
      const partial =
        (k === summary.startDate.slice(0, 7) && start.date() > 5) ||
        (k === summary.endDate.slice(0, 7) && end.date() < m.daysInMonth() - 5);
      return { key: k, label: m.format('MMM'), income: byMonth[k].income, spend: byMonth[k].spend, partial };
    });

  const catRows = Object.entries(cats)
    .map(([name, amount]) => ({ name, amount, pct: realSpend > 0 ? (amount / realSpend) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return {
    realIncome, realSpend, net, savingsRate, selfIn, selfOut, selfCount, days, months,
    monthlyIncome, monthlySpend, dailySpend: realSpend / days,
    commitmentShareOfIncome, commitmentShareOfSpend, avgBalance, minBalance,
    score, tier: tierFor(score),
    merchants: Object.values(merch).sort((a, b) => b.amount - a.amount),
    categories: catRows,
    monthly,
    transactionCount: summary.transactionCount,
    startDate: summary.startDate,
    endDate: summary.endDate,
  };
}
