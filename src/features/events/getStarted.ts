/**
 * The "Get started with Events" sheet: which shortcuts a role can use, and when the sheet opens by itself.
 *
 * It opens on entering Events, at most once per app session, only while the user has nothing yet and has not ticked
 * "Don't show this again". That tick is saved to the account (preference `events.getStarted.dismissed`, so it holds on
 * every device) and cached on the device. Closing any other way hides it for this session only.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { Role } from '@/features/auth/role';
import type { ChipTone } from '@/components/ui/StatusChip';

export const GET_STARTED_PREF_KEY = 'events.getStarted.dismissed';

export type GetStartedKey = 'create-event' | 'go-live' | 'new-album' | 'photobook';
export type GetStartedAction = { key: GetStartedKey; title: string; body: string; icon: keyof typeof Ionicons.glyphMap; tone: ChipTone };

const ALL: Record<GetStartedKey, GetStartedAction> = {
  'create-event': { key: 'create-event', title: 'Create event', body: 'Book a photographer for your event', icon: 'calendar-outline', tone: 'primary' },
  'go-live': { key: 'go-live', title: 'Go live', body: 'Host and stream an event yourself', icon: 'radio-outline', tone: 'live' },
  'new-album': { key: 'new-album', title: 'New album', body: 'Upload, share or sell photos', icon: 'images-outline', tone: 'active' },
  photobook: { key: 'photobook', title: 'Photobook', body: 'Design a printed book', icon: 'book-outline', tone: 'accent' },
};

/**
 * What each role can start. A photographer's "create event" is hosting one (the event screen sends them to /host/new),
 * so they get Go live. A workspace collaborator gets nothing: the server decides what they may do.
 */
export function getStartedActions(role: Role | undefined, collaborator = false): GetStartedAction[] {
  if (collaborator) return [];
  switch (role) {
    case 'Client':
      return [ALL['create-event']];
    case 'Coordinator':
      return [ALL['create-event'], ALL.photobook];
    case 'Photographer':
      return [ALL['go-live'], ALL['new-album'], ALL.photobook];
    default:
      return [];
  }
}

/** The label of the floating create button for each section tab. */
export const CREATE_LABEL = { events: 'Create event', albums: 'New album', photobooks: 'New photobook', content: 'New post' } as const;

/** Whether the sheet should open by itself now. */
export function shouldAutoOpen(s: { actions: number; listLoaded: boolean; hasItems: boolean; dismissed: boolean | null; shownThisSession: boolean }): boolean {
  return s.actions > 0 && s.listLoaded && !s.hasItems && s.dismissed === false && !s.shownThisSession;
}

/** App-session state: the sheet has been shown once. A cold start resets it. */
export const session = { shown: false };
