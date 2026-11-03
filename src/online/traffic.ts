// Site analytics shown to staff (server/analytics.ts, src/ui/AdminTraffic.tsx). No cookies and
// no addresses kept: a page view records the page's kind, a visitor is a hash that changes
// every day, and the country and city come from Cloudflare. Pure.

/** The ranges the admin page offers, in days. */
export const TRAFFIC_RANGES = [1, 7, 30] as const;
export type TrafficRange = (typeof TRAFFIC_RANGES)[number];

/** The site's pages (src/ui/Toolbar.tsx Page, without the staff and loading ones): only these are counted. */
export const PAGE_KINDS: ReadonlySet<string> = new Set([
  'home',
  'game',
  'analysis',
  'online',
  'review',
  'signup',
  'profile',
  'puzzles',
  'daily',
  'rush',
  'tv',
  'gangs',
  'tournaments',
  'leaderboard',
  'privacy',
  'terms',
  'licenses',
  'contact',
  'character',
  'store',
  'barber',
  'wardrobe',
]);

/** A page kind as sent by the browser: one of the site's pages. */
export const isPageKind = (s: unknown): s is string => typeof s === 'string' && PAGE_KINDS.has(s);

/** Most page views kept in a day (all visitors): past it, more are not written. */
export const DAILY_VIEW_CAP = 50_000;

/** Largest request body the analytics and error endpoints read (bytes). */
export const MAX_BEACON_BYTES = 4096;

/** Crawlers and link previews: not visitors. */
export const isBot = (userAgent: string): boolean =>
  !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp/i.test(userAgent);

/** A browser's kind of device, from its user agent. */
export const deviceOf = (userAgent: string): 'phone' | 'tablet' | 'desktop' =>
  /ipad|tablet/i.test(userAgent) ? 'tablet' : /mobi|iphone|android/i.test(userAgent) ? 'phone' : 'desktop';

/** A count by name (a page, a country, a city…). */
export interface Count {
  readonly name: string;
  readonly n: number;
}

/** What GET /api/admin/traffic answers. Hours are Turkey's (UTC+3). */
export interface TrafficStats {
  readonly days: number;
  /** On the site in the last 5 minutes, and games being played, now. */
  readonly now: { readonly online: number; readonly games: number };
  readonly views: number;
  /** Visitors summed by day (a visitor is only known within a day). */
  readonly visitors: number;
  readonly peakOnline: number;
  readonly peakGames: number;
  /** Page views and finished games by hour of day (24 entries). */
  readonly viewsByHour: readonly number[];
  readonly gamesByHour: readonly number[];
  readonly daily: readonly { readonly day: string; readonly views: number; readonly visitors: number }[];
  /** Every 5 minutes (a day) or the hour's highest (longer ranges). */
  readonly live: readonly { readonly at: number; readonly online: number; readonly games: number }[];
  readonly pages: readonly Count[];
  readonly countries: readonly Count[];
  readonly cities: readonly Count[];
  readonly devices: readonly Count[];
  readonly referrers: readonly Count[];
}
