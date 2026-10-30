/**
 * A wallet figure that gives way to a loading placeholder while its balance is being refreshed, then shows the new
 * amount. Pass `syncing` false while the balance is hidden, so the masked dots stay put.
 */
import { View, Text, type DimensionValue, type TextProps } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

type Props = TextProps & {
  syncing: boolean;
  /** Size of the placeholder, to match the figure it stands in for so nothing jumps. */
  width?: DimensionValue;
  height?: number;
};

export function LiveAmount({ syncing, width = '55%', height = 28, children, ...textProps }: Props) {
  if (syncing) {
    return (
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Updating balance">
        <Skeleton width={width} height={height} />
      </View>
    );
  }
  return <Text {...textProps}>{children}</Text>;
}
