import ScreenComp from '@/features/streams/viewer/screens/LiveViewerScreen';
import { useLanguage } from '@/hooks/useLanguage';

export default function WrappedRoute() {
  useLanguage();
  return <ScreenComp />;
}
