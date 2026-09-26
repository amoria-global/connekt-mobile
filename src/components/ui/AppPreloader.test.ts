import {
  AppPreloader,
  PRELOADER_TRACK_WIDTH,
  PRELOADER_BAR_WIDTH,
  configurePreloaderPlayer,
} from './AppPreloader';

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn((source, setup) => {
    const player = {
      play: jest.fn(),
      pause: jest.fn(),
      loop: false,
      muted: false,
      audioMixingMode: 'auto',
    };
    setup?.(player);
    return player;
  }),
  VideoView: 'VideoView',
}));

describe('AppPreloader', () => {
  it('exports valid preloader progress bar track dimensions', () => {
    expect(PRELOADER_TRACK_WIDTH).toBeGreaterThan(0);
    expect(PRELOADER_BAR_WIDTH).toBeGreaterThan(0);
    expect(PRELOADER_BAR_WIDTH).toBeLessThan(PRELOADER_TRACK_WIDTH);
    // Indicator is ~1/3 of the total track for a balanced indeterminate pill
    expect(PRELOADER_BAR_WIDTH / PRELOADER_TRACK_WIDTH).toBeCloseTo(0.33, 1);
  });

  it('is a defined component function', () => {
    expect(typeof AppPreloader).toBe('function');
  });

  it('configures video player to mix with others and mute so background music never pauses', () => {
    const mockPlayer = {
      loop: false,
      muted: false,
      audioMixingMode: 'auto',
      play: jest.fn(),
    };

    configurePreloaderPlayer(mockPlayer);

    expect(mockPlayer.loop).toBe(true);
    expect(mockPlayer.muted).toBe(true);
    // Crucial for iOS AVAudioSession and Android AudioManager:
    expect(mockPlayer.audioMixingMode).toBe('mixWithOthers');
    expect(mockPlayer.play).toHaveBeenCalled();
  });
});

