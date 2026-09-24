import { FindPhotosBottomSheet } from "@/components/FindPhotosBottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import {
  isNeedsPasswordChange,
  isNeedsTotp,
  isNeedsVerification,
} from "@/features/auth/api";
import { AppleButton } from "@/features/auth/AppleButton";
import { ChooseRoleBottomSheet } from "@/features/auth/ChooseRoleBottomSheet";
import { GoogleButton } from "@/features/auth/GoogleButton";
import type { CustomerType } from "@/features/auth/types";
import { parsePhone } from "@/lib/phoneKit";
import { isApiError, useAuth } from "@/store/auth";
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
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { z } from "zod";

const FIND_PHOTOS_VIDEO = require('../../../assets/images/screen3.mp4');
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
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);
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

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.top}>
            <View style={styles.header}>
              <Image
                source={require("../../../assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </View>

            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Your Email"
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
                    label="Password"
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
                style={styles.forgotWrap}
                onPress={() =>
                  router.push({
                    pathname: "/forgot-password",
                    params: { email: getValues("email") },
                  })
                }
                hitSlop={8}
              >
                <Text style={styles.forgotText}>Forgot your password?</Text>
              </Pressable>

              {serverError ? (
                <Text style={styles.serverError}>{serverError}</Text>
              ) : null}

              <Button
                title="Log in"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
              />

              <Pressable
                style={styles.registerLine}
                onPress={onRegister}
                hitSlop={8}
              >
                <Text style={styles.registerText}>
                  Not registered yet?{" "}
                  <Text style={styles.registerLink}>Create an account</Text>
                </Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>Or continue with</Text>
                <View style={styles.line} />
              </View>

              {/* SIGN-IN mode: no role is known here, so this must never create
                  an account. An unrecognised Google profile is routed to role
                  selection with its details carried over. */}
              <GoogleButton
                mode="login"
                label="Continue with Google"
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
                label="Continue with Apple"
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

            <View style={styles.guestSection}>
              <View style={styles.guestHeaderRow}>
                <Text style={styles.guestSectionTitle}>
                  Explore without account
                </Text>
                <View style={styles.guestTagPill}>
                  <Text style={styles.guestTagText}>FREE ACCESS</Text>
                </View>
              </View>

              <View style={styles.guestCardsRow}>
                {/* Find My Photos card */}
                <Pressable
                  style={({ pressed }) => [
                    styles.guestCard,
                    pressed && styles.guestCardPressed,
                  ]}
                  onPress={() => router.push("/find-photos")}
                  accessibilityRole="button"
                  accessibilityLabel="Find my photos with AI facial recognition"
                >
                  <Image
                    source={require("../../../assets/images/scan.png")}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["rgba(8,20,44,0.25)", "rgba(8,20,44,0.92)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.guestCardContent}>
                    <View style={[styles.badge, styles.badgeAi]}>
                      <Ionicons name="scan-outline" size={12} color="#F20C8F" />
                      <Text style={styles.badgeText}>AI SCAN</Text>
                    </View>

                    <View style={styles.guestCardFooter}>
                      <View style={styles.guestCardTextCol}>
                        <Text style={styles.guestCardTitle} numberOfLines={1}>
                          Find My Photos
                        </Text>
                        <Text style={styles.guestCardDesc} numberOfLines={2}>
                          Selfie photo lookup
                        </Text>
                      </View>
                      <View style={styles.cardArrowWrap}>
                        <Ionicons
                          name="arrow-forward"
                          size={12}
                          color="#FFFFFF"
                        />
                      </View>
                    </View>
                  </View>
                </Pressable>

                {/* Explore Events card */}
                <Pressable
                  style={({ pressed }) => [
                    styles.guestCard,
                    pressed && styles.guestCardPressed,
                  ]}
                  onPress={() => router.push("/explore-events")}
                  accessibilityRole="button"
                  accessibilityLabel="Explore public events and live streams"
                >
                  <Image
                    source={require("../../../assets/images/live.png")}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["rgba(8,20,44,0.25)", "rgba(8,20,44,0.92)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.guestCardContent}>
                    <View style={[styles.badge, styles.badgeLive]}>
                      <View style={styles.livePulseDot} />
                      <Text style={styles.badgeText}>LIVE & EVENTS</Text>
                    </View>

                    <View style={styles.guestCardFooter}>
                      <View style={styles.guestCardTextCol}>
                        <Text style={styles.guestCardTitle} numberOfLines={1}>
                          Explore Events
                        </Text>
                        <Text style={styles.guestCardDesc} numberOfLines={2}>
                          Live streams & events
                        </Text>
                      </View>
                      <View style={styles.cardArrowWrap}>
                        <Ionicons
                          name="arrow-forward"
                          size={12}
                          color="#FFFFFF"
                        />
                      </View>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </Screen>
  );
}

/** Looping, muted background video for guest cards that won't interrupt device audio. */
function GuestCardVideo({ source }: { source: number }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  flex: { flex: 1 },
  // `flexGrow: 1` + `justifyContent: 'space-between'` lets the form sit in
  // the natural flow on tall devices and pin the signup link to the bottom
  // edge so guests don't hunt for it. On short devices the scroll view
  // still lets everything scroll into view.
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  top: { gap: spacing.md },

  header: { alignItems: "center", gap: 2, marginBottom: spacing.sm },
  logo: { width: 88, height: 44, marginBottom: spacing.xs },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
  },
  subtitle: { fontSize: fontSize.sm, color: c.textMuted },

  form: { gap: spacing.md },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  forgotText: {
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: "center" },

  registerLine: { alignSelf: "center", paddingVertical: spacing.xs },
  registerText: { color: c.textMuted, fontSize: fontSize.sm },
  registerLink: { color: c.primary, fontWeight: fontWeight.bold },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  line: {
    flex: 1,
    height: 2,
    borderRadius: radii.full,
    backgroundColor: c.border,
  },
  dividerText: {
    color: c.textSoft,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // ── Audience-engaging guest exploration cards ──────────────────────────
  guestSection: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  guestHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  guestSectionTitle: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  guestTagPill: {
    backgroundColor: c.tint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  guestTagText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: c.primary,
    letterSpacing: 0.5,
  },
  guestCardsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  guestCard: {
    flex: 1,
    height: 136,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: "#0A1428",
    borderWidth: 1.5,
    borderColor: c.border,
    ...e(2),
  },
  guestCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  guestCardContent: {
    flex: 1,
    padding: spacing.sm + 2,
    justifyContent: "space-between",
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  badgeAi: {
    backgroundColor: "rgba(242, 12, 143, 0.25)",
    borderColor: "rgba(242, 12, 143, 0.5)",
  },
  badgeLive: {
    backgroundColor: "rgba(220, 38, 38, 0.25)",
    borderColor: "rgba(220, 38, 38, 0.5)",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  guestCardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
  },
  guestCardTextCol: {
    flex: 1,
  },
  guestCardTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    fontWeight: fontWeight.bold,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  guestCardDesc: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 1,
    lineHeight: 13,
  },
  cardArrowWrap: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
}));
