import { FindMyPhotos } from '@/features/photos/FindMyPhotos';

import { useLanguage } from '@/hooks/useLanguage';

export default function PublicFindPhotosScreen() {
  const { t } = useLanguage();
  return <FindMyPhotos />;
}

