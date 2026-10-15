import type { Ionicons } from '@expo/vector-icons';

/** UI-facing playback phase, derived from the existing player + stream data. */
export type PlaybackPhase =
  | 'waiting' // stream not started yet
  | 'connecting'
  | 'playing'
  | 'buffering'
  | 'reconnecting'
  | 'error'
  | 'ended';

/** Chat transport health (the existing chat endpoint is polled). */
export type ChatConnection = 'connecting' | 'connected' | 'reconnecting' | 'unavailable';

export type ChatMode = 'all' | 'gifts';

export type IconName = keyof typeof Ionicons.glyphMap;

/** Presentation model adapted from the existing `StreamDetail` API shape. */
export type ViewerModel = {
  routeId: string;
  eventId: string;
  title: string;
  creatorName: string;
  creatorInitial: string;
  isLive: boolean;
  viewerCount: number | null;
};

export type ReactionDef = {
  /** Sent unchanged as the existing `emoji` field of the reaction API. */
  key: string;
  icon: IconName;
  color: string;
  label: string;
};

/** Viewer UI state, purely presentational, never mirrors backend state. */
export type LiveViewerUIState = {
  controlsVisible: boolean;
  chatOpen: boolean;
  fullscreen: boolean;
  showShareSheet: boolean;
  showOptions: boolean;
};

export type ReplyTarget = { id: string; sender: string; text?: string };
