import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { env } from '@/config/env';

import { alpha, makeStyles, radii, useTheme } from '@/theme';
import { buildAreaPreviewHtml } from './areaPreviewHtml';
import { Ionicons } from '@expo/vector-icons';

/**
 * A small map of the chosen area with a dashed circle of about 1 km, labelled "Clients see this approximate area".
 *
 * It is drawn only when real map tiles have loaded. With no tiles key, no network or the provider refusing the request it
 * renders nothing at all: no spinner left behind and no error, because the area card and the privacy note under it already say
 * everything the screen needs to.
 */
export function AreaPreview({ lat, lng }: { lat: number | null; lng: number | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const html = useMemo(
    () =>
      lat == null || lng == null
        ? null
        : buildAreaPreviewHtml({
            lat,
            lng,
            key: env.cartoKey,
            colors: {
              background: colors.surface,
              circle: colors.link,
              circleFill: colors.primary,
              centre: colors.primaryLight,
              attribution: colors.textSoft,
              attributionBg: alpha(colors.background, 0.72),
            },
          }),
    [lat, lng, colors],
  );

  if (!html || state === 'failed') return null;

  const onMessage = (e: WebViewMessageEvent) => {
    const m = e.nativeEvent.data;
    if (m === 'ready') setState('ready');
    else if (m === 'failed') setState('failed');
  };

  return (
    <View style={styles.frame} accessibilityLabel="Map of your service area, approximate" testID="area-preview">
      {/* baseUrl gives the page an origin on our own domain, which is what CARTO's domain restriction checks. */}
      <WebView
        source={{ html, baseUrl: env.webBaseUrl }}
        style={[styles.web, state !== 'ready' && styles.hidden]}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={onMessage}
        onError={() => setState('failed')}
        onHttpError={() => setState('failed')}
      />
      {state === 'ready' ? (
        <View style={styles.chip} pointerEvents="none">
          <Ionicons name="eye-outline" size={14} color={colors.textSoft} />
          <Text style={styles.chipText}>Approximate area · about 1 km</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  frame: { height: 176, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.surface },
  web: { flex: 1, backgroundColor: 'transparent' },
  hidden: { opacity: 0 },
  chip: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: c.glassSolid,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  chipText: { color: c.textSoft, fontSize: 11 },
}));
