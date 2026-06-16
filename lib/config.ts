import type { Brand, BrandKey } from '@/types'

// ─── Email Recipients ─────────────────────────────────────────────────────────
// Edit this list to add / remove digest recipients
export const DIGEST_RECIPIENTS: string[] = [
  'social@pernodricard-me.com',
  'marketing@pernodricard-me.com',
  // Add more recipients here
]

// ─── Brands ──────────────────────────────────────────────────────────────────
export const BRANDS: Brand[] = [
  {
    key: 'chivas',
    name: 'Chivas Regal',
    color: '#F5A623',
    scoreField: 'chivas_score',
  },
  {
    key: 'absolut',
    name: 'Absolut Vodka',
    color: '#8A94A6',
    scoreField: 'absolut_score',
  },
  {
    key: 'jameson',
    name: 'Jameson',
    color: '#4CAF72',
    scoreField: 'jameson_score',
  },
  {
    key: 'glenlivet',
    name: 'The Glenlivet',
    color: '#2E7D52',
    scoreField: 'glenlivet_score',
  },
]

export const BRAND_MAP: Record<BrandKey, Brand> = Object.fromEntries(
  BRANDS.map((b) => [b.key, b])
) as Record<BrandKey, Brand>

// ─── Apify Keyword Clusters ───────────────────────────────────────────────────
export const KEYWORD_CLUSTERS: Record<string, string[]> = {
  'Nightlife & Drinks': [
    'cocktails',
    'mixology',
    'bartender',
    'drinkstagram',
    'nightlife',
    'happyhour',
    'craftcocktails',
    'barlife',
  ],
  'MENA Region': [
    'dubai',
    'abudhabi',
    'riyadh',
    'doha',
    'gcc',
    'uae',
    'dubainightlife',
    'dubaibar',
  ],
  'Viral Signals': ['fyp', 'trending', 'viral', 'reels', 'explore'],
  'Brand Adjacent': [
    'whisky',
    'scotch',
    'vodka',
    'gin',
    'irishwhiskey',
    'premiumspirits',
    'travelretail',
  ],
}

// All keywords flattened
export const ALL_KEYWORDS = Object.values(KEYWORD_CLUSTERS).flat()

// ─── Apify Actor IDs ──────────────────────────────────────────────────────────
export const APIFY_ACTORS = {
  tiktokScraper: 'clockworks/tiktok-scraper',
  instagramHashtag: 'apify/instagram-hashtag-scraper',
  instagramReel: 'apify/instagram-reel-scraper',
} as const

// ─── App Settings ─────────────────────────────────────────────────────────────
export const APP_CONFIG = {
  appName: 'Trend Radar',
  fiscalYear: 'FY27',
  topTrendsPerDigest: 10,
  // Toggle brands off here if needed
  activeBrands: ['chivas', 'absolut', 'jameson', 'glenlivet'] as BrandKey[],
}
