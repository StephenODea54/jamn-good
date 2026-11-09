// Customer reviews, saved to the EmDash "reviews" collection. A new review is a draft, so nothing
// shows on the site (or in Google) until it is published in the admin.
import { getEmDashCollection, handleContentCreate } from 'emdash';
import { getDb } from 'emdash/runtime';

const COLLECTION = 'reviews';

export const LIMITS = { name: 60, text: 2000 };

export interface Review {
  name: string;
  rating: number;
  text: string;
  /** ISO date-time it was submitted */
  date: string;
}

export interface ReviewSummary {
  /** Newest first */
  reviews: Review[];
  /** Average stars, set when there is at least one review */
  average?: number;
}

export interface NewReview {
  product: string;
  rating: number;
  name: string;
  text: string;
  email: string;
}

/**
 * Published reviews of one product. If they can't be read (say, the reviews collection hasn't been
 * added to this site yet), the product page shows no reviews instead of failing.
 */
export async function getReviews(product: string): Promise<ReviewSummary> {
  const { entries, error } = await getEmDashCollection(COLLECTION, {
    status: 'published',
    where: { product },
    orderBy: { submitted_at: 'desc' },
    limit: 200,
  });
  if (error) {
    console.error('[reviews]', error instanceof Error ? error.message : error);
    return { reviews: [] };
  }
  const reviews = entries
    .map((e) => e.data as Record<string, unknown>)
    .map((d) => ({
      name: String(d.name ?? ''),
      rating: Number(d.rating),
      text: String(d.text ?? ''),
      date: String(d.submitted_at ?? ''),
    }))
    .filter((r) => r.rating >= 1 && r.rating <= 5);
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : undefined;
  return { reviews, average };
}

/** Save a review as a draft for the shop to read and publish. */
export async function addReview(review: NewReview): Promise<void> {
  const db = await getDb();
  const result = await handleContentCreate(db, COLLECTION, {
    slug: `review-${crypto.randomUUID().slice(0, 18)}`,
    status: 'draft',
    data: { ...review, submitted_at: new Date().toISOString() },
  });
  if (!result.success) throw new Error(`Couldn't save review: ${result.error.code} ${result.error.message}`);
}
