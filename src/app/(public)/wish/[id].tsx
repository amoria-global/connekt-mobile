/**
 * The wish page a shared link or QR opens (connekt://wish/<id>, and https://connekyt.com/wish/<id> on the web with the
 * same layout): the event's cover, date and title, an optional "<Name> invited you" line, then the wish form. Wishes go
 * through the same endpoint and host approval as the ones sent from the event page. A finished, cancelled or unpublished
 * event shows the closed message instead of the form.
 */
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import { eventWhen } from '@/features/events/eventWhen';
import { WishForm } from '@/features/wishes/WishForm';
import { invitedByLine, wishesOpen, wishLink } from '@/features/wishes/wishPage';
import { useAsync } from '@/hooks/useAsync';
import { fontSize, fontWeight, makeStyles, onFill, radii, spacing, useTheme } from '@/theme';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';

export default function WishPageScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { data, loading, error } = useAsync(useCallback(() => getPublicEventDetailed(id), [id]));

  const back = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
      hitSlop={10}
      style={[styles.back, { top: insets.top + 8 }]}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={22} color={onFill} />
    </Pressable>
  );

  if (loading) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // An unpublished event answers "not available": nothing about it is shown, only that wishes cannot be sent.
  if (error || !data) {
    return (
      <Screen padded={false} edges={[]}>
        {back}
        <View style={styles.center}>
          <Ionicons name="heart-dislike-outline" size={28} color={colors.textMuted} />
          <Text style={styles.closedTitle}>Wishes for this event are closed</Text>
          <Text style={styles.sub}>This event is not available right now.</Text>
        </View>
      </Screen>
    );
  }

  const open = wishesOpen(data);
  const when = eventWhen(data);
  const invited = invitedByLine(from);
  const chip = [when.date.toUpperCase(), when.time.split(' · ')[0]].filter(Boolean).join(' · ');

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.hero}>
          <Image source={data.eventPhoto ? { uri: data.eventPhoto } : EVENT_COVER_PLACEHOLDER} style={styles.cover} contentFit="cover" transition={250} accessibilityLabel={`Cover image for ${data.title}`} />
          <LinearGradient colors={['transparent', 'rgba(8,16,32,0.92)']} style={styles.scrim} />
          {back}
          <View style={styles.heroText}>
            {chip ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ) : null}
            <Text style={styles.title} accessibilityRole="header">
              {data.title}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {open ? (
            <>
              {invited ? (
                <View style={styles.invited}>
                  <Ionicons name="heart" size={16} color={colors.accent} />
                  <Text style={styles.invitedText}>{invited}</Text>
                </View>
              ) : null}
              <Text style={styles.sub}>Your message will appear on screen during the event, so you can be part of it from wherever you are.</Text>
              <WishForm eventId={id} variant="page" />
            </>
          ) : (
            <View style={styles.closed}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} />
              <Text style={styles.closedTitle}>Wishes for this event are closed</Text>
            </View>
          )}
          <View style={styles.links}>
            <Pressable onPress={() => router.push(`/(public)/event/${id}` as unknown as Href)} hitSlop={12} style={styles.link} accessibilityRole="link" accessibilityLabel="View event">
              <Text style={styles.linkText}>View event →</Text>
            </Pressable>
            {open ? (
              <Pressable
                onPress={() => void Share.share({ title: data.title, message: `Send a wish for "${data.title}":\n${wishLink(id)}` }).catch(() => undefined)}
                hitSlop={12}
                style={styles.link}
                accessibilityRole="button"
                accessibilityLabel="Invite someone else"
              >
                <Text style={styles.mutedLinkText}>Invite someone else</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    scroll: { paddingBottom: 96 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
    hero: { height: 300, justifyContent: 'flex-end' },
    cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    back: { position: 'absolute', left: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    heroText: { padding: spacing.lg, gap: spacing.sm },
    chip: { alignSelf: 'flex-start', backgroundColor: c.primary, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { color: onFill, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 0.4 },
    title: { color: onFill, fontSize: 26, fontWeight: fontWeight.bold },
    body: { padding: spacing.lg, gap: spacing.md },
    invited: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface, padding: spacing.md },
    invitedText: { flex: 1, color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    sub: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
    closed: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    closedTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center' },
    links: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    link: { minHeight: 44, justifyContent: 'center' },
    linkText: { color: c.link, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    mutedLinkText: { color: c.textMuted, fontSize: fontSize.sm },
  }),
);
