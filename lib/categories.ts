// Keyword-based categorisation. Everything runs on-device; tweak the lists freely.

export const SUB_CATEGORIES = [
  'Entertainment',
  'AI Tools',
  'Developer Tools',
  'Design',
  'Productivity',
  'Bills & Rent',
  'Other',
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Entertainment: '#ff6b6b',
  'AI Tools': '#56c2d6',
  'Developer Tools': '#a78bfa',
  Design: '#f5c542',
  Productivity: '#8fd1bd',
  'Bills & Rent': '#ea7a53',
  Other: '#d4d4d4',
};

const SUB_RULES: [string, RegExp][] = [
  ['Bills & Rent', /\b(rent|emi|loan|insurance|premium|lic|electric\w*|mseb|bescom|tata power|adani electricity|broadband|jio ?fiber|airtel|wifi|maintenance|postpaid|recharge|piped gas|mahanagar gas)\b/i],
  ['Entertainment', /netflix|spotify|hotstar|prime video|youtube|jiocinema|sonyliv|zee5|gaana|apple music|audible|disney|bookmyshow|jiosaavn/i],
  ['AI Tools', /openai|chatgpt|claude|anthropic|midjourney|perplexity|gemini|cursor|copilot|replit/i],
  ['Developer Tools', /github|vercel|netlify|digitalocean|aws|amazon web|hostinger|godaddy|namecheap|cloudflare|jetbrains|expo|apple developer|google cloud|hetzner|contabo|domain/i],
  ['Design', /figma|canva|adobe|framer|envato/i],
  ['Productivity', /notion|dropbox|google one|icloud|microsoft|office ?365|evernote|slack|zoom|linkedin/i],
];

/** Subscription / bill category for a recurring payee. 'Other' when unknown. */
export function subscriptionCategory(name: string): string {
  for (const [cat, re] of SUB_RULES) if (re.test(name)) return cat;
  return 'Other';
}

export const isBillName = (name: string) => subscriptionCategory(name) === 'Bills & Rent';

const SPEND_RULES: [string, RegExp][] = [
  ['Cash', /\b(atm|nfs|cash wdl|cash withdrawal|cwdr)\b/i],
  ['Bills & Utilities', /rent|emi|loan|insurance|electric|mseb|bescom|broadband|jio|airtel|vodafone|vi prepaid|recharge|dth|gas|water bill|maintenance|postpaid/i],
  ['Subscriptions', /netflix|spotify|hotstar|youtube|openai|chatgpt|claude|github|vercel|figma|canva|adobe|notion|dropbox|google play|playstore|icloud|apple\.com|microsoft|zoom|expo|hostinger|godaddy/i],
  ['Food & Groceries', /swiggy|zomato|restaurant|cafe|dominos|pizza|mcdonald|kfc|burger|eatsure|blinkit|zepto|bigbasket|instamart|grocer|dmart|kirana|bakery|sweets|hotel|dhaba|juice/i],
  ['Transport & Fuel', /uber|ola|rapido|irctc|redbus|fuel|petrol|diesel|hpcl|bpcl|iocl|indian oil|fastag|metro|railway|toll|parking/i],
  ['Shopping', /amazon|flipkart|myntra|ajio|meesho|nykaa|reliance|croma|decathlon|lenskart|store|mart|mall|retail/i],
  ['Health', /pharmacy|medical|apollo|medplus|hospital|clinic|1mg|pharmeasy|diagnostic|lab/i],
];

/** Spend category for a debit. Unmatched UPI payments are treated as transfers to people / small shops. */
export function spendCategory(details: string, merchant: string): string {
  const hay = `${details} ${merchant}`;
  for (const [cat, re] of SPEND_RULES) if (re.test(hay)) return cat;
  if (/\bupi\b/i.test(details)) return 'Transfers & People';
  return 'Other';
}

export const SPEND_COLORS: Record<string, string> = {
  'Bills & Utilities': '#ea7a53',
  Subscriptions: '#a78bfa',
  'Food & Groceries': '#f5c542',
  'Transport & Fuel': '#56c2d6',
  Shopping: '#ff6b6b',
  Health: '#8fd1bd',
  Cash: '#9ca3af',
  'Transfers & People': '#081126',
  Other: '#d4d4d4',
};

// ---------- own-account matching ----------

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * True if a payee looks like one of the user's own accounts.
 * - exact / contains match on any saved name ("sahil" matches "Of Mr Sahil Chetan Raul")
 * - bank statements truncate names ("SAHIL CH"), so a truncated payee that is a prefix of a saved name also matches
 */
export function isSelfMerchant(merchant: string, selfNames: string[]): boolean {
  const m = norm(merchant);
  if (!m || !selfNames?.length) return false;
  return selfNames.some((raw) => {
    const n = norm(raw);
    if (n.length < 3) return false;
    if (m === n) return true;
    if (n.length >= 4 && m.includes(n)) return true;
    if (m.length >= 6 && n.startsWith(m)) return true;
    return false;
  });
}
