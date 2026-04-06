import { AppColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAppTheme() {
  const scheme = useColorScheme() ?? 'light';
  return AppColors[scheme];
}
