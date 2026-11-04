import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'
import type { Anomaly, AnomalyMetric, AnomalyReport } from '@/types/health'

const METRIC_ICONS: Record<AnomalyMetric, keyof typeof Ionicons.glyphMap> = {
  sleep: 'moon-outline',
  stress: 'alert-circle-outline',
  mood: 'happy-outline',
  activity: 'flame-outline',
  water: 'water-outline',
  nutrition: 'restaurant-outline',
}

const METRIC_LABELS: Record<AnomalyMetric, string> = {
  sleep: 'Сон',
  stress: 'Стресс',
  mood: 'Настроение',
  activity: 'Активность',
  water: 'Вода',
  nutrition: 'Питание',
}

function getTypeLabel(anomaly: Anomaly) {
  if (anomaly.type === 'spike') return 'резкий всплеск'
  if (anomaly.type === 'drop') return 'резкое снижение'
  if (anomaly.type === 'trend') return 'негативный тренд'
  return 'пропуск данных'
}

function getQualityLabel(quality: number) {
  if (quality >= 60) return 'Данных достаточно, но есть свежие пропуски.'
  if (quality >= 30) return 'Данных пока мало, поэтому прогноз менее устойчив.'
  return 'Данных критически мало для уверенного персонального прогноза.'
}

function getGapLabel(gapDays: number) {
  const mod10 = gapDays % 10
  const mod100 = gapDays % 100

  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

function useStyles() {
  const { colors } = useTheme()

  return useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    headerIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.foreground,
    },
    headerText: {
      marginTop: 4,
      fontSize: FontSize.sm,
      color: colors.mutedForeground,
      lineHeight: 20,
    },
    countBadge: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    countText: {
      fontSize: FontSize.xs,
      color: colors.mutedForeground,
      fontWeight: FontWeight.medium,
    },
    list: {
      gap: Spacing.sm,
    },
    card: {
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      padding: Spacing.sm,
      gap: Spacing.sm,
    },
    cardRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'flex-start',
    },
    cardIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardBody: {
      flex: 1,
      gap: 6,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    metricLabel: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    typeBadge: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    typeText: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontWeight: FontWeight.medium,
    },
    message: {
      fontSize: FontSize.sm,
      color: colors.foreground,
      lineHeight: 20,
    },
    detail: {
      fontSize: FontSize.xs,
      color: colors.mutedForeground,
      lineHeight: 18,
    },
    detailStrong: {
      color: colors.foreground,
      fontWeight: FontWeight.medium,
    },
    qualityCard: {
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: Spacing.sm,
      gap: Spacing.sm,
    },
    qualityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    qualityTitle: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      color: colors.foreground,
    },
    qualityText: {
      marginTop: 4,
      fontSize: FontSize.sm,
      color: colors.mutedForeground,
      lineHeight: 20,
    },
    qualityValue: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.foreground,
    },
    track: {
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.cardHover,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 999,
    },
    gapText: {
      fontSize: FontSize.xs,
      color: colors.mutedForeground,
    },
    more: {
      fontSize: FontSize.xs,
      color: colors.mutedForeground,
    },
  }), [colors])
}

function QualitySummary({ quality, gapDays }: { quality: number; gapDays: number }) {
  const s = useStyles()

  if (quality >= 60 && gapDays < 2) return null

  const barColor = quality >= 60 ? '#f59e0b' : quality >= 30 ? '#f97316' : '#ef4444'

  return (
    <View style={s.qualityCard}>
      <View style={s.qualityHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.qualityTitle}>Качество данных</Text>
          <Text style={s.qualityText}>{getQualityLabel(quality)}</Text>
        </View>
        <Text style={s.qualityValue}>{quality}%</Text>
      </View>

      <View style={s.track}>
        <View style={[s.fill, { width: `${quality}%` as any, backgroundColor: barColor }]} />
      </View>

      {gapDays >= 2 ? (
        <Text style={s.gapText}>Последняя запись была {gapDays} {getGapLabel(gapDays)} назад.</Text>
      ) : null}
    </View>
  )
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const s = useStyles()
  const isCritical = anomaly.severity === 'critical'
  const isGap = anomaly.type === 'gap'
  const accent = isCritical ? '#f87171' : '#fbbf24'
  const iconBg = isCritical ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)'
  const cardBg = isCritical ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)'
  const border = isCritical ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'
  const icon = isGap ? 'time-outline' : (METRIC_ICONS[anomaly.metric] ?? 'alert-circle-outline')
  const label = isGap ? 'Пропуск данных' : (METRIC_LABELS[anomaly.metric] ?? anomaly.metric)

  return (
    <View style={[s.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={s.cardRow}>
        <View style={[s.cardIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>

        <View style={s.cardBody}>
          <View style={s.cardMeta}>
            <Text style={[s.metricLabel, { color: accent }]}>{label}</Text>
            <View style={s.typeBadge}>
              <Text style={s.typeText}>{getTypeLabel(anomaly)}</Text>
            </View>
          </View>

          <Text style={s.message}>{anomaly.message}</Text>

          {anomaly.value != null && anomaly.norm != null && !isGap ? (
            <Text style={s.detail}>
              Текущее значение: <Text style={s.detailStrong}>{anomaly.value}</Text>
              {' · '}
              Норма: <Text style={s.detailStrong}>{anomaly.norm}</Text>
              {anomaly.deviation != null ? (
                <>
                  {' · '}
                  Отклонение: {anomaly.deviation}
                  {anomaly.metric === 'mood' || anomaly.metric === 'stress' ? ' пункта' : '%'}
                </>
              ) : null}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

interface Props {
  report: AnomalyReport
}

export function AnomalyBanner({ report }: Props) {
  const s = useStyles()

  if (!report.hasAnomalies && report.dataQuality >= 60 && report.gapDays < 2) {
    return null
  }

  const criticals = report.anomalies.filter(item => item.severity === 'critical')
  const warnings = report.anomalies.filter(item => item.severity === 'warning')
  const shown = [
    ...criticals.slice(0, 1),
    ...warnings.slice(0, Math.max(0, 2 - Math.min(1, criticals.length))),
  ]
  const titleColor = report.hasCritical ? '#f87171' : '#fbbf24'
  const iconBg = report.hasCritical ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)'
  const summaryTitle = report.hasCritical ? 'Есть сигналы, требующие внимания' : 'Есть сигналы для наблюдения'

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.headerIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name="warning-outline" size={20} color={titleColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{summaryTitle}</Text>
            <Text style={s.headerText}>Показываем только самые важные отклонения, чтобы экран не перегружался.</Text>
          </View>
        </View>

        {report.hasAnomalies ? (
          <View style={s.countBadge}>
            <Text style={s.countText}>{report.anomalies.length} шт.</Text>
          </View>
        ) : null}
      </View>

      {shown.length > 0 ? (
        <View style={s.list}>
          {shown.map((anomaly, index) => (
            <AnomalyCard key={`${anomaly.metric}-${anomaly.type}-${index}`} anomaly={anomaly} />
          ))}
        </View>
      ) : null}

      {report.anomalies.length > shown.length ? (
        <Text style={s.more}>Ещё {report.anomalies.length - shown.length} сигнал(ов) скрыто в сводке, чтобы не перегружать экран.</Text>
      ) : null}

      <QualitySummary quality={report.dataQuality} gapDays={report.gapDays} />
    </View>
  )
}
