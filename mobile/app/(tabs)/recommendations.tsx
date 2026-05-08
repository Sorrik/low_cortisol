import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  LayoutAnimation,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AnomalyBanner } from '@/components/dashboard/AnomalyBanner'
import { ProgressBar } from '@/components/dashboard/ProgressBar'
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme'
import { useTheme } from '@/context/ThemeContext'
import { getInsights, submitRecommendationFeedback } from '@/lib/health-api'
import type { FeedbackRating } from '@/lib/health-api'
import { ColorPalette, useThemedStyles } from '@/lib/useThemedStyles'
import { useAuthStore } from '@/store/auth.store'
import type { ArticleSource, Recommendation, MetricType } from '@/types/health'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const buildMetricConfig = (colors: ColorPalette): Record<MetricType, {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  color: string
  bgColor: string
}> => ({
  sleep: { icon: 'moon', label: 'Сон', color: colors.sleep, bgColor: colors.sleepMuted },
  food: { icon: 'restaurant', label: 'Питание', color: colors.nutrition, bgColor: colors.nutritionMuted },
  mood: { icon: 'happy', label: 'Настроение', color: colors.mood, bgColor: colors.moodMuted },
  stress: { icon: 'pulse', label: 'Стресс', color: colors.stress, bgColor: colors.stressMuted },
  activity: { icon: 'flame', label: 'Активность', color: colors.activity, bgColor: colors.activityMuted },
  water: { icon: 'water', label: 'Вода', color: colors.water, bgColor: colors.waterMuted },
})

const buildSeverityConfig = (colors: ColorPalette) => ({
  alert: { label: 'Требует внимания', icon: 'alert-circle' as const, color: colors.destructive, bgColor: colors.destructiveMuted },
  attention: { label: 'Можно улучшить', icon: 'warning' as const, color: colors.warning, bgColor: colors.warningMuted },
  good: { label: 'Хорошие показатели', icon: 'checkmark-circle' as const, color: colors.success, bgColor: colors.successMuted },
})

const phaseLabels: Record<string, { label: string; desc: string; qualityHint: string }> = {
  cold_start: {
    label: 'Начальный этап',
    desc: 'Система собирает первые данные о вашем состоянии.',
    qualityHint: 'Советы строятся на базовых закономерностях и будут уточняться по мере накопления данных.',
  },
  learning: {
    label: 'Этап обучения',
    desc: 'Модель изучает ваши паттерны и уточняет прогнозы.',
    qualityHint: 'Рекомендации уже полезны, но точность персонального прогноза пока повышается.',
  },
  personal: {
    label: 'Персональная модель',
    desc: 'Рекомендации уже адаптированы под вашу личную историю.',
    qualityHint: 'Система опирается на вашу накопленную историю и лучше учитывает личные паттерны.',
  },
}

function getReasonText(rec: Recommendation) {
  const metricLabels: Record<MetricType, string> = {
    sleep: 'Сон',
    food: 'Питание',
    mood: 'Настроение',
    stress: 'Стресс',
    activity: 'Активность',
    water: 'Вода',
  }

  const label = metricLabels[rec.metric] ?? 'Показатель'

  if (rec.severity === 'alert') {
    return `${label}: показатель требует внимания и может сильнее влиять на общее состояние.`
  }

  if (rec.severity === 'attention') {
    return `${label}: есть потенциал для улучшения в ближайшие дни.`
  }

  return `${label}: показатель сейчас выглядит стабильным, важно сохранить этот уровень.`
}

function getReferencedSources(text: string, sources: ArticleSource[]) {
  const indexes = Array.from(new Set(
    Array.from(text.matchAll(/\[(\d+)\]/g)).map(match => Number(match[1])),
  ))

  return indexes
    .map(index => sources.find(source => source.index === index))
    .filter((source): source is ArticleSource => Boolean(source))
}

function getLocalizedPhaseInfo(phase: { mode: string; total_records: number; records_needed: number; message?: string }) {
  const fallback = phaseLabels[phase.mode] ?? phaseLabels.learning

  if (phase.mode === 'cold_start') {
    return {
      title: fallback.label,
      message: `${fallback.desc} Нужно ещё ${phase.records_needed} дн. наблюдений, чтобы перейти к следующему этапу.`,
      qualityHint: fallback.qualityHint,
    }
  }

  if (phase.mode === 'learning') {
    return {
      title: fallback.label,
      message: `${fallback.desc} Нужно ещё ${phase.records_needed} дн., чтобы включить полностью персональную модель.`,
      qualityHint: fallback.qualityHint,
    }
  }

  return {
    title: fallback.label,
    message: fallback.desc,
    qualityHint: fallback.qualityHint,
  }
}

function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(24)).current
  const scale = useRef(new Animated.Value(0.96)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 60,
        friction: 9,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 9,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, index, scale, translateY])

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  )
}

function StatCard({
  icon,
  value,
  label,
  color,
  index,
}: {
  icon: keyof typeof Ionicons.glyphMap
  value: string | number
  label: string
  color: string
  index: number
}) {
  const styles = useThemedStyles(createStyles)
  const scaleAnim = useRef(new Animated.Value(1)).current

  return (
    <AnimatedCard index={index} style={styles.statCardWrapper}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start()}
      >
        <Animated.View style={[styles.statCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.statIconBg, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  )
}

const SOURCE_LABELS: Record<NonNullable<NonNullable<Recommendation['trigger_signal']>['source']>, string> = {
  rule:        'правило',
  ml_shap:     'ML (SHAP)',
  llm:         'LLM',
  consistency: 'расхождение в данных',
  fallback:    'резерв',
}

function WhyBlock({ rec }: { rec: Recommendation }) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const ts = rec.trigger_signal
  if (!ts && !rec.rule_id) return null

  const fmt = (v?: number | null, digits = 1) =>
    v == null || !Number.isFinite(v) ? '—' : v.toFixed(digits)

  const confColor =
    ts?.confidence === 'high'   ? colors.success :
    ts?.confidence === 'medium' ? colors.warning :
    ts?.confidence === 'low'    ? colors.destructive :
    colors.mutedForeground

  const confLabel =
    ts?.confidence === 'high'   ? 'Высокая' :
    ts?.confidence === 'medium' ? 'Средняя' :
    ts?.confidence === 'low'    ? 'Низкая'  : null

  return (
    <View style={styles.whyWrap}>
      <TouchableOpacity
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setOpen(o => !o)
        }}
        activeOpacity={0.7}
        style={styles.whyToggle}
      >
        <Ionicons name="analytics-outline" size={14} color={colors.mutedForeground} />
        <Text style={styles.whyToggleText}>Почему мы это советуем</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.mutedForeground}
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>
      {open ? (
        <View style={styles.whyBox}>
          {ts?.source ? (
            <Text style={styles.whyLine}>
              <Text style={styles.whyLabel}>Источник: </Text>
              <Text style={styles.whyValue}>{SOURCE_LABELS[ts.source]}</Text>
              {rec.rule_id ? (
                <Text style={styles.whyMuted}>{` (${rec.rule_id})`}</Text>
              ) : null}
            </Text>
          ) : rec.rule_id ? (
            <Text style={styles.whyLine}>
              <Text style={styles.whyLabel}>rule_id: </Text>
              <Text style={styles.whyValue}>{rec.rule_id}</Text>
            </Text>
          ) : null}

          {ts?.current_value != null ? (
            <Text style={styles.whyLine}>
              <Text style={styles.whyLabel}>Сейчас: </Text>
              <Text style={styles.whyValue}>{fmt(ts.current_value)}</Text>
              {ts.personal_baseline != null ? (
                <>
                  <Text style={styles.whyLabel}>{' · твоя норма за 30 дней: '}</Text>
                  <Text style={styles.whyValue}>{fmt(ts.personal_baseline)}</Text>
                </>
              ) : null}
            </Text>
          ) : null}

          {ts?.z_score != null ? (
            <Text style={styles.whyLine}>
              <Text style={styles.whyLabel}>Отклонение от нормы: </Text>
              <Text style={styles.whyValue}>{(ts.z_score >= 0 ? '+' : '') + fmt(ts.z_score, 2)}σ</Text>
            </Text>
          ) : null}

          {ts?.shap_contribution != null ? (
            <Text style={styles.whyLine}>
              <Text style={styles.whyLabel}>Вклад в прогноз настроения: </Text>
              <Text style={styles.whyValue}>{(ts.shap_contribution >= 0 ? '+' : '') + fmt(ts.shap_contribution, 2)}</Text>
            </Text>
          ) : null}

          {confLabel ? (
            <Text style={styles.whyLine}>
              <Text style={styles.whyLabel}>Уверенность: </Text>
              <Text style={[styles.whyValue, { color: confColor }]}>{confLabel}</Text>
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function RecommendationCard({
  rec,
  sources,
  index,
  isExpanded,
  onToggle,
}: {
  rec: Recommendation
  sources: ArticleSource[]
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const metricConfig = useMemo(() => buildMetricConfig(colors), [colors])
  const severityConfig = useMemo(() => buildSeverityConfig(colors), [colors])
  const metric = metricConfig[rec.metric] ?? metricConfig.mood
  const severity = severityConfig[rec.severity] ?? severityConfig.good
  const referencedSources = getReferencedSources(rec.description, sources)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const chevronAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [chevronAnim, isExpanded])

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onToggle()
  }

  return (
    <AnimatedCard index={index}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start()}
      >
        <Animated.View style={[styles.recCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.recAccent, { backgroundColor: severity.color }]} />

          <View style={styles.recContent}>
            <View style={styles.recHeader}>
              <View style={[styles.recIconContainer, { backgroundColor: metric.bgColor }]}>
                <Ionicons name={metric.icon} size={22} color={metric.color} />
              </View>

              <View style={styles.recHeaderText}>
                <View style={styles.recMetricRow}>
                  <Text style={[styles.recMetricLabel, { color: metric.color }]}>{metric.label}</Text>
                  <View style={[styles.severityBadge, { backgroundColor: severity.bgColor }]}>
                    <Ionicons name={severity.icon} size={10} color={severity.color} />
                    <Text style={[styles.severityText, { color: severity.color }]}>{severity.label}</Text>
                  </View>
                </View>
                <Text style={styles.recTitle} numberOfLines={isExpanded ? undefined : 2}>{rec.title}</Text>
                <Text style={styles.recReason}>{getReasonText(rec)}</Text>
              </View>

              <Animated.View style={{ alignSelf: 'center', transform: [{ rotate: chevronRotate }] }}>
                <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
              </Animated.View>
            </View>

            {isExpanded ? (
              <>
                <Text style={styles.recDescription}>{rec.description}</Text>

                <WhyBlock rec={rec} />

                {referencedSources.length > 0 ? (
                  <View style={styles.citationsWrap}>
                    <Text style={styles.citationsLabel}>Источники:</Text>
                    <View style={styles.citationsList}>
                      {referencedSources.map(source => (
                        <TouchableOpacity
                          key={`${source.index}-${source.pmid}`}
                          style={styles.citationChip}
                          onPress={() => Linking.openURL(source.url).catch(() => undefined)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.citationChipText}>[{source.index}]</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
                <FeedbackButtons rec={rec} />

                <View style={styles.recFooter}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
                  <Text style={styles.recAction}>Ссылки на исследования доступны внизу экрана.</Text>
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </AnimatedCard>
  )
}

/**
 * Кнопки оценки рекомендации в мобильной карточке. Отдельный компонент,
 * чтобы локальное состояние (отправлено / в процессе / ошибка) не вызывало
 * перерендер всей карточки. После успешной отправки кнопки заменяются на
 * текст подтверждения; повторно оценить можно после рефреша списка.
 */
function FeedbackButtons({ rec }: { rec: Recommendation }) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const [submitted, setSubmitted] = useState<FeedbackRating | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ruleId = (rec as Recommendation & { rule_id?: string | null }).rule_id
    || `llm.${(rec as Recommendation & { id?: string }).id ?? 'unknown'}`

  const handle = async (rating: FeedbackRating) => {
    if (submitted || isSending) return
    setIsSending(true)
    setError(null)
    try {
      await submitRecommendationFeedback({
        ruleId,
        rating,
        recommendationSnapshot: rec as unknown as Record<string, unknown>,
      })
      setSubmitted(rating)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить оценку')
    } finally {
      setIsSending(false)
    }
  }

  if (submitted) {
    return (
      <View style={styles.feedbackBlock}>
        <Text style={styles.feedbackAck}>
          Спасибо за оценку — это поможет нам улучшать рекомендации.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.feedbackBlock}>
      <Text style={styles.feedbackLabel}>Полезна?</Text>
      <View style={styles.feedbackButtons}>
        <TouchableOpacity
          style={[styles.feedbackButton, isSending ? styles.feedbackButtonDisabled : null]}
          disabled={isSending}
          onPress={() => handle('helpful')}
          activeOpacity={0.8}
        >
          <Ionicons name="thumbs-up-outline" size={14} color={colors.foreground} />
          <Text style={styles.feedbackButtonText}>Да</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedbackButton, isSending ? styles.feedbackButtonDisabled : null]}
          disabled={isSending}
          onPress={() => handle('not_helpful')}
          activeOpacity={0.8}
        >
          <Ionicons name="thumbs-down-outline" size={14} color={colors.foreground} />
          <Text style={styles.feedbackButtonText}>Нет</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={styles.feedbackError}>{error}</Text>
      ) : null}
    </View>
  )
}

function SectionHeader({
  icon,
  title,
  color,
  count,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  color: string
  count: number
}) {
  const styles = useThemedStyles(createStyles)
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionIcon, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={[styles.countBadge, { backgroundColor: `${color}15` }]}>
        <Text style={[styles.countText, { color }]}>{count}</Text>
      </View>
    </View>
  )
}

function SourceItem({ source, index }: { source: ArticleSource; index: number }) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  const openSource = async () => {
    try {
      await Linking.openURL(source.url)
    } catch {
      // no-op: opening errors should not break the screen
    }
  }

  return (
    <TouchableOpacity style={styles.sourceCard} onPress={openSource} activeOpacity={0.8}>
      <View style={styles.sourceHeader}>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>[{source.index || index + 1}]</Text>
        </View>
        <View style={styles.sourceMetaWrap}>
          <Text style={styles.sourceMeta}>PMID {source.pmid} • {source.year || 'без года'}</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.primary} />
      </View>
      <Text style={styles.sourceTitle}>{source.title}</Text>
      <Text style={styles.sourceLink}>Открыть источник</Text>
    </TouchableOpacity>
  )
}

function SourcesSection({ sources }: { sources: ArticleSource[] }) {
  const styles = useThemedStyles(createStyles)
  const [expanded, setExpanded] = useState(false)

  if (sources.length === 0) return null

  return (
    <AnimatedCard index={90} style={styles.sourcesSection}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setExpanded(prev => !prev)
        }}
      >
        <View style={styles.sourcesHeader}>
          <View style={styles.sourcesHeaderLeft}>
            <View style={styles.sourcesIconWrap}>
              <Ionicons name="book-outline" size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.sourcesTitle}>Источники ({sources.length})</Text>
              <Text style={styles.sourcesSubtitle}>Научные публикации, на которые опираются персональные рекомендации.</Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.sourcesList}>
          {sources.map((source, index) => (
            <SourceItem key={`${source.index}-${source.pmid}-${index}`} source={source} index={index} />
          ))}
        </View>
      ) : null}
    </AnimatedCard>
  )
}

export default function RecommendationsScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const router = useRouter()
  const token = useAuthStore(state => state.token)
  const isAuthReady = useAuthStore(state => state.isReady)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const headerFade = useRef(new Animated.Value(0)).current
  const headerTranslate = useRef(new Animated.Value(-15)).current
  const refreshRotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerTranslate, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start()
  }, [headerFade, headerTranslate])

  const { data: insights, isLoading, isError, refetch } = useQuery({
    queryKey: ['insights'],
    queryFn: getInsights,
    enabled: isAuthReady && !!token,
    staleTime: 1000 * 60 * 5,
  })

  async function onRefresh() {
    Animated.loop(
      Animated.timing(refreshRotation, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start()

    setRefreshing(true)
    await refetch()
    setRefreshing(false)

    refreshRotation.stopAnimation()
    refreshRotation.setValue(0)
  }

  const recommendations = insights?.recommendations ?? []
  const sources = insights?.sources ?? []
  const alertRecs = recommendations.filter(rec => rec.severity === 'alert')
  const attentionRecs = recommendations.filter(rec => rec.severity === 'attention')
  const goodRecs = recommendations.filter(rec => rec.severity === 'good')
  const localizedPhase = insights?.phase ? getLocalizedPhaseInfo(insights.phase) : null

  const spin = refreshRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  let cardIndex = 10

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerTranslate }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <View style={styles.backButtonInner}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerIconWrapper}>
            <Ionicons name="sparkles" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Рекомендации</Text>
            <Text style={styles.headerSubtitle}>
              {recommendations.length} {recommendations.length === 1 ? 'совет' : recommendations.length >= 2 && recommendations.length <= 4 ? 'совета' : 'советов'} для вас
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="refresh" size={20} color={colors.foreground} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {insights?.anomalyReport ? (
          <View style={styles.anomalyWrap}>
            <AnomalyBanner report={insights.anomalyReport} />
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard
            icon="trending-up"
            value={insights?.predicted_mood != null ? insights.predicted_mood.toFixed(1) : '—'}
            label="Прогноз дня"
            color={colors.primary}
            index={0}
          />
          <StatCard icon="alert-circle" value={alertRecs.length} label="Критично" color={colors.destructive} index={1} />
          <StatCard icon="warning" value={attentionRecs.length} label="Улучшить" color={colors.warning} index={2} />
          <StatCard icon="checkmark-circle" value={goodRecs.length} label="В норме" color={colors.success} index={3} />
        </View>

        {insights?.phase ? (
          <AnimatedCard index={4} style={styles.phaseCard}>
            <View style={styles.phaseContent}>
              <View style={styles.phaseHeader}>
                <View style={styles.phaseIconWrapper}>
                  <Ionicons name="flash" size={16} color={colors.primary} />
                </View>
                <View style={styles.phaseTextWrapper}>
                  <Text style={styles.phaseTitle}>
                    {localizedPhase?.title}
                  </Text>
                  <Text style={styles.phaseSubtitle}>
                    {insights.phase.total_records} из {insights.phase.total_records + insights.phase.records_needed} дней
                  </Text>
                </View>
              </View>
              <View style={styles.progressWrapper}>
                <ProgressBar
                  progress={
                    insights.phase.total_records + insights.phase.records_needed > 0
                      ? (insights.phase.total_records / (insights.phase.total_records + insights.phase.records_needed)) * 100
                      : 0
                  }
                  height={6}
                />
              </View>
              <Text style={styles.phaseMessage}>{localizedPhase?.message}</Text>
              <Text style={styles.phaseHint}>{localizedPhase?.qualityHint}</Text>
            </View>
          </AnimatedCard>
        ) : null}

        {isError ? (
          <AnimatedCard index={5} style={styles.errorCard}>
            <View style={styles.errorContent}>
              <View style={styles.errorIconWrapper}>
                <Ionicons name="cloud-offline" size={24} color={colors.destructive} />
              </View>
              <Text style={styles.errorTitle}>Ошибка загрузки</Text>
              <Text style={styles.errorText}>Не удалось загрузить рекомендации. Проверьте соединение и попробуйте снова.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRefresh} activeOpacity={0.8}>
                <Text style={styles.retryText}>Повторить</Text>
              </TouchableOpacity>
            </View>
          </AnimatedCard>
        ) : null}

        {!isLoading && recommendations.length === 0 && !isError ? (
          <AnimatedCard index={6} style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="sparkles" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Пока нет рекомендаций</Text>
              <Text style={styles.emptyText}>
                Продолжайте добавлять данные о здоровье, и скоро здесь появятся персональные советы.
              </Text>
            </View>
          </AnimatedCard>
        ) : null}

        {alertRecs.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader icon="alert-circle" title="Требует внимания" color={colors.destructive} count={alertRecs.length} />
            {alertRecs.map((rec, index) => {
              const key = `alert-${index}`
              return (
                <RecommendationCard
                  key={key}
                  rec={rec}
                  sources={sources}
                  index={cardIndex++}
                  isExpanded={expandedKey === key}
                  onToggle={() => setExpandedKey(prev => (prev === key ? null : key))}
                />
              )
            })}
          </View>
        ) : null}

        {attentionRecs.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader icon="warning" title="Можно улучшить" color={colors.warning} count={attentionRecs.length} />
            {attentionRecs.map((rec, index) => {
              const key = `attention-${index}`
              return (
                <RecommendationCard
                  key={key}
                  rec={rec}
                  sources={sources}
                  index={cardIndex++}
                  isExpanded={expandedKey === key}
                  onToggle={() => setExpandedKey(prev => (prev === key ? null : key))}
                />
              )
            })}
          </View>
        ) : null}

        {goodRecs.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader icon="checkmark-circle" title="Хорошие показатели" color={colors.success} count={goodRecs.length} />
            {goodRecs.map((rec, index) => {
              const key = `good-${index}`
              return (
                <RecommendationCard
                  key={key}
                  rec={rec}
                  sources={sources}
                  index={cardIndex++}
                  isExpanded={expandedKey === key}
                  onToggle={() => setExpandedKey(prev => (prev === key ? null : key))}
                />
              )
            })}
          </View>
        ) : null}

        <SourcesSection sources={sources} />

        {insights?.disclaimer ? (
          <View style={styles.disclaimerBox}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.disclaimerText}>{insights.disclaimer}</Text>
          </View>
        ) : null}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  anomalyWrap: {
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  phaseCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  phaseContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  phaseIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTextWrapper: {
    flex: 1,
  },
  phaseTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  phaseSubtitle: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  phaseMessage: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  phaseHint: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    lineHeight: 18,
    marginTop: -4,
  },
  progressWrapper: {
    paddingHorizontal: 4,
  },
  errorCard: {
    backgroundColor: colors.destructiveMuted,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: `${colors.destructive}30`,
    marginBottom: Spacing.lg,
  },
  errorContent: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.destructive}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  errorTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.destructive,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  retryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.lg,
  },
  emptyContent: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  section: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  recCard: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  recAccent: {
    height: 3,
    width: '100%',
  },
  recContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  recHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  recIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recHeaderText: {
    flex: 1,
    gap: 4,
  },
  recMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recMetricLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: colors.foreground,
    lineHeight: 22,
  },
  recReason: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    lineHeight: 18,
    marginTop: 2,
  },
  recDescription: {
    fontSize: FontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  citationsWrap: {
    gap: 8,
  },
  citationsLabel: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    fontWeight: FontWeight.medium,
  },
  citationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  citationChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.cardHover,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  citationChipText: {
    fontSize: FontSize.xs,
    color: colors.primary,
    fontWeight: FontWeight.semibold,
  },
  recFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recAction: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    fontWeight: FontWeight.medium,
  },
  feedbackBlock: {
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feedbackLabel: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    fontWeight: FontWeight.medium,
    marginBottom: 6,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  feedbackButtonDisabled: {
    opacity: 0.5,
  },
  feedbackButtonText: {
    fontSize: FontSize.xs,
    color: colors.foreground,
    fontWeight: FontWeight.medium,
  },
  feedbackAck: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
  },
  feedbackError: {
    marginTop: 6,
    fontSize: FontSize.xs,
    color: colors.destructive,
  },
  sourcesSection: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  sourcesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  sourcesIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcesTitle: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  sourcesSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.xs,
    marginTop: 2,
    maxWidth: 240,
  },
  sourcesList: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sourceCard: {
    backgroundColor: colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primaryMuted,
  },
  sourceBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  sourceMetaWrap: {
    flex: 1,
  },
  sourceMeta: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
  },
  sourceTitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
    fontWeight: FontWeight.medium,
  },
  sourceLink: {
    fontSize: FontSize.xs,
    color: colors.primary,
    fontWeight: FontWeight.semibold,
  },
  whyWrap: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  whyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  whyToggleText: {
    fontSize: FontSize.xs,
    color: colors.mutedForeground,
    fontWeight: FontWeight.medium,
  },
  whyBox: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    gap: 4,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.cardHover,
  },
  whyLine: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    color: colors.foreground,
  },
  whyLabel: {
    color: colors.mutedForeground,
  },
  whyValue: {
    color: colors.foreground,
    fontWeight: FontWeight.medium,
  },
  whyMuted: {
    color: colors.mutedForeground,
    fontSize: FontSize.xs,
  },
  disclaimerBox: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    flex: 1,
    fontSize: FontSize.xs,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
})
