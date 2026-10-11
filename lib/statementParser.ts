import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { detectRecurring, parseStatementCsv } from './statementCore';

export type { StatementSummary, StatementTx, ParseResult } from './statementCore';
import type { ParseResult } from './statementCore';

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

/**
 * @param selfNames names of the user's own accounts; transfers to them are never treated as subscriptions
 */
export async function pickAndParseStatement(selfNames: string[] = []): Promise<ParseResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    copyToCacheDirectory: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  const file = result.assets[0];
  const lower = file.name.toLowerCase();
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');

  let rawCsv: string;
  if (isExcel) {
    const base64 = await readFileContent(file.uri, true);
    let workbook;
    try {
      workbook = XLSX.read(base64, { type: 'base64' });
    } catch {
      throw new Error('This Excel file is password-protected or formatted incorrectly. Please export it without a password.');
    }
    rawCsv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
  } else {
    rawCsv = await readFileContent(file.uri, false);
  }

  const { transactions, summary } = parseStatementCsv(rawCsv, file.name);
  return { subscriptions: detectRecurring(transactions, selfNames), summary };
}
