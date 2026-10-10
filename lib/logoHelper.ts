import { icons } from '../constants/icons';

// Domain overrides for popular services where domain doesn't match standard name
const DOMAIN_OVERRIDES: Record<string, string> = {
  'jio hotstar': 'hotstar.com',
  'jiohotstar': 'hotstar.com',
  'disney+ hotstar': 'hotstar.com',
  'hotstar': 'hotstar.com',
  'jiocinema': 'jiocinema.com',
  'jio cinema': 'jiocinema.com',
  'youtube premium': 'youtube.com',
  'youtube': 'youtube.com',
  'amazon prime': 'amazon.com',
  'prime video': 'primevideo.com',
  'chatgpt': 'openai.com',
  'swiggy one': 'swiggy.com',
  'swiggy': 'swiggy.com',
  'zomato gold': 'zomato.com',
  'zomato': 'zomato.com',
  'apple music': 'apple.com',
  'icloud': 'apple.com',
};

// Fallback to local icons if they already exist in constants/icons
const LOCAL_ICONS: Record<string, any> = {
  spotify: icons.spotify,
  github: icons.github,
  notion: icons.notion,
  figma: icons.figma,
  adobe: icons.adobe,
  canva: icons.canva,
  claude: icons.claude,
  dropbox: icons.dropbox,
  openai: icons.openai,
};

export function resolveSubscriptionIcon(name: string, customIcon?: any) {
  // If customIcon is provided but it's just the default "+" placeholder, ignore it
  if (customIcon && typeof customIcon === 'number' && customIcon !== icons.plus) {
    return customIcon;
  }

  const clean = name.trim().toLowerCase();

  // 1. Check local branded assets (spotify, notion, figma, etc.)
  const localMatch = Object.keys(LOCAL_ICONS).find((k) => clean.includes(k));
  if (localMatch) return LOCAL_ICONS[localMatch];

  // 2. Resolve domain
  const domain = DOMAIN_OVERRIDES[clean] || `${clean.replace(/[^a-z0-9]/g, '')}.com`;

  // 3. Return high-res favicon from Google Favicons CDN
  return { uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}