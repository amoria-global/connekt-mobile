import { View } from 'react-native';
/**
 * The Help button's icon: a filled speech bubble with three dots and an outlined bubble behind it, both in the same
 * cyan-to-blue gradient. Drawn with react-native-svg so it stays sharp at any size and needs no image file. Decoration
 * only: the button around it carries the accessible name.
 */
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export const HELP_GLYPH_COLORS = { from: '#00E5FF', to: '#0A22FF' } as const;

// Drawn on a 512 grid, like the artwork it follows.
const BUBBLE =
  'M62 32 H366 A40 40 0 0 1 406 72 V312 A40 40 0 0 1 366 352 H214 L136 422 Q118 436 118 414 V352 H62 A40 40 0 0 1 22 312 V72 A40 40 0 0 1 62 32 Z';
const OUTLINE =
  'M436 236 H446 A32 32 0 0 1 478 268 V386 A32 32 0 0 1 446 418 H430 V458 L376 408 H284 A32 32 0 0 1 252 376 V374';

export function HelpGlyph({ size = 30 }: { size?: number }) {
  return (
    // Hidden from screen readers on a View: react-native-svg passes these props to the DOM on web, where they are invalid.
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 512 512" testID="help-glyph">
      <Defs>
        <LinearGradient id="hg" gradientUnits="userSpaceOnUse" x1="22" y1="32" x2="480" y2="470">
          <Stop offset="0" stopColor={HELP_GLYPH_COLORS.from} />
          <Stop offset="1" stopColor={HELP_GLYPH_COLORS.to} />
        </LinearGradient>
      </Defs>
      <Path d={OUTLINE} stroke="url(#hg)" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={BUBBLE} fill="url(#hg)" />
      <Circle cx="106" cy="182" r="32" fill="#FFFFFF" />
      <Circle cx="213" cy="182" r="32" fill="#FFFFFF" />
      <Circle cx="320" cy="182" r="32" fill="#FFFFFF" />
    </Svg>
    </View>
  );
}
