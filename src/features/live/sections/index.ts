/**
 * The live event page, one component per numbered section (see docs/LIVE_EVENT_STRUCTURE.md). The web app builds the
 * same sections under the same names and props in lib/live/sections.
 *
 *  1 EventHeader   2 LivePlayer   3 EventInfo   4 EventTabs   5 SendWishes   6 InviteOthers
 *  7 PrivacyNote   8 WishesFeed (viewer) / ModerationQueue (host)   9 LiveChat   10 the app's bottom tab bar
 */
export { EventHeader } from './EventHeader';
export { AccessChip, LivePlayer, LiveScrubber, accessLabel, type EventAccess } from './LivePlayer';
export { EventInfo } from './EventInfo';
export { EventTabs, type LiveTab } from './EventTabs';
export { SendWishes } from './SendWishes';
export { InviteOthers } from './InviteOthers';
export { PrivacyNote, PRIVACY_NOTE_TEXT } from './PrivacyNote';
export { WishesFeed, type FeedState } from './WishesFeed';
export { ModerationQueue } from './ModerationQueue';
export { WishesPanel } from './WishesPanel';
export { LiveChat } from '@/features/streams/viewer/components/LiveChat';
