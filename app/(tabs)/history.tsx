import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const STORAGE_KEY = 'caffeine_logs';

function getOrdinal(day: number) {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function getFormattedDate(timestamp: number) {
  const date = new Date(timestamp);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = getOrdinal(date.getDate());
  return `${weekday}, ${month} ${day}`;
}

function getDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function HistoryScreen() {
  const [logs, setLogs] = useState<{ time: number; mg: number; name: string }[]>([]);

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

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDE8DD' },
  content: { padding: 40, paddingTop: 80 },
  emptyText: { color: '#999', fontFamily: 'Menlo', fontWeight: '400', fontSize: 13, textAlign: 'center', marginTop: 40 },
  group: { marginBottom: 24 },
  dateHeading: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Georgia',
    color: '#2d2d2d',
    marginBottom: 10,
    textAlign: 'center',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  logName: { color: '#2d2d2d', flex: 1, fontFamily: 'Menlo', fontWeight: '400' },
  logTime: { color: '#666', fontSize: 13, fontFamily: 'Menlo', fontWeight: '400' },
  logMg: { color: '#D7263D', fontSize: 13, marginLeft: 10, fontFamily: 'Menlo', fontWeight: '400' },
});