import { useState } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { faceSearch, type FoundPhoto } from '@/features/photos/api';
import { pickFromLibrary, takeSelfie, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

/** Find My Photos (facial-recognition search). Works with or without login. */
export function FindMyPhotos() {
  const { width } = useWindowDimensions();
  const [selfie, setSelfie] = useState<PickedImage | null>(null);
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (fn: () => Promise<PickedImage | null>) => {
    const img = await fn();
    if (img) {
      setSelfie(img);
      setResults(null);
      setError(null);
    }
  };

  const onSearch = async () => {
    if (!selfie) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await faceSearch(selfie, code));
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const gap = spacing.md;
  const cell = (width - spacing.xl * 2 - gap) / 2;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Take a selfie or upload a photo and we&apos;ll find every photo you appear in across all
          events. Got an invite code? Add it to search a specific gallery.
        </Text>

        <View style={styles.selfieWrap}>
          {selfie ? (
            <Image source={{ uri: selfie.uri }} style={styles.selfie} contentFit="cover" />
          ) : (
            <View style={[styles.selfie, styles.selfiePlaceholder]}>
              <Ionicons name="person-outline" size={48} color={colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.pickRow}>
          <Button title="Take selfie" onPress={() => onPick(takeSelfie)} style={styles.pickBtn} />
          <Button
            title="Upload photo"
            variant="ghost"
            onPress={() => onPick(pickFromLibrary)}
            style={styles.pickBtn}
          />
        </View>

        <Input
          label="Invite code (optional)"
          placeholder="Enter an event/album code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />

        <Button
          title={searching ? 'Scanning…' : 'Find my photos'}
          onPress={onSearch}
          loading={searching}
          disabled={!selfie}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {searching ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Scanning event photos…</Text>
          </View>
        ) : results ? (
          results.length ? (
            <View>
              <Text style={styles.resultsTitle}>{results.length} photos found</Text>
              <FlatList
                data={results}
                keyExtractor={(p) => p.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={{ gap }}
                contentContainerStyle={{ gap }}
                renderItem={({ item }) => <PhotoCell photo={item} size={cell} />}
              />
            </View>
          ) : (
            <EmptyState
              icon="images-outline"
              title="No photos found"
              message="We couldn't find you in any event photos yet. Try a clearer selfie or an invite code."
            />
          )
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PhotoCell({ photo, size }: { photo: FoundPhoto; size: number }) {
  const router = useRouter();
  const locked = !photo.isPurchased && photo.price != null && photo.price > 0;

  const onPress = () => {
    if (locked && photo.albumId) {
      router.push(`/album/${photo.albumId}` as Href); // buy/unlock the album
    } else if (photo.url) {
      WebBrowser.openBrowserAsync(photo.url); // view full-res
    }
  };

  return (
    <Pressable style={[styles.cell, { width: size, height: size }]} onPress={onPress}>
      <Image
        source={{ uri: photo.thumbnailUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      {locked ? (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={18} color={colors.textOnPrimary} />
          <Text style={styles.lockPrice}>{formatMoney(photo.price, photo.currency)}</Text>
        </View>
      ) : null}
      {photo.eventTitle ? (
        <View style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={1}>
            {photo.eventTitle}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg },
  lead: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 21 },
  selfieWrap: { alignItems: 'center' },
  selfie: { width: 132, height: 132, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  selfiePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  pickRow: { flexDirection: 'row', gap: spacing.md },
  pickBtn: { flex: 1 },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  resultsTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },
  cell: { borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  lock: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(8,58,133,0.55)' },
  lockPrice: { color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.4)' },
  captionText: { color: colors.textOnPrimary, fontSize: fontSize.xs },
});
