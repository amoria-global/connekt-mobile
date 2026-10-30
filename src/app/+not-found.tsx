import { Redirect } from 'expo-router';

/**
 * A link the app has no screen for (a newer or retired page, a typo in a shared URL) used to land on the router's blank
 * "Unmatched Route" screen. Send the person home instead; the root guard then routes them to sign-in or onboarding.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
