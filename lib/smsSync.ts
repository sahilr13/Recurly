import { PermissionsAndroid, Platform } from 'react-native';
import dayjs from 'dayjs';
import { listSms, diagnoseSms } from '../modules/sms-reader';
import { isBankSender, parseTransactionSMS, ParsedBankSMS } from './smsParser';
import { useSubscriptionStore } from './subscriptionStore';
import { detectRecurring } from './statementCore';
import type { StatementSummary, StatementTx } from './statementCore';
import { spendCategory } from './categories';

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'Recurrly Bank Sync',
        message: 'Allow Recurrly to read transaction alerts on this device to calculate your financial health score.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const titleCaseIfShouting = (s: string) =>
  s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;

// Same transaction seen via SMS and via a CSV statement has different merchant text,
// so dedupe on date + amount + direction instead of merchant.
const txKey = (date: string, amount: number, isDebit: boolean) =>
  `${date}|${amount.toFixed(2)}|${isDebit ? 'D' : 'C'}`;

export async function syncHistoricalBankSms(daysBack = 90): Promise<{
  count: number;
  rawCount?: number;
  bankCount?: number;
  subsDetected?: number;
  error?: string;
}> {
  const hasPermission = await requestSmsPermission();
  if (!hasPermission) return { count: 0, error: 'SMS permission not granted by user.' };

  try {
    const minDate = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const rawMessages = await listSms(minDate, 3000);

    if (!rawMessages || rawMessages.length === 0) {
      let detail = '';
      try {
        detail = '\n' + JSON.stringify(await diagnoseSms());
      } catch (e: any) {
        detail = `\n(diagnose failed: ${e?.message})`;
      }
      return {
        count: 0,
        rawCount: 0,
        bankCount: 0,
        error: `Inbox query returned 0 messages in the last ${daysBack} days.${detail}`,
      };
    }

    const parsed: ParsedBankSMS[] = [];
    let bankAlertCount = 0;
    for (const msg of rawMessages) {
      if (isBankSender(msg.address, msg.body)) {
        bankAlertCount++;
        const p = parseTransactionSMS(msg);
        if (p) parsed.push(p);
      }
    }

    if (parsed.length === 0) {
      return {
        count: 0,
        rawCount: rawMessages.length,
        bankCount: bankAlertCount,
        error: `Found ${rawMessages.length} total SMS (${bankAlertCount} bank alerts), but none contained valid transaction amounts.`,
      };
    }

    const store = useSubscriptionStore.getState();
    const prev = store.statementSummary;
    const existing: StatementTx[] = prev?.transactions || [];
    const existingKeys = new Set(
      existing.map((t) => txKey(t.date, t.debit || t.credit, t.debit > 0))
    );

    // Skip only what is already stored; keep legit same-day repeats within this batch.
    const incoming: StatementTx[] = parsed
      .filter((s) => !existingKeys.has(txKey(s.date, s.amount, s.type === 'debit')))
      .map((s) => {
        const merchant = titleCaseIfShouting(s.merchant) || 'Other';
        return {
          date: s.date,
          merchant,
          category: s.type === 'credit' ? 'Income' : spendCategory(s.rawBody, merchant),
          debit: s.type === 'debit' ? s.amount : 0,
          credit: s.type === 'credit' ? s.amount : 0,
          balance: s.balance ?? undefined,
        };
      });

    const allTxns = [...existing, ...incoming].sort((a, b) => b.date.localeCompare(a.date));

    const totalDebits = allTxns.reduce((n, t) => n + t.debit, 0);
    const totalCredits = allTxns.reduce((n, t) => n + t.credit, 0);

    // Full StatementSummary shape (same fields the CSV import writes), so analytics works.
    const summary: StatementSummary = {
      fileName: prev?.fileName || 'Bank SMS Feed',
      importedAt: dayjs().toISOString(),
      startDate: allTxns[allTxns.length - 1]?.date || dayjs().format('YYYY-MM-DD'),
      endDate: allTxns[0]?.date || dayjs().format('YYYY-MM-DD'),
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      netCashflow: Number((totalCredits - totalDebits).toFixed(2)),
      transactionCount: allTxns.length,
      currency: 'INR',
      transactions: allTxns,
    };
    store.setStatementSummary(summary);

    // This was the missing step: turn recurring payments into subscriptions.
    const detected = detectRecurring(allTxns, store.myNames);
    const before = useSubscriptionStore.getState().subscriptions.length;
    if (detected.length > 0) store.addSubscriptions(detected);
    const subsAdded = useSubscriptionStore.getState().subscriptions.length - before;

    return {
      count: incoming.length,
      rawCount: rawMessages.length,
      bankCount: bankAlertCount,
      subsDetected: subsAdded,
    };
  } catch (error: any) {
    return { count: 0, error: error?.message || 'Failed to query SMS' };
  }
}