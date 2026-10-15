/**
 * Safe wrapper around expo-audio to prevent crashes when running in environments
 * (like older development builds, Expo Go, or test runners) where the native
 * ExpoAudio module is not linked in the binary.
 */
import type { AudioPlayer, AudioSource } from 'expo-audio';

let AudioModule: typeof import('expo-audio') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AudioModule = require('expo-audio');
} catch {
  AudioModule = null;
}

export type { AudioPlayer } from 'expo-audio';

export async function setAudioModeAsync(mode: {
  playsInSilentMode?: boolean;
  interruptionMode?: string;
  [key: string]: any;
}): Promise<void> {
  try {
    if (AudioModule?.setAudioModeAsync) {
      await AudioModule.setAudioModeAsync(mode as any);
    }
  } catch {
    // Non-fatal if native module is unavailable
  }
}

export function createAudioPlayer(source?: AudioSource | number | any): AudioPlayer {
  try {
    if (AudioModule?.createAudioPlayer) {
      return AudioModule.createAudioPlayer(source);
    }
  } catch {
    // Non-fatal fallback
  }

  const dummyPlayer: any = {
    play: () => {},
    pause: () => {},
    remove: () => {},
    seekTo: async () => {},
    replace: async () => {},
    loop: false,
    volume: 1,
    muted: false,
    currentTime: 0,
    duration: 0,
    playing: false,
    isLoaded: false,
    addListener: () => ({ remove: () => {} }),
    removeListener: () => {},
  };
  return dummyPlayer as AudioPlayer;
}
