import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import caffeineDb from '../../assets/caffeine_db.json';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DRINKS = [
  { name: 'Espresso', mg: 64, emoji: '🫘' },
  { name: 'Coffee', mg: 95, emoji: '☕' },
  { name: 'Green Tea', mg: 28, emoji: '🍵' },
  { name: 'Black Tea', mg: 47, emoji: '🫖' },
  { name: 'Energy Drink', mg: 80, emoji: '⚡' },
  { name: 'Diet Coke', mg: 46, emoji: '🥤' },
];

const HALF_LIFE_HOURS = 5;
const SLEEP_SAFE_MG = 50;
const NOTIFY_AT_MG = 80;
const STORAGE_KEY = 'caffeine_logs';

function isToday(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getCurrentCaffeine(logs: { time: number; mg: number }[], atTime = Date.now()) {
  return logs.reduce((total, log) => {
    const hoursAgo = (atTime - log.time) / (1000 * 60 * 60);
    const remaining = log.mg * Math.pow(0.5, hoursAgo / HALF_LIFE_HOURS);
    return total + remaining;
  }, 0);
}

function getTimeUntilMg(logs: { time: number; mg: number }[], targetMg: number): number | null {
  const currentMg = getCurrentCaffeine(logs);
  if (currentMg <= targetMg) return null;
  const hoursUntil = (Math.log(currentMg / targetMg) / Math.log(2)) * HALF_LIFE_HOURS;
  return hoursUntil * 60 * 60 * 1000;
}

async function scheduleNotification(logs: { time: number; mg: number }[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const msUntilNotify = getTimeUntilMg(logs, NOTIFY_AT_MG);
  if (msUntilNotify === null || msUntilNotify <= 0) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Almost sleep safe 😴',
      body: 'Your caffeine will drop to a safe level in about 30 minutes!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.round(msUntilNotify / 1000),
    },
  });
}

async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export default function HomeScreen() {
  const [logs, setLogs] = useState<{ time: number; mg: number; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<ScrollView>(null);
  const searchRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [])
  );

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadLogs() {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) setLogs(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
  }

  async function saveLogs(updated: { time: number; mg: number; name: string }[]) {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
  }

  async function logDrink(name: string, mg: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newLog = { time: Date.now(), mg, name };
    const updated = [...logs, newLog];
    setLogs(updated);
    await saveLogs(updated);
    setSearchQuery('');
    const todaysUpdated = updated.filter(log => isToday(log.time));
    await scheduleNotification(todaysUpdated);
  }

  async function removeLog(time: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = logs.filter(log => log.time !== time);
    setLogs(updated);
    await saveLogs(updated);
    const todaysUpdated = updated.filter(log => isToday(log.time));
    await scheduleNotification(todaysUpdated);
  }

  function handleSearchFocus() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }

  const searchResults = searchQuery.length >= 2
    ? (caffeineDb as { name: string; caffeine_mg: number; type: string }[])
        .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  const todaysLogs = logs.filter(log => isToday(log.time));
  const currentMg = getCurrentCaffeine(todaysLogs);
  const safeToSleep = currentMg < SLEEP_SAFE_MG;
  const hoursUntilSleep = currentMg > SLEEP_SAFE_MG
    ? (Math.log(currentMg / SLEEP_SAFE_MG) / Math.log(2)) * HALF_LIFE_HOURS
    : 0;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Current Level Card */}
      <View style={[styles.card, { borderColor: safeToSleep ? '#628B48' : '#FF7F11' }]}>
        <Text style={styles.mgValue}>{Math.round(currentMg)} mg</Text>
        <Text style={styles.mgLabel}>currently in your system</Text>
        <View style={styles.sleepBadge}>
          <Text style={styles.sleepText}>
            {safeToSleep
              ? '✅ Safe to sleep'
              : `😴 Sleep-safe in ~${hoursUntilSleep.toFixed(1)} hrs`}
          </Text>
        </View>
      </View>

      {/* Log a Drink */}
      <Text style={styles.sectionTitle}>Log a Drink</Text>
      <View style={styles.drinkGrid}>
        {DRINKS.map((drink) => (
          <TouchableOpacity
            key={drink.name}
            style={styles.drinkButton}
            onPress={() => logDrink(drink.name, drink.mg)}
          >
            <Text style={styles.drinkEmoji}>{drink.emoji}</Text>
            <Text style={styles.drinkName}>{drink.name}</Text>
            <Text style={styles.drinkMg}>{drink.mg}mg</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Drinks */}
      <View ref={searchRef}>
        <Text style={styles.sectionTitle}>Search Drinks</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="e.g. Tim Hortons, Red Bull..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleSearchFocus}
        />
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((drink, i) => (
              <TouchableOpacity
                key={i}
                style={styles.searchRow}
                onPress={() => logDrink(drink.name, drink.caffeine_mg)}
              >
                <View style={styles.searchRowLeft}>
                  <Text style={styles.searchName}>{drink.name}</Text>
                  <Text style={styles.searchType}>{drink.type}</Text>
                </View>
                <Text style={styles.searchMg}>{drink.caffeine_mg}mg</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {searchQuery.length >= 2 && searchResults.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No drinks found</Text>
          </View>
        )}
      </View>

      {/* Today's Log */}
      {todaysLogs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Today's Log</Text>
          {[...todaysLogs].reverse().map((log, i) => (
            <View key={i} style={styles.logRow}>
              <Text style={styles.logName}>{log.name}</Text>
              <Text style={styles.logTime}>
                {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.logMg}>{log.mg}mg</Text>
              <TouchableOpacity onPress={() => removeLog(log.time)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 300 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDE8DD' },
  content: { padding: 40, paddingTop: 80 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  mgValue: { fontSize: 48, fontWeight: 'bold', color: '#2d2d2d', fontFamily: 'Georgia' },
  mgLabel: { fontSize: 12, color: '#666', marginTop: 4, fontFamily: 'Menlo', fontWeight: '400' },
  sleepBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  sleepText: { color: '#2d2d2d', fontSize: 14, fontFamily: 'Menlo', fontWeight: '400' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#2d2d2d', marginBottom: 12, fontFamily: 'Georgia', textAlign: 'center' },
  drinkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  drinkButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
    padding: 14,
    alignItems: 'center',
    width: '30%',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  drinkEmoji: { fontSize: 24 },
  drinkName: { color: '#2d2d2d', fontSize: 11, marginTop: 4, textAlign: 'center', fontFamily: 'Menlo', fontWeight: '400' },
  drinkMg: { color: '#D7263D', fontSize: 11, marginTop: 2, fontFamily: 'Menlo', fontWeight: '400' },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 14,
    fontFamily: 'Menlo',
    fontWeight: '400',
    color: '#2d2d2d',
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: 8,
  },
  searchResults: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: 8,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  searchRowLeft: { flex: 1 },
  searchName: { color: '#2d2d2d', fontSize: 13, fontFamily: 'Menlo', fontWeight: '400' },
  searchType: { color: '#999', fontSize: 11, fontFamily: 'Menlo', fontWeight: '400', marginTop: 2 },
  searchMg: { color: '#D7263D', fontSize: 13, fontFamily: 'Menlo', fontWeight: '400', marginLeft: 10 },
  noResults: { paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  noResultsText: { color: '#999', fontFamily: 'Menlo', fontWeight: '400', fontSize: 13 },
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
  deleteBtn: { marginLeft: 10, padding: 4, justifyContent: 'center', alignItems: 'center' },
  deleteText: { color: '#D7263D', fontSize: 16, fontWeight: 'bold', fontFamily: 'Menlo' },
});