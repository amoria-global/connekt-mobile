/**
 * The screen a viewer sees when their place is kept out of an event (or could not be confirmed). It says so plainly and,
 * when a retry could help, offers one. It never shows a price, a stream link or a pay button.
 */
import { EmptyState } from '@/components/ui/EmptyState';
import type { RegionBlock } from './regionBlock';

type Props = {
  block: RegionBlock;
  onRetry?: () => void;
  /** Where "Back" goes; omit to hide it. */
  onBack?: () => void;
  testID?: string;
};

export function RegionBlockedView({ block, onRetry, onBack, testID = 'region-blocked' }: Props) {
  const canRetry = block.unknown && !!onRetry;
  return (
    <EmptyState
      icon={block.unknown ? 'location-outline' : 'earth-outline'}
      title={block.unknown ? 'We could not confirm your location' : 'Not available in your region'}
      message={block.message}
      action={canRetry ? { label: 'Retry', onPress: onRetry!, raised: true } : onBack ? { label: 'Go back', onPress: onBack } : undefined}
      secondary={canRetry && onBack ? { label: 'Go back', onPress: onBack } : undefined}
    />
  );
}
