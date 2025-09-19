import type { PrimetimeTag } from './primetime';

export type NetworkLogo = { src: string; alt: string };

type PrimetimeKey = 'SNF' | 'MNF' | 'TNF';

type LogoMap = Record<PrimetimeKey, NetworkLogo>;

type LabelMatcher = {
  pattern: RegExp;
  key: PrimetimeKey;
};

const PRIMETIME_LOGOS: LogoMap = {
  SNF: { src: '/logos/nbc.svg', alt: 'NBC' },
  MNF: { src: '/logos/espn.svg', alt: 'ESPN' },
  TNF: { src: '/logos/prime.svg', alt: 'Prime Video' },
};

const LABEL_MATCHERS: LabelMatcher[] = [
  { pattern: /\b(snf|sunday\s+night)\b/i, key: 'SNF' },
  { pattern: /\b(mnf|monday\s+night)\b/i, key: 'MNF' },
  { pattern: /\b(tnf|thursday\s+night)\b/i, key: 'TNF' },
];

const PRIME_NETWORK_MATCHERS = ['prime', 'amazon'];
const ESPN_NETWORK_MATCHERS = ['espn', 'abc'];
const NBC_NETWORK_MATCHERS = ['nbc', 'peacock'];

const weekdayIncludes = (weekday: string, target: string): boolean => {
  const lower = weekday.toLowerCase();
  return lower.includes(target);
};

const networkIncludes = (network: string, matchers: string[]): boolean => {
  const lower = network.toLowerCase();
  return matchers.some((candidate) => lower.includes(candidate));
};

export function getNetworkLogo(network = '', day = ''): NetworkLogo | null {
  if (!network || !day) return null;
  if (networkIncludes(network, NBC_NETWORK_MATCHERS) && weekdayIncludes(day, 'sunday')) {
    return PRIMETIME_LOGOS.SNF;
  }
  if (networkIncludes(network, ESPN_NETWORK_MATCHERS) && weekdayIncludes(day, 'monday')) {
    return PRIMETIME_LOGOS.MNF;
  }
  if (networkIncludes(network, PRIME_NETWORK_MATCHERS) && weekdayIncludes(day, 'thursday')) {
    return PRIMETIME_LOGOS.TNF;
  }
  return null;
}

export function getPrimetimeLogoFromTag(tag: PrimetimeTag | null): NetworkLogo | null {
  if (!tag) return null;
  const key = tag as PrimetimeKey;
  return PRIMETIME_LOGOS[key] ?? null;
}

export function getPrimetimeLogoFromLabel(label = ''): NetworkLogo | null {
  if (!label) return null;
  for (const matcher of LABEL_MATCHERS) {
    if (matcher.pattern.test(label)) {
      return PRIMETIME_LOGOS[matcher.key];
    }
  }
  return null;
}
