import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { getKyc, submitKyc, type KycImage } from '@/features/kyc/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

async function pickImage(): Promise<KycImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow photo access to upload your documents.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const name = asset.uri.split('/').pop() || 'document.jpg';
  return { uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' };
}

export default function KycScreen() {
  const { data, loading, error, refresh } = useAsync(useCallback(() => getKyc(), []));

  const [idType, setIdType] = useState('National ID');
  const [idNumber, setIdNumber] = useState('');
  const [idFront, setIdFront] = useState<KycImage | null>(null);
  const [idBack, setIdBack] = useState<KycImage | null>(null);
  const [selfie, setSelfie] = useState<KycImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const status = data?.status ?? 'NONE';
  const alreadySubmitted = status === 'PENDING' || status === 'APPROVED';

  const onSubmit = async () => {
    setFormError(null);
    if (!idNumber.trim()) return setFormError('Enter your ID number.');
    if (!idFront) return setFormError('Add a photo of the front of your ID.');
    if (!selfie) return setFormError('Add a selfie.');
    setSubmitting(true);
    try {
      await submitKyc({ idType, idNumber: idNumber.trim(), idFront, idBack: idBack ?? undefined, selfie });
      Alert.alert('Submitted', 'Your documents are under review.');
      await refresh();
    } catch (err) {
      setFormError(isApiError(err) ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title="Identity verification" subtitle="Verify to unlock payouts" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current status</Text>
          <StatusPill status={status === 'NONE' ? 'Not submitted' : status} />
          {data?.rejectionReason ? <Text style={styles.reason}>{data.rejectionReason}</Text> : null}
          {error ? <Text style={styles.reason}>{error}</Text> : null}
        </View>

        {alreadySubmitted ? (
          <Text style={styles.note}>
            {status === 'APPROVED'
              ? 'Your identity is verified. 🎉'
              : 'Your documents are being reviewed. We will notify you once done.'}
          </Text>
        ) : (
          <>
            <Input label="ID type" value={idType} onChangeText={setIdType} />
            <Input label="ID number" value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" />

            <PhotoField label="Front of ID" image={idFront} onPick={async () => setIdFront(await pickImage())} />
            <PhotoField label="Back of ID (optional)" image={idBack} onPick={async () => setIdBack(await pickImage())} />
            <PhotoField label="Selfie" image={selfie} onPick={async () => setSelfie(await pickImage())} />

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Button title="Submit for review" onPress={onSubmit} loading={submitting} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PhotoField({
  label,
  image,
  onPick,
}: {
  label: string;
  image: KycImage | null;
  onPick: () => void;
}) {
  return (
    <View style={styles.photoField}>
      <Text style={styles.photoLabel}>{label}</Text>
      <Pressable style={styles.photoBox} onPress={onPick}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
            <Text style={styles.photoHint}>Tap to add photo</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statusLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold },
  reason: { fontSize: fontSize.sm, color: colors.error },
  note: { fontSize: fontSize.md, color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
  photoField: { gap: spacing.xs },
  photoLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSoft },
  photoBox: {
    height: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  photoHint: { fontSize: fontSize.sm, color: colors.textMuted },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
