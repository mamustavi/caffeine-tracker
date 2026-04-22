// Convenience hook that returns the correct semantic colour palette for the active colour scheme.
import { AppColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAppTheme() {
  // Fall back to 'light' when the scheme is undetermined (e.g. on web or during SSR).
  const scheme = useColorScheme() ?? 'light';
  return AppColors[scheme];
}
