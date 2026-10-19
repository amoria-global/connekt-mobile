/**
 * The photographer's public profile link, resolved the way the web does.
 *
 * The landing serves `/photographers/{slug}`; the slug lives on the customer
 * record and is read from the public `GET /public/seo/slug-for?type=photographer&id=`
 * (SeoLookupController, the same lookup the landing's middleware uses). No slug,
 * or a failed lookup, falls back to the site home page: a real URL, never a made-up
 * profile route.
 */
import { api } from '@/api/client';
import { env } from '@/config/env';

export async function photographerProfileUrl(photographerId: string | undefined | null): Promise<string> {
  const site = env.webBaseUrl.replace(/\/+$/, '');
  if (!photographerId) return site;
  try {
    const res = await api.get<{ slug?: unknown }>(
      `/public/seo/slug-for?type=photographer&id=${encodeURIComponent(photographerId)}`,
      { skipAuth: true },
    );
    const slug = typeof res?.slug === 'string' ? res.slug.trim() : '';
    return slug ? `${site}/photographers/${encodeURIComponent(slug)}` : site;
  } catch {
    return site;
  }
}
