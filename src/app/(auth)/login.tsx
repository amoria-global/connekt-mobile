import { FindPhotosBottomSheet } from "@/components/FindPhotosBottomSheet";
import { ExploreChoiceSheet } from '@/features/hybrid/ExploreChoiceSheet';
import { MODE_META } from '@/features/hybrid/hybridUi';
import { pendingPostEvent } from '@/features/hybrid/postEventIntent';
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  isNeedsPasswordChange,
  isNeedsTotp,
  isNeedsVerification,
} from "@/features/auth/api";
import { AppleButton } from "@/features/auth/AppleButton";
import { AuthGlassLayout } from "@/features/auth/AuthGlassLayout";
import { ChooseRoleBottomSheet } from "@/features/auth/ChooseRoleBottomSheet";
import { GoogleButton } from "@/features/auth/GoogleButton";
import type { CustomerType } from "@/features/auth/types";
import { parsePhone } from "@/lib/phoneKit";
import { isApiError, useAuth } from "@/store/auth";
import { useLanguage } from "@/store/language";
import {
  fontSize,
  fontWeight,
  fonts,
  makeStyles,
  radii,
  spacing,
  useTheme,
} from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { z } from "zod";
import { GlassOnMedia, glassTile } from '@/components/ui/GlassCard';
import { useVideoPlayer, VideoView } from "expo-video";

const FIND_PHOTOS_VIDEO = require('../../../assets/images/screen3.mp4');
/** First frame for the video card while the video loads. */
const SCAN_POSTER = require('../../../assets/images/scan.png');
const LIVE_IMAGE = require('../../../assets/images/live.png');

const schema = z.object({
  // Still accepts an email OR a phone number — phone-only accounts (registered
  // on mobile/TV) sign in with their number here and the backend resolves
  // either. Only the USER-FACING COPY is email-only, by product decision: the
  // field is presented as an email field, and a phone quietly also works.
  email: z
    .string()
    .min(1, "Email is required")
    .refine(
      (v) =>
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) ||
        /^[+\d][\d\s-]{5,}$/.test(v.trim()),
      "Enter a valid email address",
    ),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const login = useAuth((s) => s.login);
  const applySession = useAuth((s) => s.applySession);
  const router = useRouter();
  const params = useLocalSearchParams<{
    selectRole?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>();
  const [serverError, setServerError] = useState<string | null>(null);
  const { t } = useLanguage();
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);
  const [exploreChoiceOpen, setExploreChoiceOpen] = useState(false);
  // A guest chose "Post my event": they are already on the sign-in screen, so
  // say so here and put them in the email field. The home screen opens the
  // wizard once they are signed in (see postEventIntent).
  const [postIntent, setPostIntent] = useState(() => pendingPostEvent.has());
  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const askSignInToPost = () => {
    setPostIntent(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => emailRef.current?.focus(), 250);
  };
  const dismissPostIntent = () => {
    pendingPostEvent.clear();
    setPostIntent(false);
  };
  const [prefilledProfile, setPrefilledProfile] = useState<{
    email?: string;
    firstName?: string;
    lastName?: string;
  } | null>(null);

  useEffect(() => {
    if (params.selectRole === "1") {
      if (params.email || params.firstName || params.lastName) {
        setPrefilledProfile({
          email: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
        });
      }
      setRoleSheetVisible(true);
    }
  }, [params.selectRole, params.email, params.firstName, params.lastName]);

  /**
   * Registration starts with role selection displayed as a native bottom sheet.
   * Once a role is chosen, the user navigates into the full-page signup flow.
   */
  const onRegister = () => {
    setServerError(null);
    setPrefilledProfile(null);
    setRoleSheetVisible(true);
  };

  const onSelectRole = (role: CustomerType) => {
    setRoleSheetVisible(false);
    router.push({
      pathname: "/signup",
      params: {
        role,
        ...(prefilledProfile?.email ? { email: prefilledProfile.email } : {}),
        ...(prefilledProfile?.firstName
          ? { firstName: prefilledProfile.firstName }
          : {}),
        ...(prefilledProfile?.lastName
          ? { lastName: prefilledProfile.lastName }
          : {}),
      },
    });
  };

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    // Phone-like identifiers ("0788…", "+254 712…") are normalized to full
    // international digits ("250788123456") so phone logins match the stored
    // wire format for every country, not just Rwanda. Emails pass through
    // untouched.
    const raw = values.email.trim();
    let identifier = raw;
    if (/^[+0-9][0-9\s-]{5,}$/.test(raw)) {
      const parsed = parsePhone(raw, "RW");
      if (parsed.country && parsed.nsn)
        identifier = `${parsed.country.dial}${parsed.nsn}`;
    }
    try {
      await login({ email: identifier, password: values.password });
    } catch (err) {
      if (isNeedsPasswordChange(err)) {
        const token =
          typeof err === "object" &&
          err !== null &&
          "token" in err &&
          typeof err.token === "string"
            ? err.token
            : "";
        const email = typeof err.email === "string" ? err.email : "";
        router.push({
          pathname: "/change-password",
          params: { email, token },
        });
        return;
      }
      if (isNeedsTotp(err)) {
        router.push({
          pathname: "/verify-totp",
          params: { customerId: err.customerId },
        });
        return;
      }
      if (isNeedsVerification(err)) {
        router.push({
          pathname: "/verify-otp",
          params: { customerId: err.customerId, email: values.email },
        });
        return;
      }
      setServerError(
        isApiError(err)
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  // Guest paths sit on the photo itself, so they are visible on arrival
  // instead of below the fold under the sign-in form.
  const guestPaths = (
    <View style={styles.guestRow}>
      <Pressable
        onPress={() => router.push("/find-photos")}
        style={({ pressed }) => [styles.guestCard, pressed && styles.guestCardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('findMyPhotos')}. ${t('selfiePhotoLookup')}`}
      >
        <Image source={SCAN_POSTER} style={styles.cover} resizeMode="cover" />
        <GuestCardVideo source={FIND_PHOTOS_VIDEO} />
        <GuestCardLabel
          icon="scan-outline"
          iconStyle={styles.guestIconAccent}
          title={t('findMyPhotos')}
          subtitle={t('aiScan')}
        />
      </Pressable>
      <Pressable
        onPress={() => setExploreChoiceOpen(true)}
        style={({ pressed }) => [styles.guestCard, pressed && styles.guestCardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('exploreEvents')}. ${t('liveStreamsEvents')}`}
      >
        <Image source={LIVE_IMAGE} style={styles.cover} resizeMode="cover" />
        <GuestCardLabel
          icon="radio-outline"
          iconStyle={styles.guestIconLive}
          title={t('exploreEvents')}
          subtitle={t('liveAndEvents')}
        />
      </Pressable>
    </View>
  );

  return (
    <>
      <AuthGlassLayout
        title={t('welcomeBack')}
        subtitle={t('signInToAccount')}
        bandRatio={0.28}
        bandFooter={guestPaths}
        scrollRef={scrollRef}
        footer={
          <Pressable
            style={styles.registerLine}
            onPress={onRegister}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.registerText}>
              {t('notRegisteredYet')} <Text style={styles.link}>{t('createAnAccount')}</Text>
            </Text>
          </Pressable>
        }
      >
        {postIntent ? (
          <View
            style={styles.postNotice}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <View style={styles.postNoticeIcon}>
              <Ionicons name={MODE_META.HYBRID.icon} size={18} color={MODE_META.HYBRID.color} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.postNoticeTitle}>{t('signInToPostEvent')}</Text>
              <Text style={styles.postNoticeText}>
                {t('postEventOpens')}{" "}
                <Text style={styles.link} onPress={onRegister} accessibilityRole="link">
                  {t('newHereCreateAccount')}
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={dismissPostIntent}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cancel posting my event"
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.fields}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                glass
                ref={emailRef}
                label={t('yourEmail')}
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                glass
                label={t('passwordLabel')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />
          <Pressable
            style={styles.forgot}
            onPress={() =>
              router.push({
                pathname: "/forgot-password",
                params: { email: getValues("email") },
              })
            }
            hitSlop={10}
            accessibilityRole="link"
          >
            <Text style={styles.forgotText}>{t('forgotYourPassword')}</Text>
          </Pressable>
        </View>

        {serverError ? (
          <Text style={styles.serverError} accessibilityRole="alert">{serverError}</Text>
        ) : null}

        <Button
          title={t('logIn')}
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>{t('orContinueWith')}</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.social}>
          {/* SIGN-IN mode: no role is known here, so this must never create
              an account. An unrecognised Google profile is routed to role
              selection with its details carried over. */}
          <GoogleButton
            mode="login"
            label={t('continueWithGoogle')}
            onNeedsRole={(profile) => {
              setPrefilledProfile({
                email: profile.email,
                firstName: profile.firstName,
                lastName: profile.lastName,
              });
              setRoleSheetVisible(true);
            }}
          />
          {/* Same rule as Google: sign-in never creates an account. The
              backend is asked not to register an unknown Apple ID and the
              verified profile is carried into role selection. */}
          <AppleButton
            mode="login"
            label={t('continueWithApple')}
            onNeedsRole={(profile) => {
              setPrefilledProfile({
                email: profile.email,
                firstName: profile.firstName,
                lastName: profile.lastName,
              });
              setRoleSheetVisible(true);
            }}
          />
        </View>

      </AuthGlassLayout>

      <ExploreChoiceSheet
        visible={exploreChoiceOpen}
        onClose={() => setExploreChoiceOpen(false)}
        signedIn={false}
        onSignInRequired={askSignInToPost}
      />

      <FindPhotosBottomSheet
        visible={findPhotosModalVisible}
        onClose={() => setFindPhotosModalVisible(false)}
        getPhotosRoute="/find-photos"
      />

      <ChooseRoleBottomSheet
        visible={roleSheetVisible}
        onClose={() => setRoleSheetVisible(false)}
        onSelectRole={onSelectRole}
      />
    </>
  );
}

/** Looping, muted background video for a guest card that won't interrupt device audio. */
function GuestCardVideo({ source }: { source: number }) {
  const styles = useStyles();
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={styles.cover}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

/** A guest card's caption: a strip of dark glass across the bottom of the media. */
function GuestCardLabel({
  icon,
  iconStyle,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconStyle: StyleProp<ViewStyle>;
  title: string;
  subtitle: string;
}) {
  const styles = useStyles();
  return (
    <GlassOnMedia style={styles.guestLabel} fill="rgba(5,10,24,0.38)">
      <View style={[styles.guestIcon, iconStyle]}>
        <Ionicons name={icon} size={14} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.guestTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.guestSub} numberOfLines={1}>{subtitle}</Text>
      </View>
    </GlassOnMedia>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },

  // ── Guest paths, on the photo ─────────────────────────────────────────
  guestRow: { flexDirection: "row", gap: spacing.sm },
  guestCard: {
    flex: 1,
    height: 112,
    borderRadius: radii.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: "#0A1428",
    // A glass rim, so the media reads as set into the photo, not pasted on.
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  guestCardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  // Explicit size as well as absoluteFill: react-native-web otherwise lays
  // images out at their intrinsic size.
  cover: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  guestLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm - 2,
    // Android fallback: no blur there, so a plain smoked strip.
    backgroundColor: "rgba(5,10,24,0.62)",
  },
  guestIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  guestIconAccent: { backgroundColor: "rgba(242,12,143,0.9)" },
  guestIconLive: { backgroundColor: "rgba(220,38,38,0.9)" },
  guestTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    fontWeight: fontWeight.bold,
    color: "#FFFFFF",
  },
  guestSub: { fontSize: 10, color: "rgba(255,255,255,0.78)", marginTop: 1, letterSpacing: 0.3 },

  // ── Sheet content ─────────────────────────────────────────────────────
  fields: { gap: spacing.md },
  forgot: { alignSelf: "flex-end", paddingVertical: 2 },
  forgotText: {
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: "center" },

  postNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    ...glassTile(c),
    borderColor: MODE_META.HYBRID.color,
  },
  postNoticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MODE_META.HYBRID.soft,
  },
  postNoticeTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  postNoticeText: { fontSize: fontSize.xs, color: c.textSoft, lineHeight: 17, marginTop: 2 },

  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  dividerText: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  social: { gap: spacing.sm },

  registerLine: { alignSelf: "center", paddingVertical: spacing.xs },
  registerText: { color: c.textSoft, fontSize: fontSize.sm },
  link: { color: c.primary, fontWeight: fontWeight.bold },
}));
