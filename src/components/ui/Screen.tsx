import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { spacing, makeStyles } from '@/theme';

/**
 * Maximum content width on large viewports (web / iPad). Beyond ~520 px
 * a single-column phone layout starts to look stretched: cards become
 * comically wide, action bars float around in the void, etc. Clamping
 * to ~520 px and centering keeps the layout phone-shaped where it
 * matters and uses the extra space on tablets / desktop browsers as
 * a comfortable gutter instead. The clamp only kicks in when the
 * device width clearly isn't a phone (≥ 600 px), so all phones —
 * even foldables in landscape — render edge-to-edge as before.
 */
const PHONE_LAYOUT_MAX_WIDTH = 520;

type Props = {
  children: ReactNode;
  /** Add default horizontal padding. Default true. */
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
};

export function Screen({ children, padded = true, edges = ['top', 'bottom'], style }: Props) {
  const styles = useStyles();
  const { isLarge, isXLarge } = useResponsive();
  const clampWidth = isLarge || isXLarge;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View
        style={[
          styles.content,
          clampWidth && styles.contentClamped,
          padded && styles.padded,
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  content: { flex: 1 },
  contentClamped: {
    width: '100%',
    maxWidth: PHONE_LAYOUT_MAX_WIDTH,
    alignSelf: 'center',
  },
  padded: { paddingHorizontal: spacing.xl },
}));
