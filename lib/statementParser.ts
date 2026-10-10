import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import dayjs from 'dayjs';

function cleanMerchantName(raw: string): string {
  return raw
    .replace(/(pos debit|purchase|recurring|card transaction|payment to|withdrawal|ach debit|upi|autopay)/gi, '')
    .replace(/[0-9*#@_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function pickAndParseStatement(): Promise<Subscription[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return [];
  }

  const fileUri = result.assets[0].uri;
  const content = await FileSystem.readAsStringAsync(fileUri);
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',').map((h) => h.replace(/["']/g, '').trim());
  const dateIdx = header.findIndex((h) => h.includes('date'));
  const descIdx = header.findIndex((h) =>
    h.includes('desc') || h.includes('narration') || h.includes('detail') || h.includes('merchant') || h.includes('particular')
  );
  const debitIdx = header.findIndex((h) =>
    h.includes('debit') || h.includes('withdrawal') || h.includes('amount')
  );

  if (dateIdx === -1 || descIdx === -1 || debitIdx === -1) {
    throw new Error('Unable to find Date, Description, or Amount columns in CSV.');
  }

  interface Tx {
    date: dayjs.Dayjs;
    cleanName: string;
    amount: number;
  }

  const transactions: Tx[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/["']/g, '').trim());
    if (cols.length <= Math.max(dateIdx, descIdx, debitIdx)) continue;

    const dateVal = dayjs(cols[dateIdx]);
    const rawName = cols[descIdx];
    const amountVal = Math.abs(parseFloat(cols[debitIdx].replace(/[^0-9.-]/g, '')));

    if (dateVal.isValid() && rawName && !isNaN(amountVal) && amountVal > 0) {
      transactions.push({
        date: dateVal,
        cleanName: cleanMerchantName(rawName),
        amount: amountVal,
      });
    }
  }

  const grouped: Record<string, Tx[]> = {};
  transactions.forEach((tx) => {
    const key = tx.cleanName.toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  });

  const detectedSubscriptions: Subscription[] = [];

  Object.entries(grouped).forEach(([key, txs]) => {
    if (txs.length < 2) return;

    txs.sort((a, b) => a.date.valueOf() - b.date.valueOf());

    let isMonthly = false;
    let isYearly = false;

    for (let i = 1; i < txs.length; i++) {
      const daysDiff = Math.abs(txs[i].date.diff(txs[i - 1].date, 'day'));
      if (daysDiff >= 25 && daysDiff <= 35) isMonthly = true;
      if (daysDiff >= 350 && daysDiff <= 380) isYearly = true;
    }

    if (isMonthly || isYearly) {
      const latestTx = txs[txs.length - 1];
      const frequency = isYearly ? 'Yearly' : 'Monthly';
      const renewalDate = frequency === 'Monthly'
        ? latestTx.date.add(1, 'month')
        : latestTx.date.add(1, 'year');

      const formattedName = key.charAt(0).toUpperCase() + key.slice(1);

      detectedSubscriptions.push({
        id: `detected-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: formattedName,
        price: latestTx.amount,
        currency: 'USD',
        frequency,
        category: 'Other',
        status: 'active',
        startDate: txs[0].date.toISOString(),
        renewalDate: renewalDate.toISOString(),
        billing: frequency,
        color: '#f5c542',
      });
    }
  });

  return detectedSubscriptions;
}