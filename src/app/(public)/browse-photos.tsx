import { Redirect } from 'expo-router';

/** "Browse Photos" became Explore. Old links, notifications and bookmarks land on the new screen. */
export default function BrowsePhotosRedirect() {
  return <Redirect href="/(public)/explore" />;
}
