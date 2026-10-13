// Store and event types and helpers. The stores and events themselves are edited in EmDash
// (see src/lib/content.ts).

export interface Store {
  name: string;
  /** Which branch, e.g. "Liberty" */
  branch?: string;
  street: string;
  city: string;
  /** Brand colour used for the text wordmark */
  color?: string;
}

export interface MarketEvent {
  name: string;
  /** Local date, YYYY-MM-DD */
  date: string;
  town: string;
  start?: string;
  end?: string;
}

export const storeMapsUrl = (s: Store) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name}, ${s.street}, ${s.city}`)}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const eventParts = (e: MarketEvent) => {
  const [, m, d] = e.date.split('-').map(Number);
  return { month: MONTHS[m - 1], day: d };
};

export const mapsUrl = (e: MarketEvent) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.name}, ${e.town}`)}`;

/** Today's date (YYYY-MM-DD) where the business is. */
export const localToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);

/** Events from today on, soonest first. */
export const upcoming = (list: MarketEvent[], today = localToday()) =>
  [...list].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
