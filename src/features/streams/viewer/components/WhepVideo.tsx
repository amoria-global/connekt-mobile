import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildWhepHtml, parseWhepMessage, type WhepStatus } from '../whep';

import { onMedia } from '@/theme';
export type WhepHandle = {
  setMuted: (muted: boolean) => void;
  setPlaying: (playing: boolean) => void;
};

type Props = {
  url: string;
  onStatus: (status: WhepStatus) => void;
};

/**
 * WebRTC (WHEP) viewer, the same feed path the website uses. Runs the web's
 * WHEPClient logic inside a WebView because React Native has no WebRTC engine.
 * The page reconnects on its own and never gives up; this component only
 * reports its status and forwards mute and play.
 */
export const WhepVideo = memo(
  forwardRef<WhepHandle, Props>(function WhepVideo({ url, onStatus }, ref) {
    const webRef = useRef<WebView>(null);
    const html = useMemo(() => buildWhepHtml(url), [url]);
    // Stable source object so parent re-renders never look like a source change.
    const source = useMemo(() => ({ html, baseUrl: 'https://connekyt.com' }), [html]);

    useImperativeHandle(
      ref,
      () => {
        const run = (js: string) =>
          webRef.current?.injectJavaScript(`(function(){try{${js}}catch(e){}})();true;`);
        return {
          setMuted: (m) => run(`window.__whep&&window.__whep.setMuted(${m ? 'true' : 'false'});`),
          setPlaying: (p) => run(`window.__whep&&window.__whep.setPlaying(${p ? 'true' : 'false'});`),
        };
      },
      [],
    );

    const onMessage = (e: WebViewMessageEvent) => {
      const msg = parseWhepMessage(e.nativeEvent.data);
      if (msg) onStatus(msg.s);
    };

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WebView
          key={url}
          ref={webRef}
          source={source}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          style={styles.web}
          onMessage={onMessage}
        />
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: onMedia.black },
});
