import type { HelpCategory } from '@/content/helpCenter';
import type { useTheme } from '@/theme';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

/** The theme colour a Help Center category is tinted with. */
export function helpTone(tone: HelpCategory['tone'], c: ThemeColors): string {
  switch (tone) {
    case 'success': return c.success;
    case 'error': return c.error;
    case 'pending': return c.pending;
    case 'accent': return c.accent;
    case 'live': return c.primaryLight;
    default: return c.primary;
  }
}
