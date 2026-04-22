// History screen — all caffeine logs grouped by day in reverse chronological order.
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const STORAGE_KEY = 'caffeine_logs';

// Returns the day number with the correct English ordinal suffix (1st, 2nd, 3rd, 4th…).
// The 11th/12th/13th edge case is handled by the leading guard: days 4–20 always use "th".
function getOrdinal(day: number) {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

// Formats a Unix timestamp into a human-readable date label, e.g. "Monday, April 21st".
function getFormattedDate(timestamp: number) {
  const date = new Date(timestamp);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = getOrdinal(date.getDate());
  return `${weekday}, ${month} ${day}`;
}

// Produces a stable string key that uniquely identifies a calendar day,
// used to group log entries together regardless of their exact time.
function getDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function HistoryScreen() {
  const theme = useAppTheme();
  // Recompute styles only when the theme changes (dark/light mode switch).
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [logs, setLogs] = useState<{ time: number; mg: number; name: string }[]>([]);

  // Reload logs whenever the user navigates back to this tab so edits made on
  // the Home screen are immediately visible here.
  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [])
  );

  async function loadLogs() {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) setLogs(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
  }

  // Group logs by calendar day (most recent first).
  // `seen` maps a dateKey to its index in `grouped` to avoid a second linear scan
  // when appending entries to an existing group.
  const grouped: { dateKey: string; dateLabel: string; entries: typeof logs }[] = [];
  const seen: Record<string, number> = {};

  [...logs].reverse().forEach(log => {
    const key = getDateKey(log.time);
    if (seen[key] === undefined) {
      seen[key] = grouped.length;
      grouped.push({ dateKey: key, dateLabel: getFormattedDate(log.time), entries: [log] });
    } else {
      grouped[seen[key]].entries.push(log);
    }
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {grouped.length === 0 && (
        <Text style={styles.emptyText}>No logs yet. Start tracking your caffeine!</Text>
      )}

      {grouped.map((group) => (
        <View key={group.dateKey} style={styles.group}>
          <Text style={styles.dateHeading}>{group.dateLabel}</Text>
          {group.entries.map((log, i) => (
            <View key={i} style={styles.logRow}>
              <Text style={styles.logName}>{log.name}</Text>
              <Text style={styles.logTime}>
                {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.logMg}>{log.mg}mg</Text>
            </View>
          ))}
        </View>
      ))}

      {/* Spacer so the last group isn't hidden behind the tab bar */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

type AppTheme = ReturnType<typeof useAppTheme>;

// Returns a theme-aware StyleSheet. Called inside useMemo so it only rebuilds on theme change.
function getStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.screenBackground },
    content: { padding: 40, paddingTop: 80 },
    emptyText: { color: theme.mutedText, fontFamily: 'Menlo', fontWeight: '400', fontSize: 13, textAlign: 'center', marginTop: 40 },
    group: { marginBottom: 24 },
    dateHeading: {
      fontSize: 18,
      fontWeight: '600',
      fontFamily: 'Georgia',
      color: theme.primaryText,
      marginBottom: 10,
      textAlign: 'center',
    },
    logRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    logName: { color: theme.primaryText, flex: 1, fontFamily: 'Menlo', fontWeight: '400' },
    logTime: { color: theme.secondaryText, fontSize: 13, fontFamily: 'Menlo', fontWeight: '400' },
    logMg: { color: theme.accent, fontSize: 13, marginLeft: 10, fontFamily: 'Menlo', fontWeight: '400' },
  });
}
