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
import { Screen } from '@/components/ui/Screen';
import { updateProfile, updateProfilePicture } from '@/features/profile/api';
import { pickFromLibrary } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatar, setAvatar] = useState(user?.profilePicture);
  const [uploading, setUploading] = useState(false);
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

  const onSave = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ firstName, lastName, phone });
      updateUser({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() });
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
            <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Save changes" onPress={onSave} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, gap: spacing.xl, alignItems: 'stretch' },
  avatarWrap: { alignSelf: 'center' },
  avatar: { width: 104, height: 104, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  initials: { color: colors.textOnPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  form: { gap: spacing.lg },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
