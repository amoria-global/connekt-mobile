import { darkPalette, lightPalette } from '@/theme/palettes';
import { chipColors } from './statusChip';

/**
 * Found in the dark-mode review: the received-photobook chips were cream and light-blue pills on a navy screen.
 * Midnight Glass: a status names its tone and the palette gives the pair, so neither scheme carries a pastel hex.
 */
describe('photobook status chip colours', () => {
  it('gives each meaning its own tinted ground in dark, one hue per meaning', () => {
    expect(chipColors({ tone: 'pending' }, true, darkPalette)).toEqual({ bg: darkPalette.pendingBg, fg: darkPalette.pending });
    expect(chipColors({ tone: 'info' }, true, darkPalette)).toEqual({ bg: darkPalette.tint, fg: darkPalette.link });
    expect(chipColors({ tone: 'success' }, true, darkPalette)).toEqual({ bg: darkPalette.successBg, fg: darkPalette.success });
    expect(chipColors({ tone: 'neutral' }, true, darkPalette)).toEqual({ bg: darkPalette.surfaceMuted, fg: darkPalette.textSoft });
  });

  it('follows the light palette in light mode', () => {
    expect(chipColors({ tone: 'pending' }, false, lightPalette)).toEqual({ bg: lightPalette.pendingBg, fg: lightPalette.pending });
  });

  it('keeps an unknown status on its own scrim and white text', () => {
    const unknown = { bg: 'rgba(0,0,0,0.55)', fg: 'white' };
    expect(chipColors(unknown, true, darkPalette)).toEqual(unknown);
  });
});
