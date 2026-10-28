/**
 * Who hosts the event, as the rows of one "Hosted by" card. The organizer and the photographer are one row with two role
 * chips when they are the same user, compared by id (never by name, since two people can share one). Without an id on
 * both sides they are treated as different people.
 */
import type { PublicEvent } from './types';

export type HostRole = 'ORGANIZER' | 'PHOTOGRAPHER';
export type HostRow = { key: string; name: string; image?: string; roles: HostRole[]; photographerId?: string };

export function hostRows(e: Pick<PublicEvent, 'creator' | 'eventOrganizer' | 'photographerId' | 'photographerName' | 'photographerImage'>): HostRow[] {
  const creatorName = e.creator ? `${e.creator.firstName ?? ''} ${e.creator.lastName ?? ''}`.trim() : '';
  const organizerName = creatorName || e.eventOrganizer || '';
  const photographerName = e.photographerName || '';
  const hasPhotographer = !!(photographerName || e.photographerId);
  const sameUser = !!e.creator?.id && !!e.photographerId && e.creator.id === e.photographerId;

  if (sameUser) {
    return [{ key: 'host', name: organizerName || photographerName, image: e.creator?.profilePicture || e.photographerImage, roles: ['ORGANIZER', 'PHOTOGRAPHER'], photographerId: e.photographerId }];
  }
  const rows: HostRow[] = [];
  if (organizerName) rows.push({ key: 'organizer', name: organizerName, image: e.creator?.profilePicture, roles: ['ORGANIZER'] });
  if (hasPhotographer) rows.push({ key: 'photographer', name: photographerName || 'Photographer', image: e.photographerImage, roles: ['PHOTOGRAPHER'], photographerId: e.photographerId });
  return rows;
}
