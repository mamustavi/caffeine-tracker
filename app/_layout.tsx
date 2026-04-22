// Root layout — wraps the entire app in a navigation theme provider and sets up the screen stack.
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Expo Router uses this setting to determine the initial route when the app launches.
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // ThemeProvider from React Navigation syncs the navigation chrome (back buttons, headers)
    // with the device's light/dark mode preference.
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Main tab navigator — header is handled inside the tab layout */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Optional modal screen accessible via router.push('/modal') */}
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      {/* Status bar style is inferred automatically from the active colour scheme */}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
