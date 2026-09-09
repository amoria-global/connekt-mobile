import { useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput, type PhoneValue } from '@/components/ui/PhoneInput';
import { Screen } from '@/components/ui/Screen';
import { onlyDigits, parsePhone, type ParsedPhone } from '@/lib/phoneKit';
import { updateCoverPicture, updateProfile, updateProfilePicture } from '@/features/profile/api';
import { pickFromLibrary } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

/**
 * Seed the phone editor from whatever format the account has stored:
 * "+250788123456", "0788123456", or the wire format "250788123456"
 * (full international digits, no '+' — what the app submits now).
 */
function seedPhone(raw: string): ParsedPhone {
  const parsed = parsePhone(raw, 'RW');
  if (parsed.isValid || !raw.trim() || raw.trim().startsWith('+')) return parsed;
  // No '+' and not a valid RW national number — it is most likely already
  // dial-prefixed digits, so retry as international.
  const intl = parsePhone(`+${onlyDigits(raw)}`, 'RW');
  return intl.isValid ? intl : parsed;
}

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phoneSeed] = useState(() => seedPhone(user?.phone ?? ''));
  const [phoneValue, setPhoneValue] = useState<PhoneValue | null>(null);
  const [avatar, setAvatar] = useState(user?.profilePicture);
  const [cover, setCover] = useState(user?.coverPicture);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = (firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  const onPickAvatar = async () => {
    const img = await pickFromLibrary();
    if (!img) return;
    setError(null);
    setUploading(true);
    try {
      const url = await updateProfilePicture(img);
      const next = url ?? img.uri;
      setAvatar(next);
      updateUser({ profilePicture: next });
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
    }
  };

  const onPickCover = async () => {
    const img = await pickFromLibrary();
    if (!img) return;
    setError(null);
    setCoverUploading(true);
    try {
      const url = await updateCoverPicture(img);
      const next = url ?? img.uri;
      setCover(next);
      updateUser({ coverPicture: next });
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not upload the cover photo.');
    } finally {
      setCoverUploading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (phoneValue && phoneValue.nsn && !phoneValue.isValid) {
      setError('Enter a valid phone number.');
      return;
    }
    // Wire format: full international digits, no '+' ("250788123456").
    const phoneDigits = phoneValue?.digits ?? '';
    setSaving(true);
    try {
      await updateProfile({ firstName, lastName, phone: phoneDigits });
      updateUser({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phoneDigits });
      router.back();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.coverWrap} onPress={onPickCover} disabled={coverUploading}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Ionicons name="image-outline" size={26} color={colors.textMuted} />
                <Text style={styles.coverHint}>Add cover photo</Text>
              </View>
            )}
            <View style={styles.coverBadge}>
              {coverUploading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Ionicons name="camera" size={14} color={colors.textOnPrimary} />
              )}
            </View>
          </Pressable>

          <Pressable style={styles.avatarWrap} onPress={onPickAvatar} disabled={uploading}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.textOnPrimary} />
              )}
            </View>
          </Pressable>

          <View style={styles.form}>
            <Input label="First name" value={firstName} onChangeText={setFirstName} />
            <Input label="Last name" value={lastName} onChangeText={setLastName} />
            <PhoneInput
              label="Phone"
              defaultIso2={phoneSeed.country?.iso2 ?? 'RW'}
              initialNsn={phoneSeed.nsn}
              onChange={setPhoneValue}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Save changes" onPress={onSave} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, gap: spacing.xl, alignItems: 'stretch' },
  coverWrap: { alignSelf: 'stretch' },
  cover: { width: '100%', height: 130, borderRadius: radii.lg, backgroundColor: c.surfaceMuted },
  coverFallback: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: c.borderSoft },
  coverHint: { fontSize: fontSize.sm, color: c.textMuted, fontWeight: fontWeight.semibold },
  coverBadge: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 30,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { alignSelf: 'center', marginTop: -spacing['3xl'] },
  avatar: { width: 104, height: 104, borderRadius: radii.full, backgroundColor: c.surfaceMuted, borderWidth: 3, borderColor: c.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  initials: { color: c.textOnPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: c.background,
  },
  form: { gap: spacing.lg },
  error: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },
}));
