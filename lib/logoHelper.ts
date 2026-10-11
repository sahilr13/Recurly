const DOMAIN_MAP: Record<string, string> = {
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  'youtube premium': 'youtube.com',
  youtube: 'youtube.com',
  'amazon prime': 'primevideo.com',
  prime: 'primevideo.com',
  hotstar: 'hotstar.com',
  'jio hotstar': 'hotstar.com',
  jiohotstar: 'hotstar.com',
  chatgpt: 'openai.com',
  openai: 'openai.com',
  claude: 'anthropic.com',
  anthropic: 'anthropic.com',
  github: 'github.com',
  figma: 'figma.com',
  adobe: 'adobe.com',
  notion: 'notion.so',
  apple: 'apple.com',
  'google one': 'google.com',
  google: 'google.com',
};

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function resolveSubscriptionIcon(name: string, customIcon?: any): { uri: string } | number | null {
  if (customIcon) {
    if (typeof customIcon === 'number') return customIcon;
    if (typeof customIcon === 'string') return { uri: customIcon };
    if (customIcon.uri) return customIcon;
  }

  const clean = name.toLowerCase().trim();
  const matchedKey = Object.keys(DOMAIN_MAP).find((k) => clean.includes(k));
  const domain = matchedKey ? DOMAIN_MAP[matchedKey] : `${clean.replace(/[^a-z0-9]/g, '')}.com`;

  // Uses Google's high-resolution favicon CDN (reliable and free)
  return {
    uri: `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
  };
}