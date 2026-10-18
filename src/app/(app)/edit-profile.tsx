import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput, type PhoneValue } from '@/components/ui/PhoneInput';
import { Screen } from '@/components/ui/Screen';
import { onlyDigits, parsePhone, type ParsedPhone } from '@/lib/phoneKit';
import {
  fetchProfile,
  updateCoordinatorProfile,
  updateCoverPicture,
  updateProfile,
  updateProfilePicture,
} from '@/features/profile/api';
import { useRole } from '@/features/auth/role';
import { pickFromLibrary } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
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
  const { t } = useLanguage();
  const router = useRouter();
  const { isCoordinator } = useRole();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);
  const customerRole = user?.customerType;

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phoneSeed, setPhoneSeed] = useState(() => seedPhone(user?.phone ?? ''));
  const [phoneValue, setPhoneValue] = useState<PhoneValue | null>(null);

  // Coordinator specific business fields (parity with salo-run)
  const [organizationName, setOrganizationName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [taxId, setTaxId] = useState('');

  // Optimistic overrides while a pick/upload is in flight. Display falls
  // back to the live auth session so a cover set on the Profile tab shows
  // here immediately (useState alone only captured the mount snapshot).
  const [avatarOverride, setAvatarOverride] = useState<string | undefined>();
  const [coverOverride, setCoverOverride] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatar = avatarOverride ?? user?.profilePicture;
  const cover = coverOverride ?? user?.coverPicture;
  const initials = (firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const profile = await fetchProfile(isCoordinator ? 'coordinator' : undefined);
          if (cancelled) return;
          const patch: Parameters<typeof updateUser>[0] = {};
          if (profile.firstName != null) {
            patch.firstName = profile.firstName;
            setFirstName(profile.firstName);
          }
          if (profile.lastName != null) {
            patch.lastName = profile.lastName;
            setLastName(profile.lastName);
          }
          if (profile.phone != null) {
            patch.phone = profile.phone;
            setPhoneSeed(seedPhone(profile.phone));
          }
          if (profile.organizationName != null) {
            setOrganizationName(profile.organizationName);
          }
          if (profile.businessType != null) {
            setBusinessType(profile.businessType);
          }
          if (profile.businessAddress != null) {
            setBusinessAddress(profile.businessAddress);
          } else if (profile.address != null) {
            setBusinessAddress(profile.address);
          }
          if (profile.website != null) {
            setWebsite(profile.website);
          }
          if (profile.taxId != null) {
            setTaxId(profile.taxId);
          }
          if (profile.profilePicture) {
            patch.profilePicture = profile.profilePicture;
            setAvatarOverride(undefined);
          }
          if (profile.coverPicture) {
            patch.coverPicture = profile.coverPicture;
            setCoverOverride(undefined);
          }
          if (profile.profileCompletionPercentage != null) {
            patch.profileCompletionPercentage = profile.profileCompletionPercentage;
          }
          if (Object.keys(patch).length > 0) updateUser(patch);
        } catch {
          // Keep the cached session if the refresh fails.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [updateUser, isCoordinator]),
  );

  const onPickAvatar = async () => {
    const img = await pickFromLibrary();
    if (!img) return;
    setError(null);
    setAvatarOverride(img.uri);
    setUploading(true);
    try {
      const url = await updateProfilePicture(img);
      setAvatarOverride(url);
      updateUser({ profilePicture: url });
    } catch (err) {
      setAvatarOverride(undefined);
      setError(isApiError(err) ? err.message : t('b1_editProfileUploadPhotoErr'));
    } finally {
      setUploading(false);
    }
  };

  const onPickCover = async () => {
    const img = await pickFromLibrary();
    if (!img) return;
    setError(null);
    setCoverOverride(img.uri);
    setCoverUploading(true);
    try {
      const url = await updateCoverPicture(img, customerRole);
      setCoverOverride(url);
      updateUser({ coverPicture: url });
    } catch (err) {
      setCoverOverride(undefined);
      setError(isApiError(err) ? err.message : t('b1_editProfileUploadCoverErr'));
    } finally {
      setCoverUploading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('b1_editProfileNameRequiredErr'));
      return;
    }
    if (phoneValue && phoneValue.nsn && !phoneValue.isValid) {
      setError(t('b1_editProfileInvalidPhoneErr'));
      return;
    }
    // Wire format: full international digits, no '+' ("250788123456").
    const phoneDigits = phoneValue?.digits ?? '';
    setSaving(true);
    try {
      if (isCoordinator) {
        await updateCoordinatorProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phoneDigits || undefined,
          address: businessAddress.trim() || undefined,
          businessAddress: businessAddress.trim() || undefined,
          organizationName: organizationName.trim() || undefined,
          businessType: businessType.trim() || undefined,
          taxId: taxId.trim() || undefined,
          website: website.trim() || undefined,
        });
      } else {
        await updateProfile({ firstName, lastName, phone: phoneDigits });
      }
      updateUser({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phoneDigits });
      router.back();
    } catch (err) {
      setError(isApiError(err) ? err.message : t('b1_editProfileSaveErr'));
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
                <Text style={styles.coverHint}>{t('b1_editProfileAddCover')}</Text>
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
            <Input label={t('b1_editProfileFirstName')} value={firstName} onChangeText={setFirstName} />
            <Input label={t('b1_editProfileLastName')} value={lastName} onChangeText={setLastName} />
            <PhoneInput
              key={`${phoneSeed.country?.iso2 ?? 'RW'}-${phoneSeed.nsn}`}
              label={t('b1_editProfilePhone')}
              defaultIso2={phoneSeed.country?.iso2 ?? 'RW'}
              initialNsn={phoneSeed.nsn}
              onChange={setPhoneValue}
            />

            {isCoordinator ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('b1_editProfileOrgTitle')}</Text>
                  <Text style={styles.sectionSubtitle}>{t('b1_editProfileOrgSubtitle')}</Text>
                </View>
                <Input
                  label={t('b1_editProfileOrgNameLabel')}
                  value={organizationName}
                  onChangeText={setOrganizationName}
                  placeholder={t('b1_editProfileOrgNamePlaceholder')}
                />
                <Input
                  label={t('b1_editProfileBizTypeLabel')}
                  value={businessType}
                  onChangeText={setBusinessType}
                  placeholder={t('b1_editProfileBizTypePlaceholder')}
                />
                <Input
                  label={t('b1_editProfileBizAddrLabel')}
                  value={businessAddress}
                  onChangeText={setBusinessAddress}
                  placeholder={t('b1_editProfileBizAddrPlaceholder')}
                />
                <Input
                  label={t('b1_editProfileWebsiteLabel')}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder={t('b1_editProfileWebsitePlaceholder')}
                  autoCapitalize="none"
                />
                <Input
                  label={t('b1_editProfileTaxIdLabel')}
                  value={taxId}
                  onChangeText={setTaxId}
                  placeholder={t('b1_editProfileTaxIdPlaceholder')}
                  autoCapitalize="none"
                />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title={t('b1_editProfileSaveBtn')} onPress={onSave} loading={saving} />
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
  sectionHeader: { marginTop: spacing.md, gap: 2 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  sectionSubtitle: { fontSize: fontSize.xs, color: c.textMuted },
  error: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },
}));
