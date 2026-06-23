/**
 * Live window-size hook with sensible breakpoints.
 *
 * Wraps `useWindowDimensions` so consumers re-render on:
 *   • device rotation (portrait ↔ landscape)
 *   • iPad / Android tablet split-screen / multi-window
 *   • browser window resize when bundled for web
 *
 * Module-level `Dimensions.get('window')` only fires once at JS-bundle
 * load, so anywhere a screen does `const cell = (width - …) / N` at
 * module scope, the math is frozen until reload. This hook fixes that.
 */
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'regular' | 'large' | 'xlarge';

export type Responsive = {
  width: number;
  height: number;
  /** Tiny phones (iPhone SE, Pixel 4a 5G) up to 360 px wide. */
  isCompact: boolean;
  /** Most modern phones 360–430 px wide. */
  isRegular: boolean;
  /** Foldables open + small tablets. */
  isLarge: boolean;
  /** iPad-class + web window > 1024 px. */
  isXLarge: boolean;
  breakpoint: Breakpoint;
  isLandscape: boolean;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return useMemo<Responsive>(() => {
    const breakpoint: Breakpoint =
      width < 360 ? 'compact' : width < 600 ? 'regular' : width < 1024 ? 'large' : 'xlarge';
    return {
      width,
      height,
      isCompact: breakpoint === 'compact',
      isRegular: breakpoint === 'regular',
      isLarge: breakpoint === 'large',
      isXLarge: breakpoint === 'xlarge',
      breakpoint,
      isLandscape: width > height,
    };
  }, [width, height]);
}

/**
 * Number of columns for a responsive grid based on the current window
 * width. Tweak via the second argument when a screen needs a different
 * fit (e.g. small thumbnails want more columns).
 */
export function useGridColumns(target: { min?: number; max?: number; itemMinWidth?: number } = {}): number {
  const { width } = useWindowDimensions();
  const itemMinWidth = target.itemMinWidth ?? 160;
  const min = target.min ?? 2;
  const max = target.max ?? 4;
  return useMemo(() => {
    const cols = Math.max(min, Math.min(max, Math.floor(width / itemMinWidth)));
    return cols;
  }, [width, itemMinWidth, min, max]);
}
