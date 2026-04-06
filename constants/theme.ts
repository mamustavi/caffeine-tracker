/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// App-specific semantic color tokens
export const AppColors = {
  light: {
    screenBackground: '#EDE8DD',
    cardBackground: 'rgba(255,255,255,0.3)',
    cardBorder: '#ffffff',
    primaryText: '#2d2d2d',
    secondaryText: '#666',
    mutedText: '#999',
    accent: '#D7263D',
    searchRowBorder: 'rgba(255,255,255,0.5)',
    modalBackground: '#EDE8DD',
    modalOverlay: 'rgba(0,0,0,0.4)',
    placeholderText: '#999',
    tabBarBackground: 'rgba(255,255,255,0.3)',
    tabBarBorder: '#ffffff',
    tabActive: '#2d2d2d',
    tabInactive: '#999',
    pickerTextColor: '#2d2d2d',
    safeColor: '#628B48',
    warningColor: '#FF7F11',
  },
  dark: {
    screenBackground: '#111827',
    cardBackground: 'rgba(255,255,255,0.06)',
    cardBorder: 'rgba(255,255,255,0.12)',
    primaryText: '#E2E8F0',
    secondaryText: '#94A3B8',
    mutedText: '#64748B',
    accent: '#D7263D',
    searchRowBorder: 'rgba(255,255,255,0.08)',
    modalBackground: '#1A2535',
    modalOverlay: 'rgba(0,0,0,0.6)',
    placeholderText: '#64748B',
    tabBarBackground: 'rgba(17,24,39,0.97)',
    tabBarBorder: 'rgba(255,255,255,0.1)',
    tabActive: '#E2E8F0',
    tabInactive: '#4B5A6B',
    pickerTextColor: '#E2E8F0',
    safeColor: '#628B48',
    warningColor: '#FF7F11',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
