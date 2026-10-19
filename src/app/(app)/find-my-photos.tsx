import { FindMyPhotos } from '@/features/photos/FindMyPhotos';

import { useLanguage } from '@/hooks/useLanguage';

export default function FindMyPhotosScreen() {
  const { t } = useLanguage();
  return <FindMyPhotos />;
}
