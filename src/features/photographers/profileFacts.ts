/**
 * What the photographer profile header may say, from the API's own fields.
 *
 * The old header drew a rating of "5.0" for a photographer with no rating, "0 Events" and "Since May 2026" for
 * everyone, "AVAILABLE" whatever the status, and "Unknown" for a missing location. Each of those was an invented
 * fact. Here a fact that is not in the data is simply absent.
 */
export type ProfileFacts = {
  /** "4.8", or null when the API has no rating. */
  rating: string | null;
  reviews: number;
  /** Completed shoots, only when there is at least one. */
  shoots: number | null;
  booked: boolean;
};

export function profileFacts(p: { rating?: number; reviewCount?: number; completedJobs?: number; currentStatus?: string }): ProfileFacts {
  const rating = typeof p.rating === 'number' && Number.isFinite(p.rating) && p.rating > 0 ? p.rating.toFixed(1) : null;
  const shoots = typeof p.completedJobs === 'number' && p.completedJobs > 0 ? p.completedJobs : null;
  return { rating, reviews: Math.max(0, p.reviewCount ?? 0), shoots, booked: (p.currentStatus ?? '').toLowerCase() === 'booked' };
}

/** Work images for the Portfolio tab: the photographer's images without their own profile picture, no repeats. */
export function portfolioImages(p: { images?: string[]; avatar?: string }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of p.images ?? []) {
    if (!u || u === p.avatar || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
