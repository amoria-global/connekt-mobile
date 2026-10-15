import { darkPalette, lightPalette } from '@/theme/palettes';
import { chipColors } from './statusChip';

/** Found in the dark-mode review: the received-photobook chips were cream and light-blue pills on a navy screen. */
describe('photobook status chip colours', () => {
  const pastel = { bg: '#FEF3C7', fg: '#92400E' };

  it('leaves light mode exactly as it was', () => {
    expect(chipColors(pastel, false, lightPalette)).toEqual(pastel);
  });

  it('swaps the pastel pills for tinted grounds in dark, one hue per meaning', () => {
    expect(chipColors(pastel, true, darkPalette)).toEqual({ bg: darkPalette.warningBg, fg: darkPalette.warning });
    expect(chipColors({ bg: '#DBEAFE', fg: '#1D4ED8' }, true, darkPalette)).toEqual({ bg: darkPalette.infoBg, fg: darkPalette.info });
    expect(chipColors({ bg: '#D1FAE5', fg: '#047857' }, true, darkPalette)).toEqual({ bg: darkPalette.successBg, fg: darkPalette.success });
    expect(chipColors({ bg: '#E5E7EB', fg: '#374151' }, true, darkPalette)).toEqual({ bg: darkPalette.surfaceMuted, fg: darkPalette.textSoft });
  });

  it('keeps an unknown status on its own scrim and white text', () => {
    const unknown = { bg: 'rgba(0,0,0,0.55)', fg: '#fff' };
    expect(chipColors(unknown, true, darkPalette)).toEqual(unknown);
  });
});
