import { useAppTheme } from '@/hooks/use-app-theme';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const STORAGE_KEY = 'caffeine_logs';
type LogEntry = { time: number; mg: number; name: string };
type AppTheme = ReturnType<typeof useAppTheme>;

// ── chart layout constants ────────────────────────────────────────────────────

const LINE_H         = 130;
const LINE_LEFT_PAD  = 38;
const LINE_RIGHT_PAD = 6;
const LINE_BOT_PAD   = 20;
const LINE_PLOT_H    = LINE_H - LINE_BOT_PAD;
const BAR_AREA_H    = 100;
const HOUR_AREA_H   = 64;

// heatmap
const CELL       = 11;
const GAP        = 2;
const STEP       = CELL + GAP;
const DOW_LBL_W  = 22;
const DOW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// ── date helpers ──────────────────────────────────────────────────────────────

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function shortDay(date: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

function shortMonth(m: number): string {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
}

function getDailyTotals(logs: LogEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of logs) {
    const k = dayKey(new Date(log.time));
    map.set(k, (map.get(k) ?? 0) + log.mg);
  }
  return map;
}

// ── heatmap colour ────────────────────────────────────────────────────────────

function heatColor(mg: number, isDark: boolean): string {
  if (mg <= 0) return isDark ? '#1B2638' : 'rgba(0,0,0,0.07)';
  if (mg < 100) return isDark ? 'rgba(215,38,61,0.28)' : 'rgba(215,38,61,0.22)';
  if (mg < 200) return isDark ? 'rgba(215,38,61,0.52)' : 'rgba(215,38,61,0.47)';
  if (mg < 300) return isDark ? 'rgba(215,38,61,0.76)' : 'rgba(215,38,61,0.70)';
  return '#D7263D';
}

// ── component ─────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const theme   = useAppTheme();
  const scheme  = useColorScheme();
  const isDark  = scheme === 'dark';
  const { width } = useWindowDimensions();
  const chartW  = width - 80;
  const styles  = useMemo(() => getStyles(theme), [theme]);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) setLogs(JSON.parse(raw));
    } catch {}
  }

  // ── data ───────────────────────────────────────────────────────────────────

  const daily = useMemo(() => getDailyTotals(logs), [logs]);

  // Overview cards
  const overview = useMemo(() => {
    const todayMg = daily.get(dayKey(new Date())) ?? 0;
    let weekSum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      weekSum += daily.get(dayKey(d)) ?? 0;
    }
    let peak = 0;
    daily.forEach(v => { if (v > peak) peak = v; });
    return {
      today:   Math.round(todayMg),
      weekAvg: Math.round(weekSum / 7),
      peak:    Math.round(peak),
    };
  }, [logs, daily]);

  // Heatmap — full calendar year (Jan 1 – Dec 31)
  const currentYear = new Date().getFullYear();
  const heatWeeks = useMemo(() => {
    const now = new Date(); now.setHours(23, 59, 59, 999);
    const year = now.getFullYear();

    // Start on the Sunday on or before Jan 1
    const jan1 = new Date(year, 0, 1);
    const start = new Date(jan1);
    start.setDate(start.getDate() - start.getDay());

    const dec31 = new Date(year, 11, 31);

    const weeks: { date: Date; mg: number; future: boolean }[][] = [];
    const cur = new Date(start);
    while (cur <= dec31) {
      const week: { date: Date; mg: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(cur); day.setDate(cur.getDate() + d);
        const inYear = day.getFullYear() === year;
        week.push({
          date:   new Date(day),
          mg:     daily.get(dayKey(day)) ?? 0,
          future: !inYear || day > now,
        });
      }
      weeks.push(week);
      cur.setDate(cur.getDate() + 7);
    }
    return weeks;
  }, [daily]);

  const monthLabels = useMemo(() => {
    const out: { idx: number; text: string }[] = [];
    let last = -1;
    heatWeeks.forEach((week, i) => {
      const m = week[0].date.getMonth();
      if (m !== last) { out.push({ idx: i, text: shortMonth(m) }); last = m; }
    });
    return out;
  }, [heatWeeks]);

  // 30-day line chart
  // Subtract card padding (16px each side) so SVG fits inside the card
  const lineChartW = chartW - 32;
  const lineData = useMemo(() => {
    const values = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      return daily.get(dayKey(d)) ?? 0;
    });
    const maxMg = Math.max(1, ...values);
    const plotW = lineChartW - LINE_LEFT_PAD - LINE_RIGHT_PAD;

    const pts = values.map((mg, i) => ({
      x:     LINE_LEFT_PAD + (i / 29) * plotW,
      y:     LINE_PLOT_H - (mg / maxMg) * LINE_PLOT_H,
      mg,
      label: i === 29 ? 'Today' : (29 - i) % 7 === 0 ? `${29 - i}d` : '',
    }));

    const gridLines = [0.25, 0.5, 0.75, 1].map(f => ({
      y:    LINE_PLOT_H - f * LINE_PLOT_H,
      text: `${Math.round(f * maxMg)}`,
    }));

    const linePath = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${LINE_PLOT_H} L ${LINE_LEFT_PAD} ${LINE_PLOT_H} Z`;

    return { pts, gridLines, linePath, areaPath };
  }, [daily, chartW]);

  // 7-day bars
  const barData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { label: 6 - i === 0 ? 'Today' : shortDay(d), mg: Math.round(daily.get(dayKey(d)) ?? 0) };
  }), [daily]);
  const maxBar = Math.max(1, ...barData.map(d => d.mg));

  // Peak hours
  const hourData = useMemo(() => {
    const h = new Array(24).fill(0);
    for (const log of logs) h[new Date(log.time).getHours()] += log.mg;
    return h;
  }, [logs]);
  const maxHour = Math.max(1, ...hourData);

  // Favourite drinks
  const topDrinks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) counts.set(log.name, (counts.get(log.name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);

  // ── empty state ─────────────────────────────────────────────────────────────

  if (logs.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.emptyText}>
          No logs yet. Start tracking your caffeine to see stats!
        </Text>
      </ScrollView>
    );
  }

  // ── render ──────────────────────────────────────────────────────────────────

  const gridColour = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Overview cards ──────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.summaryRow}>
        {([
          { value: overview.today,   label: 'Today' },
          { value: overview.weekAvg, label: '7-day avg' },
          { value: overview.peak,    label: 'Peak day' },
        ] as const).map(({ value, label }) => (
          <View key={label} style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{value}</Text>
            <Text style={styles.summaryUnit}>mg</Text>
            <Text style={styles.summaryLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Calendar-year heatmap ───────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{currentYear}</Text>
      <View style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Month labels */}
            <View style={{ height: 16, marginLeft: DOW_LBL_W, position: 'relative', width: heatWeeks.length * STEP }}>
              {monthLabels.map(({ idx, text }) => (
                <Text key={idx} style={[styles.heatMonthLabel, { position: 'absolute', left: idx * STEP }]}>
                  {text}
                </Text>
              ))}
            </View>

            {/* Grid */}
            <View style={{ flexDirection: 'row' }}>
              {/* Day-of-week labels */}
              <View style={{ width: DOW_LBL_W }}>
                {DOW_LABELS.map((l, i) => (
                  <View key={i} style={{ height: STEP, justifyContent: 'center' }}>
                    <Text style={styles.heatDowLabel}>{l}</Text>
                  </View>
                ))}
              </View>

              {/* Week columns */}
              {heatWeeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: 'column' }}>
                  {week.map((day, di) => (
                    <View
                      key={di}
                      style={{
                        width: CELL, height: CELL,
                        margin: GAP / 2, borderRadius: 2,
                        backgroundColor: day.future ? 'transparent' : heatColor(day.mg, isDark),
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* Legend */}
            <View style={styles.heatLegend}>
              <Text style={styles.heatLegendText}>Less</Text>
              {[0, 80, 160, 240, 320].map(mg => (
                <View key={mg} style={[styles.heatLegendCell, { backgroundColor: heatColor(mg, isDark) }]} />
              ))}
              <Text style={styles.heatLegendText}>More</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ── 30-day line chart ────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Past 30 Days</Text>
      <View style={styles.card}>
        <Svg width={lineChartW} height={LINE_H}>
          <Defs>
            <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.accent} stopOpacity={isDark ? 0.35 : 0.22} />
              <Stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Horizontal grid lines */}
          {lineData.gridLines.map((gl, i) => (
            <Line key={i}
              x1={LINE_LEFT_PAD} y1={gl.y} x2={lineChartW} y2={gl.y}
              stroke={gridColour} strokeWidth={1}
            />
          ))}

          {/* Y-axis labels */}
          {lineData.gridLines.map((gl, i) => (
            <SvgText key={i}
              x={LINE_LEFT_PAD - 4} y={gl.y + 4}
              fontSize={9} fill={theme.mutedText} textAnchor="end" fontFamily="Menlo"
            >
              {gl.text}
            </SvgText>
          ))}

          {/* Area fill */}
          <Path d={lineData.areaPath} fill="url(#lineGrad)" />

          {/* Line */}
          <Path
            d={lineData.linePath} fill="none"
            stroke={theme.accent} strokeWidth={2} strokeLinejoin="round"
          />

          {/* X-axis labels */}
          {lineData.pts.filter(p => p.label).map((p, i) => (
            <SvgText key={i}
              x={p.x} y={LINE_H - 3}
              fontSize={9} fill={theme.mutedText} textAnchor="middle" fontFamily="Menlo"
            >
              {p.label}
            </SvgText>
          ))}
        </Svg>
      </View>

      {/* ── 7-day bar chart ──────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Past 7 Days</Text>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {barData.map((d, i) => {
            const maxBarH = BAR_AREA_H - 18; // reserve 18px for value text
            const barH    = Math.max(d.mg > 0 ? 4 : 0, (d.mg / maxBar) * maxBarH);
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                {/* Bar + value stacked, anchored to bottom */}
                <View style={{ height: BAR_AREA_H, width: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Text style={styles.barValueText}>{d.mg > 0 ? d.mg : ''}</Text>
                  <View style={{
                    width: '75%', height: barH,
                    backgroundColor: theme.accent,
                    borderRadius: 5,
                    opacity: i === barData.length - 1 ? 1 : 0.65,
                    marginTop: 2,
                  }} />
                </View>
                <Text style={styles.barLabelText} numberOfLines={1}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Peak hours ───────────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>When You Drink</Text>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', height: HOUR_AREA_H + 22 }}>
          {hourData.map((mg, h) => {
            const barH = Math.max(mg > 0 ? 3 : 0, (mg / maxHour) * HOUR_AREA_H);
            return (
              <View key={h} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                  <View style={{
                    width: '80%', height: barH,
                    backgroundColor: theme.accent,
                    borderRadius: 3, opacity: 0.8,
                  }} />
                </View>
                <View style={{ height: 22, justifyContent: 'center' }}>
                  <Text style={styles.hourLabelText}>
                    {h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}` : `${h - 12}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Favourite drinks ─────────────────────────────────────────────────── */}
      {topDrinks.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Favourites</Text>
          <View style={styles.card}>
            {topDrinks.map(([name, count], i) => (
              <View
                key={i}
                style={[
                  styles.drinkRow,
                  i < topDrinks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.searchRowBorder },
                ]}
              >
                <Text style={styles.drinkRank}>{i + 1}</Text>
                <Text style={styles.drinkName} numberOfLines={1}>{name}</Text>
                <Text style={styles.drinkCount}>{count}×</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

function getStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.screenBackground },
    content:   { padding: 40, paddingTop: 80 },

    emptyText: {
      color: theme.mutedText, fontFamily: 'Menlo', fontSize: 13,
      textAlign: 'center', marginTop: 40,
    },

    sectionTitle: {
      fontSize: 18, fontWeight: '600', color: theme.primaryText,
      fontFamily: 'Georgia', textAlign: 'center', marginBottom: 12,
    },

    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 30, padding: 16, marginBottom: 28,
      borderWidth: 1, borderColor: theme.cardBorder,
    },

    // Overview cards
    summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
    summaryCard: {
      flex: 1, backgroundColor: theme.cardBackground,
      borderRadius: 24, padding: 14, alignItems: 'center',
      borderWidth: 1, borderColor: theme.cardBorder,
    },
    summaryValue: {
      fontSize: 26, fontWeight: 'bold', color: theme.primaryText,
      fontFamily: 'Georgia',
    },
    summaryUnit: {
      fontSize: 11, color: theme.accent,
      fontFamily: 'Menlo', marginTop: 1,
    },
    summaryLabel: {
      fontSize: 11, color: theme.secondaryText,
      fontFamily: 'Menlo', marginTop: 4, textAlign: 'center',
    },

    // Heatmap
    heatMonthLabel: { fontSize: 9, color: theme.mutedText, fontFamily: 'Menlo' },
    heatDowLabel:   { fontSize: 9, color: theme.mutedText, fontFamily: 'Menlo' },
    heatLegend: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      marginTop: 8, justifyContent: 'flex-end',
    },
    heatLegendCell: { width: 10, height: 10, borderRadius: 2 },
    heatLegendText: { fontSize: 9, color: theme.mutedText, fontFamily: 'Menlo' },

    // Bar chart
    barValueText: {
      fontSize: 9, color: theme.secondaryText, fontFamily: 'Menlo',
      height: 14, textAlign: 'center',
    },
    barLabelText: {
      fontSize: 9, color: theme.mutedText, fontFamily: 'Menlo',
      marginTop: 4, textAlign: 'center',
    },

    // Hours chart
    hourLabelText: { fontSize: 7, color: theme.mutedText, fontFamily: 'Menlo', textAlign: 'center' },

    // Favourites
    drinkRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    drinkRank: { fontSize: 13, color: theme.accent, fontFamily: 'Menlo', width: 20 },
    drinkName: { flex: 1, fontSize: 13, color: theme.primaryText, fontFamily: 'Menlo' },
    drinkCount: { fontSize: 13, color: theme.secondaryText, fontFamily: 'Menlo' },
  });
}
