import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import * as XLSX from 'xlsx';

dayjs.extend(customParseFormat);

export interface StatementSummary {
  fileName: string;
  importedAt: string;
  startDate: string;
  endDate: string;
  totalDebits: number;
  totalCredits: number;
  netCashflow: number;
  transactionCount: number;
  topMerchants: { name: string; amount: number; count: number }[];
  currency: string;
}

export interface ParseResult {
  subscriptions: Subscription[];
  summary: StatementSummary;
}

// Cleans UPI strings (e.g. "WDL TFR UPI/DR/610122666134/Google A/utib/playstoreg" -> "Google A")
function cleanMerchantName(raw: string): string {
  let cleaned = raw;

  // Extract merchant name from standard Indian UPI narration format
  if (cleaned.includes('UPI/DR/') || cleaned.includes('UPI/CR/')) {
    const parts = cleaned.split('/');
    if (parts.length >= 4 && parts[3].trim().length > 1) {
      cleaned = parts[3].trim();
    }
  }

  return cleaned
    .replace(/(wdl tfr|dep tfr|direct dr|pos debit|purchase|recurring|card transaction|payment to|withdrawal|ach debit|upi|autopay|imps|neft|to transfer|by transfer|at 03918 tarapur)/gi, ' ')
    .replace(/[0-9*#@_/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFlexibleDate(str: string): dayjs.Dayjs {
  const cleaned = str.trim();
  const formats = [
    'DD/MM/YYYY',
    'DD-MM-YYYY',
    'DD/MM/YY',
    'DD-MM-YY',
    'DD MMM YYYY',
    'YYYY-MM-DD',
  ];
  for (const fmt of formats) {
    const parsed = dayjs(cleaned, fmt, true);
    if (parsed.isValid()) return parsed;
  }
  return dayjs(cleaned);
}

function parseRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((c) => c.replace(/^["']|["']$/g, '').trim());
}

async function readFileContent(uri: string, isExcel: boolean): Promise<string> {
  const encoding = isExcel ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8;

  try {
    return await FileSystem.readAsStringAsync(uri, { encoding });
  } catch {
    // Android scoped storage fallback: copy to sandbox cache before reading
    const tempTarget = `${FileSystem.cacheDirectory}import_${Date.now()}.${isExcel ? 'xlsx' : 'csv'}`;
    await FileSystem.copyAsync({ from: uri, to: tempTarget });
    try {
      return await FileSystem.readAsStringAsync(tempTarget, { encoding });
    } finally {
      await FileSystem.deleteAsync(tempTarget, { idempotent: true }).catch(() => {});
    }
  }
}

export async function pickAndParseStatement(): Promise<ParseResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    copyToCacheDirectory: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const pickedFile = result.assets[0];
  const isExcel = pickedFile.name.endsWith('.xlsx') || pickedFile.name.endsWith('.xls');

  let rawCsv = '';

  if (isExcel) {
    const base64Data = await readFileContent(pickedFile.uri, true);
    let workbook;
    try {
      workbook = XLSX.read(base64Data, { type: 'base64' });
    } catch {
      throw new Error('This Excel file is password-protected or formatted incorrectly. Please export it without a password.');
    }
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    rawCsv = XLSX.utils.sheet_to_csv(worksheet);
  } else {
    rawCsv = await readFileContent(pickedFile.uri, false);
  }

  const lines = rawCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // 1. Locate the header row (e.g. "Date,Details,Ref No/Cheque No,Debit,Credit,Balance")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const row = parseRow(lines[i].toLowerCase());
    if (row.some((c) => c.includes('date')) && row.some((c) => c.includes('debit') || c.includes('details'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Could not identify the transaction header row in this statement.');
  }

  // 2. Stitch multi-line SBI transaction pairs together
  interface ParsedTx {
    date: dayjs.Dayjs;
    details: string;
    debit: number;
    credit: number;
  }

  const transactions: ParsedTx[] = [];
  let currentTx: { date: dayjs.Dayjs; details: string; debit: number; credit: number } | null = null;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    if (cols.length === 0) continue;

    const firstCol = cols[0];
    const firstColLower = firstCol.toLowerCase();

    // Stop parsing once the statement footer/summary is reached
    if (firstColLower.includes('statement summary') || firstColLower.includes('brought forward') || firstColLower.includes('please do not share')) {
      break;
    }

    const dateMatch = /^\d{2}[/-]\d{2}[/-]\d{2,4}$/.test(firstCol);

    if (dateMatch) {
      if (currentTx && (currentTx.debit > 0 || currentTx.credit > 0)) {
        transactions.push(currentTx);
      }

      const initialDebit = parseFloat(cols[3]?.replace(/[^0-9.-]/g, '')) || 0;
      const initialCredit = parseFloat(cols[4]?.replace(/[^0-9.-]/g, '')) || 0;

      currentTx = {
        date: parseFlexibleDate(firstCol),
        details: cols[1] || '',
        debit: Math.abs(initialDebit),
        credit: Math.abs(initialCredit),
      };
    } else if (currentTx) {
      // Continuation row: stitch narration
      if (cols[0]) {
        currentTx.details += ' ' + cols[0];
      }

      // Check for shifted debit/credit columns
      const debCol2 = parseFloat(cols[2]?.replace(/[^0-9.-]/g, '')) || 0;
      const debCol3 = parseFloat(cols[3]?.replace(/[^0-9.-]/g, '')) || 0;

      if (!currentTx.debit && debCol2 > 0) {
        currentTx.debit = Math.abs(debCol2);
      }
      if (!currentTx.credit && debCol3 > 0) {
        currentTx.credit = Math.abs(debCol3);
      }
    }
  }

  // Push the final transaction
  if (currentTx && (currentTx.debit > 0 || currentTx.credit > 0)) {
    transactions.push(currentTx);
  }

  if (transactions.length === 0) {
    throw new Error('No valid debit or credit transactions were found in this file.');
  }

  // 3. Compute metrics & detect recurring subscriptions
  let totalDebits = 0;
  let totalCredits = 0;
  const merchantTotals: Record<string, { amount: number; count: number }> = {};
  const groupedForRecurring: Record<string, ParsedTx[]> = {};

  transactions.forEach((tx) => {
    totalDebits += tx.debit;
    totalCredits += tx.credit;

    if (tx.debit > 0) {
      const cleanName = cleanMerchantName(tx.details) || 'Other Outflow';
      if (!merchantTotals[cleanName]) merchantTotals[cleanName] = { amount: 0, count: 0 };
      merchantTotals[cleanName].amount += tx.debit;
      merchantTotals[cleanName].count += 1;

      const key = cleanName.toLowerCase();
      if (key.length >= 3) {
        if (!groupedForRecurring[key]) groupedForRecurring[key] = [];
        groupedForRecurring[key].push(tx);
      }
    }
  });

  const detectedSubscriptions: Subscription[] = [];

  Object.entries(groupedForRecurring).forEach(([key, txs]) => {
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
      const latest = txs[txs.length - 1];
      const frequency = isYearly ? 'Yearly' : 'Monthly';
      const formattedName = key.charAt(0).toUpperCase() + key.slice(1);

      detectedSubscriptions.push({
        id: `detected-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: formattedName,
        price: latest.debit,
        currency: 'INR',
        frequency,
        category: 'Other',
        status: 'active',
        startDate: txs[0].date.toISOString(),
        renewalDate: (frequency === 'Monthly' ? latest.date.add(1, 'month') : latest.date.add(1, 'year')).toISOString(),
        billing: frequency,
        color: '#f5c542',
      });
    }
  });

  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5)
    .map(([name, data]) => ({ name, amount: data.amount, count: data.count }));

  const sortedDates = transactions.map((t) => t.date.valueOf()).sort((a, b) => a - b);
  const startDate = dayjs(sortedDates[0]).format('YYYY-MM-DD');
  const endDate = dayjs(sortedDates[sortedDates.length - 1]).format('YYYY-MM-DD');

  const summary: StatementSummary = {
    fileName: pickedFile.name,
    importedAt: dayjs().toISOString(),
    startDate,
    endDate,
    totalDebits: Number(totalDebits.toFixed(2)),
    totalCredits: Number(totalCredits.toFixed(2)),
    netCashflow: Number((totalCredits - totalDebits).toFixed(2)),
    transactionCount: transactions.length,
    topMerchants,
    currency: 'INR',
  };

  return {
    subscriptions: detectedSubscriptions,
    summary,
  };
}