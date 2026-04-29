// mobile/components/dashboard/AnomalyBanner.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { AnomalyReport, Anomaly } from '@/types/health';

const METRIC_EMOJI: Record<string, string> = {
  sleep:     '🌙',
  stress:    '🧠',
  mood:      '😔',
  activity:  '🏃',
  water:     '💧',
  nutrition: '🥗',
};

const METRIC_LABELS: Record<string, string> = {
  sleep:     'Сон',
  stress:    'Стресс',
  mood:      'Настроение',
  activity:  'Активность',
  water:     'Вода',
  nutrition: 'Питание',
};

const TYPE_LABELS: Record<string, string> = {
  spike: 'выброс ↑',
  drop:  'падение ↓',
  trend: 'тренд ↓',
};

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
    container:    { gap: Spacing.sm },
    titleRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    titleText:    { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1 },
    count:        { fontSize: FontSize.xs, color: colors.mutedForeground },
    card:         { flexDirection: 'row', gap: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.sm },
    iconBox:      { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
    emoji:        { fontSize: 14 },
    cardBody:     { flex: 1, gap: 2 },
    cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    metricLabel:  { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
    tag:          { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    tagText:      { fontSize: 10, fontWeight: FontWeight.medium },
    message:      { fontSize: FontSize.sm, color: colors.foreground, lineHeight: 18 },
    detail:       { fontSize: FontSize.xs, color: colors.mutedForeground, marginTop: 2 },
    detailBold:   { fontWeight: FontWeight.medium, color: colors.foreground },
    qualityWrap:  { gap: 4 },
    qualityRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    qualityLabel: { fontSize: FontSize.xs, color: colors.mutedForeground },
    qualityPct:   { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: colors.foreground },
    qualityTrack: { height: 6, backgroundColor: colors.cardHover, borderRadius: 4, overflow: 'hidden' },
    qualityFill:  { height: '100%', borderRadius: 4 },
    gapText:      { fontSize: FontSize.xs, color: colors.mutedForeground },
    more:         { fontSize: FontSize.xs, color: colors.mutedForeground, textAlign: 'center' },
  }), [colors]);
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const s = useStyles();
  const isCrit  = anomaly.severity === 'critical';
  const isGap   = anomaly.type === 'gap';
  const emoji   = METRIC_EMOJI[anomaly.metric] ?? '⚠️';
  const label   = METRIC_LABELS[anomaly.metric] ?? anomaly.metric;
  const typeTag = isGap ? null : TYPE_LABELS[anomaly.type];

  const bg     = isCrit ? 'rgba(239,68,68,0.08)'  : 'rgba(245,158,11,0.08)';
  const border = isCrit ? 'rgba(239,68,68,0.25)'  : 'rgba(245,158,11,0.25)';
  const accent = isCrit ? '#f87171'                : '#fbbf24';
  const tagBg  = isCrit ? 'rgba(239,68,68,0.2)'   : 'rgba(245,158,11,0.2)';
  const tagClr = isCrit ? '#fca5a5'                : '#fcd34d';

  const deviationStr = anomaly.deviation != null
    ? `${anomaly.deviation}${
        anomaly.metric === 'mood' || anomaly.metric === 'stress' ? ' пункта' : '%'
      }`
    : null;

  return (
    <View style={[s.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={[s.iconBox, { backgroundColor: isCrit ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }]}>
        {isGap
          ? <Ionicons name="time-outline" size={16} color={accent} />
          : <Text style={s.emoji}>{emoji}</Text>
        }
      </View>
      <View style={s.cardBody}>
        <View style={s.cardHeader}>
          <Text style={[s.metricLabel, { color: accent }]}>
            {isGap ? 'Пропуск данных' : label}
          </Text>
          {typeTag && (
            <View style={[s.tag, { backgroundColor: tagBg }]}>
              <Text style={[s.tagText, { color: tagClr }]}>{typeTag}</Text>
            </View>
          )}
        </View>
        <Text style={s.message}>{anomaly.message}</Text>
        {anomaly.value != null && anomaly.norm != null && !isGap && (
          <Text style={s.detail}>
            Значение: <Text style={s.detailBold}>{anomaly.value}</Text>
            {' · '}
            Норма: <Text style={s.detailBold}>{anomaly.norm}</Text>
            {deviationStr ? ` · Откл.: ${deviationStr}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

function DataQualityBar({ quality, gapDays }: { quality: number; gapDays: number }) {
  const s = useStyles();
  if (quality >= 60 && gapDays < 2) return null;

  const barColor = quality >= 60 ? '#f59e0b' : quality >= 30 ? '#f97316' : '#ef4444';
  const text = quality >= 60
    ? 'Данных достаточно'
    : quality >= 30
      ? 'Мало данных — прогноз менее точный'
      : 'Критически мало данных';

  return (
    <View style={s.qualityWrap}>
      <View style={s.qualityRow}>
        <Text style={s.qualityLabel}>{text}</Text>
        <Text style={s.qualityPct}>{quality}%</Text>
      </View>
      <View style={s.qualityTrack}>
        <View style={[s.qualityFill, { width: `${quality}%` as any, backgroundColor: barColor }]} />
      </View>
      {gapDays >= 2 && (
        <Text style={s.gapText}>
          Последние данные: {gapDays}{' '}
          {gapDays === 1 ? 'день' : gapDays < 5 ? 'дня' : 'дней'} назад
        </Text>
      )}
    </View>
  );
}

interface Props {
  report: AnomalyReport;
}

export function AnomalyBanner({ report }: Props) {
  const s = useStyles();
  if (!report.hasAnomalies && report.dataQuality >= 60 && report.gapDays < 2) {
    return null;
  }

  const criticals = report.anomalies.filter(a => a.severity === 'critical');
  const warnings  = report.anomalies.filter(a => a.severity === 'warning');
  const shown     = [
    ...criticals.slice(0, 2),
    ...warnings.slice(0, Math.max(0, 3 - criticals.length)),
  ];

  const titleColor = report.hasCritical ? '#f87171' : '#fbbf24';
  const titleText  = report.hasCritical
    ? 'Обнаружены критические отклонения'
    : 'Обнаружены отклонения от нормы';

  return (
    <View style={s.container}>
      {report.hasAnomalies && (
        <View style={s.titleRow}>
          <Ionicons name="warning-outline" size={16} color={titleColor} />
          <Text style={[s.titleText, { color: titleColor }]}>{titleText}</Text>
          <Text style={s.count}>
            {report.anomalies.length}{' '}
            {report.anomalies.length === 1 ? 'аномалия' : 'аномалии'}
          </Text>
        </View>
      )}

      {shown.map((anomaly, i) => (
        <AnomalyCard key={`${anomaly.metric}-${anomaly.type}-${i}`} anomaly={anomaly} />
      ))}

      {report.anomalies.length > 3 && (
        <Text style={s.more}>+ ещё {report.anomalies.length - 3} отклонения</Text>
      )}

      <DataQualityBar quality={report.dataQuality} gapDays={report.gapDays} />
    </View>
  );
}
