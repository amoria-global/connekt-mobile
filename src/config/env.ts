/**
 * Central app configuration.
 *
 * No secrets here — anything bundled ships to the device. Secrets stay on
 * the amoria-connect backend.
 *
 * The default points at the production Connekyt backend so the app works on
 * a physical device via Expo Go. For local backend testing, set
 * EXPO_PUBLIC_API_BASE_URL (e.g. http://192.168.1.X:8080/api/remote — use your
 * machine's LAN IP, not localhost, so the phone can reach it).
 */
import Constants from 'expo-constants';

type Extra = { apiBaseUrl?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const env = {
  /** Base URL of the amoria-connect (Spring Boot) API, including /api/remote. */
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    extra.apiBaseUrl ??
    'https://backend.connekyt.com/api/remote',

  /**
   * Public web app (knockout landing) base URL. Registration now happens in
   * the browser — the app opens `${webBaseUrl}/user/auth/signup` and the web
   * bounces back into the app via the `connekt://` deep link on success.
   */
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://connekyt.com',

  /**
   * Authenticated dashboard (salo-run) base URL.
   *
   * Separate from webBaseUrl because they are different deployments: the
   * landing is connekyt.com, the signed-in dashboard is a subdomain. Identity
   * verification lives on the dashboard, and the app opens it in the in-app
   * browser rather than reimplementing it (CONN-ONB-1).
   */
  dashboardBaseUrl:
    process.env.EXPO_PUBLIC_DASHBOARD_BASE_URL ?? 'https://dashboard.connekyt.com',

  /** Network request timeout in milliseconds. */
  requestTimeoutMs: 20_000,

  /** Network request timeout for file/multipart uploads in milliseconds (2 minutes). */
  uploadTimeoutMs: 120_000,

  /**
   * Google OAuth client IDs (from Google Cloud Console). Set whichever apply
   * via EXPO_PUBLIC_GOOGLE_* env vars. The web client ID is reused from the
   * web app's NEXT_PUBLIC_GOOGLE_CLIENT_ID. Native sign-in also needs iOS /
   * Android client IDs created for this app's bundle id + scheme (connekt).
   */
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',

  isDev: __DEV__,
} as const;

/** True when at least one Google client ID is configured. */
export const googleConfigured =
  !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
