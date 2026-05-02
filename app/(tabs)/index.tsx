// Home screen — log drinks, view current caffeine level, and manage today's entries.
import { useAppTheme } from '@/hooks/use-app-theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import caffeineDb from '../../assets/caffeinated_drinks.json';

// Show notifications even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Quick-log preset drinks shown as a grid on the home screen.
const DRINKS = [
  { name: 'Espresso', mg: 64, emoji: '🫘' },
  { name: 'Coffee', mg: 95, emoji: '☕' },
  { name: 'Green Tea', mg: 28, emoji: '🍵' },
  { name: 'Black Tea', mg: 47, emoji: '🫖' },
  { name: 'Energy Drink', mg: 80, emoji: '⚡' },
  { name: 'Diet Coke', mg: 46, emoji: '🥤' },
];

// Caffeine's biological half-life is roughly 5 hours in most adults.
const HALF_LIFE_HOURS = 5;
// Below this threshold the body is generally considered ready for sleep.
const SLEEP_SAFE_MG = 50;
// Send a heads-up notification when caffeine is about to drop to this level.
const NOTIFY_AT_MG = 80;
const STORAGE_KEY = 'caffeine_logs';
const CUSTOM_DRINKS_KEY = 'custom_drinks';

// Returns true if the given Unix timestamp falls on the current calendar day.
function isToday(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

// Calculates total active caffeine using exponential decay: mg × 0.5^(hours / half-life).
// Each log entry decays independently from the time it was consumed.
function getCurrentCaffeine(logs: { time: number; mg: number }[], atTime = Date.now()) {
  return logs.reduce((total, log) => {
    const hoursAgo = (atTime - log.time) / (1000 * 60 * 60);
    const remaining = log.mg * Math.pow(0.5, hoursAgo / HALF_LIFE_HOURS);
    return total + remaining;
  }, 0);
}

// Inverts the decay formula to find how many milliseconds until active caffeine reaches targetMg.
// Returns null if the level is already at or below the target.
function getTimeUntilMg(logs: { time: number; mg: number }[], targetMg: number): number | null {
  const currentMg = getCurrentCaffeine(logs);
  if (currentMg <= targetMg) return null;
  // Derived from: currentMg × 0.5^(t / half-life) = targetMg → t = log(currentMg/targetMg) / log(2) × half-life
  const hoursUntil = (Math.log(currentMg / targetMg) / Math.log(2)) * HALF_LIFE_HOURS;
  return hoursUntil * 60 * 60 * 1000;
}

// Cancels any existing scheduled notification and reschedules based on the current log state.
// The notification fires when active caffeine is predicted to reach NOTIFY_AT_MG.
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

// Prompts the user for notification permission on first launch.
async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export default function HomeScreen() {
  const theme = useAppTheme();
  // Recompute styles only when the theme changes (dark/light mode switch).
  const styles = useMemo(() => getStyles(theme), [theme]);

  // All caffeine logs across all time (today + history).
  const [logs, setLogs] = useState<{ time: number; mg: number; name: string }[]>([]);
  // User-created drinks persisted alongside the built-in database.
  const [customDrinks, setCustomDrinks] = useState<{ name: string; caffeine_mg: number; type: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Ticks every minute so the displayed caffeine level stays current without a full reload.
  const [now, setNow] = useState(Date.now());
  // Controls the time-edit picker modal — null means the modal is closed.
  const [editingLog, setEditingLog] = useState<{ time: number; mg: number; name: string } | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  // Controls the mg-edit modal — null means the modal is closed.
  const [editingMgLog, setEditingMgLog] = useState<{ time: number; mg: number; name: string } | null>(null);
  const [mgInput, setMgInput] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMg, setCustomMg] = useState('');
  const [customTime, setCustomTime] = useState(new Date());
  const scrollRef = useRef<ScrollView>(null);
  const searchRef = useRef<View>(null);

  // Reload logs whenever the user navigates back to this tab.
  useFocusEffect(
    useCallback(() => {
      loadLogs();
      loadCustomDrinks();
    }, [])
  );

  // Request notification permission once on mount.
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Tick every 60 seconds so the decay calculation in the render is always fresh.
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

  async function loadCustomDrinks() {
    try {
      const raw = await SecureStore.getItemAsync(CUSTOM_DRINKS_KEY);
      if (raw) setCustomDrinks(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to load custom drinks:', e);
    }
  }

  async function saveLogs(updated: { time: number; mg: number; name: string }[]) {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
  }

  async function saveCustomDrinks(updated: { name: string; caffeine_mg: number; type: string }[]) {
    try {
      await SecureStore.setItemAsync(CUSTOM_DRINKS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save custom drinks:', e);
    }
  }

  // Adds a new log entry stamped with the current time and reschedules the notification.
  async function logDrink(name: string, mg: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newLog = { time: Date.now(), mg, name };
    const updated = [...logs, newLog];
    setLogs(updated);
    await saveLogs(updated);
    setSearchQuery('');
    // Notifications are based only on today's intake, not historical logs.
    const todaysUpdated = updated.filter(log => isToday(log.time));
    await scheduleNotification(todaysUpdated);
  }

  // Removes a log entry by its timestamp and updates the notification schedule.
  async function removeLog(time: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = logs.filter(log => log.time !== time);
    setLogs(updated);
    await saveLogs(updated);
    const todaysUpdated = updated.filter(log => isToday(log.time));
    await scheduleNotification(todaysUpdated);
  }

  // Opens the time-picker modal pre-filled with the log's existing timestamp.
  function openTimePicker(log: { time: number; mg: number; name: string }) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingLog(log);
    setPickerDate(new Date(log.time));
  }

  // Commits the time change selected in the picker and re-schedules notifications.
  async function confirmTimeEdit(selectedDate: Date) {
    if (!editingLog) return;
    const updated = logs.map(log =>
      log.time === editingLog.time
        ? { ...log, time: selectedDate.getTime() }
        : log
    );
    setLogs(updated);
    await saveLogs(updated);
    const todaysUpdated = updated.filter(log => isToday(log.time));
    await scheduleNotification(todaysUpdated);
    setEditingLog(null);
  }

  // Opens the mg-edit modal pre-filled with the log's current caffeine value.
  function openMgEditor(log: { time: number; mg: number; name: string }) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingMgLog(log);
    setMgInput(String(log.mg));
  }

  // Validates and commits the edited mg value, then re-schedules notifications.
  async function confirmMgEdit() {
    if (!editingMgLog) return;
    const parsed = parseInt(mgInput);
    if (isNaN(parsed) || parsed <= 0) return;
    const updated = logs.map(log =>
      log.time === editingMgLog.time
        ? { ...log, mg: parsed }
        : log
    );
    setLogs(updated);
    await saveLogs(updated);
    const todaysUpdated = updated.filter(log => isToday(log.time));
    await scheduleNotification(todaysUpdated);
    setEditingMgLog(null);
  }

  // Resets the custom drink form fields and opens the modal.
  function openCustomModal() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomName('');
    setCustomMg('');
    setCustomTime(new Date());
    setShowCustomModal(true);
  }

  // Logs the custom drink with the chosen time and saves it to the custom drinks database
  // if it doesn't already exist there (case-insensitive name match).
  async function confirmCustomDrink() {
    const parsedMg = parseInt(customMg);
    if (!customName.trim() || isNaN(parsedMg) || parsedMg <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newLog = { time: customTime.getTime(), mg: parsedMg, name: customName.trim() };
    const updatedLogs = [...logs, newLog];
    setLogs(updatedLogs);
    await saveLogs(updatedLogs);

    // Persist new custom drinks so they appear in future search results.
    const alreadyExists = customDrinks.some(
      d => d.name.toLowerCase() === customName.trim().toLowerCase()
    );
    if (!alreadyExists) {
      const updatedCustom = [...customDrinks, {
        name: customName.trim(),
        caffeine_mg: parsedMg,
        type: 'Custom',
      }];
      setCustomDrinks(updatedCustom);
      await saveCustomDrinks(updatedCustom);
    }

    const todaysUpdated = updatedLogs.filter(log => isToday(log.time));
    await scheduleNotification(todaysUpdated);
    setShowCustomModal(false);
  }

  // Delays the scroll slightly to let the keyboard animation finish first.
  function handleSearchFocus() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }

  // Merge the built-in caffeine database with user-created custom drinks for search.
  const allDrinks = [
    ...(caffeineDb as { name: string; caffeine_mg: number; type: string }[]),
    ...customDrinks,
  ];

  // Only search when the user has typed at least 2 characters, limit to 8 results.
  const searchResults = searchQuery.length >= 2
    ? allDrinks
        .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  // Derived display values — recalculate on each render since `now` ticks every minute.
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
      // Allow tapping search results without dismissing the keyboard first.
      keyboardShouldPersistTaps="handled"
    >
      {/* Current Level Card — border colour signals safe vs. warning state */}
      <View style={[styles.card, { borderColor: safeToSleep ? theme.safeColor : theme.warningColor }]}>
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

      {/* Log a Drink — preset buttons for the most common drinks */}
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

      {/* Search Drinks — searches across built-in + custom drink databases */}
      <View ref={searchRef}>
        <Text style={styles.sectionTitle}>Search Drinks</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="e.g. Tim Hortons, Red Bull..."
          placeholderTextColor={theme.placeholderText}
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

      {/* Add Custom Drink button — opens modal to log an unlisted drink */}
      <TouchableOpacity style={styles.customDrinkBtn} onPress={openCustomModal}>
        <Text style={styles.customDrinkBtnText}>+ Add Custom Drink</Text>
      </TouchableOpacity>

      {/* Today's Log — shown in reverse chronological order; tap time/mg to edit */}
      {todaysLogs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Today's Log</Text>
          {[...todaysLogs].reverse().map((log, i) => (
            <View key={i} style={styles.logRow}>
              <Text style={styles.logName}>{log.name}</Text>
              {/* Tap the time to open the time-picker modal */}
              <TouchableOpacity onPress={() => openTimePicker(log)}>
                <Text style={styles.logTime}>
                  {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
              {/* Tap the mg value to open the inline mg editor */}
              <TouchableOpacity onPress={() => openMgEditor(log)}>
                <Text style={styles.logMg}>{log.mg}mg</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeLog(log.time)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Spacer so content isn't hidden behind the tab bar */}
      <View style={{ height: 300 }} />

      {/* Time Picker Modal — lets the user correct when a drink was consumed */}
      {editingLog && (
        <Modal transparent animationType="slide" visible={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Time</Text>
              <Text style={styles.modalSubtitle}>{editingLog.name}</Text>
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display="spinner"
                onChange={(_, selected) => {
                  if (selected) setPickerDate(selected);
                }}
                maximumDate={new Date()}
                textColor={theme.pickerTextColor}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingLog(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={() => confirmTimeEdit(pickerDate)}
                >
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Caffeine mg Editor Modal — allows correcting the logged caffeine amount */}
      {editingMgLog && (
        <Modal transparent animationType="slide" visible={true}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior="padding"
          >
            {/* Tapping the backdrop dismisses the modal */}
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setEditingMgLog(null)}
            />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Caffeine</Text>
              <Text style={styles.modalSubtitle}>{editingMgLog.name}</Text>
              <TextInput
                style={styles.mgEditorInput}
                value={mgInput}
                onChangeText={setMgInput}
                keyboardType="number-pad"
                placeholder="Enter mg"
                placeholderTextColor={theme.placeholderText}
                autoFocus
              />
              <Text style={styles.mgEditorUnit}>mg</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingMgLog(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={confirmMgEdit}
                >
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Custom Drink Modal — log a drink not in the built-in database */}
      {showCustomModal && (
        <Modal transparent animationType="slide" visible={true}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior="padding"
          >
            {/* Tapping the backdrop dismisses the modal */}
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowCustomModal(false)}
            />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Custom Drink</Text>
              <TextInput
                style={styles.customInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder="Drink name"
                placeholderTextColor={theme.placeholderText}
                autoFocus
              />
              <TextInput
                style={styles.customInput}
                value={customMg}
                onChangeText={setCustomMg}
                placeholder="Caffeine amount (mg)"
                placeholderTextColor={theme.placeholderText}
                keyboardType="number-pad"
              />
              <Text style={styles.customTimeLabel}>Time consumed</Text>
              <DateTimePicker
                value={customTime}
                mode="time"
                display="spinner"
                onChange={(_, selected) => {
                  if (selected) setCustomTime(selected);
                }}
                maximumDate={new Date()}
                textColor={theme.pickerTextColor}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowCustomModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={confirmCustomDrink}
                >
                  <Text style={styles.modalConfirmText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
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
      alignItems: 'center',
      marginBottom: 28,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    mgValue: { fontSize: 48, fontWeight: 'bold', color: theme.primaryText, fontFamily: 'Georgia' },
    mgLabel: { fontSize: 12, color: theme.secondaryText, marginTop: 4, fontFamily: 'Menlo', fontWeight: '400' },
    sleepBadge: {
      marginTop: 12,
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    sleepText: { color: theme.primaryText, fontSize: 14, fontFamily: 'Menlo', fontWeight: '400' },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.primaryText, marginBottom: 12, fontFamily: 'Georgia', textAlign: 'center' },
    drinkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
    drinkButton: {
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      padding: 14,
      alignItems: 'center',
      width: '30%',
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    drinkEmoji: { fontSize: 24 },
    drinkName: { color: theme.primaryText, fontSize: 11, marginTop: 4, textAlign: 'center', fontFamily: 'Menlo', fontWeight: '400' },
    drinkMg: { color: theme.accent, fontSize: 11, marginTop: 2, fontFamily: 'Menlo', fontWeight: '400' },
    searchInput: {
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      paddingVertical: 12,
      paddingHorizontal: 20,
      fontSize: 14,
      fontFamily: 'Menlo',
      fontWeight: '400',
      color: theme.primaryText,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginBottom: 8,
    },
    searchResults: {
      backgroundColor: theme.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.cardBorder,
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
      borderBottomColor: theme.searchRowBorder,
    },
    searchRowLeft: { flex: 1 },
    searchName: { color: theme.primaryText, fontSize: 13, fontFamily: 'Menlo', fontWeight: '400' },
    searchType: { color: theme.mutedText, fontSize: 11, fontFamily: 'Menlo', fontWeight: '400', marginTop: 2 },
    searchMg: { color: theme.accent, fontSize: 13, fontFamily: 'Menlo', fontWeight: '400', marginLeft: 10 },
    noResults: { paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
    noResultsText: { color: theme.mutedText, fontFamily: 'Menlo', fontWeight: '400', fontSize: 13 },
    customDrinkBtn: {
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginTop: 8,
      marginBottom: 8,
    },
    customDrinkBtnText: { color: theme.primaryText, fontFamily: 'Menlo', fontWeight: '400', fontSize: 14 },
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
    // Underline signals the field is tappable/editable.
    logTime: { color: theme.secondaryText, fontSize: 13, fontFamily: 'Menlo', fontWeight: '400', textDecorationLine: 'underline', marginLeft: 10 },
    logMg: { color: theme.accent, fontSize: 13, marginLeft: 20, fontFamily: 'Menlo', fontWeight: '400', textDecorationLine: 'underline' },
    deleteBtn: { marginLeft: 10, padding: 4, justifyContent: 'center', alignItems: 'center' },
    deleteText: { color: theme.accent, fontSize: 16, fontWeight: 'bold', fontFamily: 'Menlo' },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.modalBackground,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      padding: 30,
      paddingTop: 50,
      paddingBottom: 30,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', fontFamily: 'Georgia', color: theme.primaryText, textAlign: 'center', marginBottom: 12 },
    modalSubtitle: { fontSize: 13, fontFamily: 'Menlo', color: theme.secondaryText, textAlign: 'center', marginBottom: 12 },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 30,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      alignItems: 'center',
    },
    modalCancelText: { color: theme.secondaryText, fontFamily: 'Menlo', fontWeight: '400' },
    modalConfirmBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 30,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    modalConfirmText: { color: '#ffffff', fontFamily: 'Menlo', fontWeight: '400' },
    mgEditorInput: {
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      paddingVertical: 12,
      paddingHorizontal: 20,
      fontSize: 24,
      fontFamily: 'Menlo',
      fontWeight: '400',
      color: theme.primaryText,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      textAlign: 'center',
      marginTop: 12,
    },
    mgEditorUnit: { textAlign: 'center', color: theme.secondaryText, fontFamily: 'Menlo', fontWeight: '400', fontSize: 13, marginTop: 6 },
    customInput: {
      backgroundColor: theme.cardBackground,
      borderRadius: 30,
      paddingVertical: 12,
      paddingHorizontal: 20,
      fontSize: 14,
      fontFamily: 'Menlo',
      fontWeight: '400',
      color: theme.primaryText,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginBottom: 12,
    },
    customTimeLabel: { fontSize: 13, fontFamily: 'Menlo', color: theme.secondaryText, textAlign: 'center', marginBottom: 4 },
  });
}
