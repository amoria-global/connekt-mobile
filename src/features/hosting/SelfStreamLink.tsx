/** "Want to stream it yourself? Go live": the short way from the create event wizard into the Go live flow. */
import { StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { fonts, useTheme } from '@/theme';

export function SelfStreamLink() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Text style={[styles.line, { color: colors.textMuted }]}>
      Want to stream it yourself?{' '}
      <Text
        accessibilityRole="link"
        accessibilityLabel="Go live. Host your own event"
        onPress={() => router.push('/host/new' as Href)}
        style={[styles.link, { color: colors.primary }]}
      >
        Go live
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 13, lineHeight: 20, marginTop: 4, marginBottom: 12 },
  link: { fontFamily: fonts.semibold },
});
