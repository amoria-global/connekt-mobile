import { View } from 'react-native';
/**
 * The icon at the top of the update screen: an arrow coming down into a tray, the arrow fading from mint at its tail to
 * cyan at its head, the tray in the screen's blue, a soft glow behind both. Drawn with react-native-svg so it stays
 * sharp at any size and needs no image file. It replaces the sparkles and cloud icons the screen used before.
 *
 * It is decoration: the screen's title and text say what is happening, so a screen reader skips it.
 */
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export const UPDATE_GLYPH_COLORS = {
  tray: ['#2F7BFF', '#0B5BFF'],
  arrow: ['#A6F7D2', '#2BD9F0'],
  glow: '#0B5BFF',
} as const;

// One drawing, painted twice: wide and faint for the glow, then narrow and bright for the line. The gradients use fixed
// coordinates because a straight vertical line has no width, and a gradient measured against it would paint nothing.
const SHAFT = 'M32 9 V35';
const HEAD = 'M24.5 28 L32 35.5 L39.5 28';
const TRAY = 'M12 36 V42 A7 7 0 0 0 19 49 H45 A7 7 0 0 0 52 42 V36';

export function UpdateGlyph({ size = 72 }: { size?: number }) {
  return (
    // Hidden from screen readers on a View: react-native-svg passes these props to the DOM on web, where they are invalid.
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      testID="update-glyph"
    >
      <Defs>
        <RadialGradient id="ug-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={UPDATE_GLYPH_COLORS.glow} stopOpacity={0.45} />
          <Stop offset="1" stopColor={UPDATE_GLYPH_COLORS.glow} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="ug-arrow" gradientUnits="userSpaceOnUse" x1="0" y1="9" x2="0" y2="36">
          <Stop offset="0" stopColor={UPDATE_GLYPH_COLORS.arrow[0]} />
          <Stop offset="1" stopColor={UPDATE_GLYPH_COLORS.arrow[1]} />
        </LinearGradient>
        <LinearGradient id="ug-tray" gradientUnits="userSpaceOnUse" x1="0" y1="36" x2="0" y2="49">
          <Stop offset="0" stopColor={UPDATE_GLYPH_COLORS.tray[0]} />
          <Stop offset="1" stopColor={UPDATE_GLYPH_COLORS.tray[1]} />
        </LinearGradient>
      </Defs>

      <Circle cx="32" cy="32" r="31" fill="url(#ug-glow)" />

      {/* Glow */}
      <Path d={TRAY} stroke="url(#ug-tray)" strokeWidth={9} strokeOpacity={0.16} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={SHAFT} stroke="url(#ug-arrow)" strokeWidth={9} strokeOpacity={0.16} strokeLinecap="round" fill="none" />
      <Path d={HEAD} stroke="url(#ug-arrow)" strokeWidth={9} strokeOpacity={0.16} strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Line */}
      <Path d={TRAY} stroke="url(#ug-tray)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={SHAFT} stroke="url(#ug-arrow)" strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <Path d={HEAD} stroke="url(#ug-arrow)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
    </View>
  );
}
