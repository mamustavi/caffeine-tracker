// About screen — developer info, app philosophy, and a link to the source code.
import { useAppTheme } from '@/hooks/use-app-theme';
import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AboutScreen() {
  const theme = useAppTheme();
  // Recompute styles only when the theme changes (dark/light mode switch).
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.card}>
        <Text style={styles.heading}>About this App</Text>
        <Text style={styles.body}>
          This app aims to provide a privacy first, free, and open source alternative to other caffeine trackers. No accounts, no subscriptions, no data collection. Everything stays on your device.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Privacy Policy</Text>
        <Text style={styles.body}>
          eluent does not collect, store, or share any personal data. All caffeine logs are saved locally on your device using encrypted storage and are never transmitted anywhere.{'\n\n'}
          No analytics, no tracking, no third-party SDKs. Your data is yours.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Source Code</Text>
        <Text style={styles.body}>
          This app is fully open source. You can view, fork, and contribute to the codebase on GitHub.
        </Text>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => Linking.openURL('https://github.com/mamustavi')}
        >
          <Text style={styles.linkText}>View on GitHub →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>About the Developer</Text>
        <Text style={styles.body}>
          Adnan Mustavi is a clinical researcher, data analyst, and app developer based in Toronto, Canada.
        </Text>
      </View>

    </ScrollView>
  );
}

type AppTheme = ReturnType<typeof useAppTheme>;

// Returns a theme-aware StyleSheet. Called inside useMemo so it only rebuilds on theme change.
function getStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.screenBackground },
    content: { padding: 40, paddingTop: 80 },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      padding: 24,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    heading: {
      fontSize: 18,
      fontWeight: '600',
      fontFamily: 'Georgia',
      color: theme.primaryText,
      marginBottom: 12,
      textAlign: 'center',
    },
    body: {
      fontFamily: 'Menlo',
      fontWeight: '400',
      fontSize: 13,
      color: theme.primaryText,
      lineHeight: 22,
    },
    linkButton: {
      marginTop: 14,
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      alignSelf: 'flex-start',
    },
    linkText: {
      fontFamily: 'Menlo',
      fontWeight: '400',
      fontSize: 13,
      color: theme.accent,
    },
  });
}
