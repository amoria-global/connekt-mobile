/**
 * The flag of a currency, drawn from bundled artwork. Decorative: the code next to it names the currency, so it is hidden
 * from screen readers. Renders nothing for a currency with no flag.
 */
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { flagCountryFor } from './flagCountry';
import { FLAG_SVG } from '@/theme/flags/flagSvgs';

export function CurrencyFlag({ code, width = 22 }: { code: string | null | undefined; width?: number }) {
  const country = flagCountryFor(code);
  const xml = country ? FLAG_SVG[country] : undefined;
  if (!xml) return null;
  const height = Math.round((width * 2) / 3);
  return (
    <View style={[styles.frame, { width, height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  frame: { borderRadius: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(128,128,128,0.45)' },
});

/** The flag followed by the code, for a chip or a segment. `textStyle` is the chip's own text style. */
export function CurrencyLabel({ code, textStyle, width = 18 }: { code: string; textStyle?: StyleProp<TextStyle>; width?: number }) {
  return (
    <View style={styles.label}>
      <CurrencyFlag code={code} width={width} />
      <Text style={textStyle}>{code}</Text>
    </View>
  );
}
