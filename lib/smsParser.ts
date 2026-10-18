import dayjs from 'dayjs';

export interface ParsedBankSMS {
  id: string;
  sender: string;
  amount: number;
  type: 'debit' | 'credit';
  merchant: string;
  balance: number | null;
  date: string;
  rawBody: string;
}

// Broad sender list covering Indian banks, UPI handles, and shortcodes
const SENDER_PATTERNS = [
  'SBI', 'SBIUPI', 'SBIINB', 'HDFC', 'ICICI', 'AXIS', 'KOTAK', 'BOB',
  'PNB', 'CANARA', 'UNION', 'INDUS', 'YESBK', 'PAYTM', 'GPAY',
  'PHONEPE', 'CRED', 'SLICE', 'JUPITR', 'FI', 'IDFC', 'RBL', 'FED'
];

export function isBankSender(address: string, body: string): boolean {
  const upperAddr = (address || '').toUpperCase();
  const upperBody = (body || '').toUpperCase();

  // 1. Matches bank sender tag (e.g., AX-SBIUPI-S, VM-SBIINB)
  const matchesTag = SENDER_PATTERNS.some((bank) => upperAddr.includes(bank));
  if (matchesTag) return true;

  // 2. Fallback: Contains banking transaction keywords in message body
  const hasAccountRef = upperBody.includes('A/C') || upperBody.includes('ACCT') || upperBody.includes('UPI USER');
  const hasTxnAction = upperBody.includes('DEBITED') || upperBody.includes('CREDITED') || upperBody.includes('TRF TO');

  return hasAccountRef && hasTxnAction;
}

export function parseTransactionSMS(rawMessage: { _id?: string; address: string; body: string; date: string }): ParsedBankSMS | null {
  const body = rawMessage.body;
  if (!body) return null;

  // 1. Detect Transaction Type
  // If both debit and credit keywords appear, the one that appears FIRST in the message wins
  // (a credit alert that mentions "transfer" or "received" must not be treated as a debit).
  const debitIdx = body.search(/\b(debited|spent|paid|withdrawn|charged|txn of|transfer(?:red)? to|trf to|sent to)\b/i);
  const creditIdx = body.search(/\b(credited|received|deposited|refunded)\b/i);

  if (debitIdx < 0 && creditIdx < 0) return null;

  const isDebit = debitIdx >= 0 && (creditIdx < 0 || debitIdx < creditIdx);
  const isCredit = !isDebit;

  // 2. Amount Extraction (handles "debited by 1489.00", "Debited INR 3,000.00", "Rs. 3,000.00", etc.)
  let amount: number | null = null;

  // Pattern A: explicitly prefixed/suffixed with Rs / INR / ₹
  const currencyMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                        body.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i);

  if (currencyMatch && currencyMatch[1]) {
    amount = parseFloat(currencyMatch[1].replace(/,/g, ''));
  }

  // Pattern B: action verbs without currency symbol (e.g., "debited by 1489.00 on date")
  if (!amount || isNaN(amount)) {
    const verbMatch = body.match(/(?:debited(?:\s+by|\s+with|\s+for)?|credited(?:\s+by|\s+with|\s+for)?|spent|paid|withdrawn|charged)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (verbMatch && verbMatch[1]) {
      amount = parseFloat(verbMatch[1].replace(/,/g, ''));
    }
  }

  if (!amount || isNaN(amount) || amount <= 0) return null;

  // 3. Merchant / Payee Extraction
  let merchant = isCredit ? 'Credit / Deposit' : 'General Debit';

  // Matches "trf to CITY CHEMIST Refno", "-Transferred to Mr. Sahil Chetan Rau. Avl Balance", etc.
  const payeeMatch = body.match(/(?:(?:trf|transfer(?:red)?|paid|sent)\s+to|[-–]\s*transfer(?:red)?\s+to|vpa|towards)\s+([A-Za-z0-9.\-_@* \n]+?)(?=\.?\s+(?:Avl|Bal|Refno|Ref|If not|call|on\s+\d|-SBI|\.$))/i) ||
                     body.match(/(?:to|at)\s+([A-Za-z0-9.\-_@* \n]+?)(?=\.?\s+(?:Avl|Bal|Refno|Ref|If not|call|-SBI|\.$))/i);

  if (payeeMatch && payeeMatch[1]) {
    merchant = payeeMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 4. Available Balance Extraction
  let balance: number | null = null;
  const balMatch = body.match(/(?:bal(?:ance)?|avl(?:\s+bal|\s+balance)?|available\s+balance)\s*(?:is|[:\-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    const balVal = parseFloat(balMatch[1].replace(/,/g, ''));
    if (!isNaN(balVal)) balance = balVal;
  }

  // 5. Date Resolution
  const txDate = rawMessage.date && !isNaN(Number(rawMessage.date))
    ? dayjs(Number(rawMessage.date)).format('YYYY-MM-DD')
    : dayjs().format('YYYY-MM-DD');

  return {
    id: rawMessage._id || `sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender: rawMessage.address,
    amount,
    type: isDebit ? 'debit' : 'credit',
    merchant: cleanMerchantName(merchant),
    balance,
    date: txDate,
    rawBody: body,
  };
}

function cleanMerchantName(raw: string): string {
  return raw
    .replace(/^(UPI\/|IMPS\/|NEFT\/|BIL\*|POS\*)/i, '')
    .replace(/^(Mr\.\s*|Ms\.\s*|Mrs\.\s*)/i, '') // Strips honorifics for cleaner grouping
    .replace(/[*\-_#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}