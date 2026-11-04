// app/(tabs)/profile.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'

import { Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext'
import { 
  getProfile, 
  updateProfile, 
  getUserLevel, 
  getFullStreakData 
} from '@/lib/health-api'

import { getOnboardingProfile, updateStress } from '@/lib/onboarding-api'
import { 
  GOAL_CONFIG, 
  CHRONOTYPE_CONFIG, 
  ACTIVITY_CONFIG 
} from '@/types/onboarding'

import { Button } from '@/components/ui/Button'

function Badge({ children, variant = 'secondary' }: { children: React.ReactNode; variant?: 'default' | 'secondary' }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.badge, variant === 'default' ? styles.badgePrimary : styles.badgeSecondary]}>
      <Text style={[styles.badgeText, variant === 'default' ? styles.badgeTextPrimary : styles.badgeTextSecondary]}>
        {children}
      </Text>
    </View>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${Math.min(Math.max(progress, 0), 100)}%` }]} />
    </View>
  )
}

export default function ProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter()
  const { signOut } = useAuth()
  const { theme, setTheme, isDark } = useTheme()
  const queryClient = useQueryClient()

  const [editingAccount, setEditingAccount] = useState(false)
  const [accountDraft, setAccountDraft] = useState<any>({})
  const [editingStress, setEditingStress] = useState(false)
  const [stressDraft, setStressDraft] = useState(5)

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  })

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: getOnboardingProfile,
  })

  const { data: levelInfo } = useQuery({ queryKey: ['userLevel'], queryFn: getUserLevel })
  const { data: streakData } = useQuery({ queryKey: ['fullStreak'], queryFn: getFullStreakData })

  const updateAccountMutation = useMutation({
    mutationFn: (updates: any) => updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setEditingAccount(false)
    },
  })

  const updateStressMutation = useMutation({
    mutationFn: (stress: number) => updateStress(stress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      setEditingStress(false)
    },
  })

  const startEditAccount = () => {
    setAccountDraft({
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      email: profile?.email,
      birthDate: profile?.birthDate,
    })
    setEditingAccount(true)
  }

  const handleLogout = () => {
    Alert.alert('Выйти', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: signOut },
    ])
  }

  const stressColor = (v: number) => (v <= 4 ? '#34d399' : v <= 6 ? '#fbbf24' : '#f87171')

  const stressLabel = (v: number) => {
    if (v <= 2) return 'Очень низкий'
    if (v <= 4) return 'Низкий'
    if (v <= 6) return 'Умеренный'
    if (v <= 8) return 'Высокий'
    return 'Очень высокий'
  }

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Профиль</Text>

        {/* Данные аккаунта */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Данные аккаунта</Text>
            {!editingAccount && (
              <TouchableOpacity onPress={startEditAccount} style={styles.editBtn}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
                <Text style={styles.editBtnText}> Изменить</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.accountHero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.firstName?.[0] || 'S').toUpperCase()}
                {(profile?.lastName?.[0] || 'M').toUpperCase()}
              </Text>
            </View>
            <View style={styles.accountHeroText}>
              <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                {profile?.firstName} {profile?.lastName}
              </Text>
              <Text style={styles.email} numberOfLines={1} ellipsizeMode="tail">
                {profile?.email}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Имя</Text>
              <Text style={styles.infoValue}>{profile?.firstName || '—'}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Фамилия</Text>
              <Text style={styles.infoValue}>{profile?.lastName || '—'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile?.email || '—'}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Дата рождения</Text>
              <Text style={styles.infoValue}>{profile?.birthDate || 'дд.мм.гггг'}</Text>
            </View>
          </View>
        </View>

        {/* Личный профиль здоровья */}
        {userProfile?.onboardingCompleted && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Личный профиль здоровья</Text>
              <Badge variant="secondary">Заполнено при регистрации</Badge>
            </View>

            {/* Цели */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flag" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Цели</Text>
              </View>
              <View style={styles.badgeRow}>
                {userProfile.goals?.map((g: string) => (
                  <Badge key={g} variant={userProfile.primaryGoal === g ? 'default' : 'secondary'}>
                    {(GOAL_CONFIG as any)[g]?.label || g}
                    {userProfile.primaryGoal === g && ' главная'}
                  </Badge>
                ))}
              </View>
            </View>

            {/* Режим сна */}
            {userProfile.chronotype && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="moon" size={18} color="#6366f1" />
                  <Text style={styles.sectionTitle}>Режим сна</Text>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Хронотип</Text>
                    <Text style={styles.infoValue}>
                      {(CHRONOTYPE_CONFIG as any)[userProfile.chronotype]?.label || '—'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Активность */}
            {userProfile.activityLevel && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="fitness" size={18} color="#f59e0b" />
                  <Text style={styles.sectionTitle}>Активность</Text>
                </View>
                <Text style={styles.infoValue}>
                  {(ACTIVITY_CONFIG as any)[userProfile.activityLevel]?.label || '—'}
                </Text>
              </View>
            )}

            {/* Базовый стресс */}
            {userProfile.baselineStress != null && (
              <View style={styles.stressSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="pulse" size={18} color="#ef4444" />
                  <Text style={styles.sectionTitle}>Базовый уровень стресса</Text>
                  {!editingStress && (
                    <TouchableOpacity 
                      onPress={() => {
                        setStressDraft(userProfile.baselineStress || 5)
                        setEditingStress(true)
                      }}
                    >
                      <Text style={styles.miniLink}>Обновить</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {editingStress ? (
                  <View>
                    <Text style={[styles.stressLarge, { color: stressColor(stressDraft) }]}>
                      {stressDraft}
                    </Text>
                    <Text style={[styles.stressLabel, { color: stressColor(stressDraft) }]}>
                      {stressLabel(stressDraft)}
                    </Text>
                    <View style={styles.buttonRow}>
                      <Button variant="outline" onPress={() => setEditingStress(false)}>Отмена</Button>
                      <Button onPress={() => updateStressMutation.mutate(stressDraft)}>Сохранить</Button>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.stressLarge, { color: stressColor(userProfile.baselineStress) }]}>
                    {userProfile.baselineStress}
                    <Text style={styles.small}>/10 — {stressLabel(userProfile.baselineStress)}</Text>
                  </Text>
                )}
              </View>
            )}

            {/* Пройти анкету заново */}
            <View style={styles.reSurveyContainer}>
              <Text style={styles.reSurveyText}>
                Хотите обновить цели, режим сна или активность?
              </Text>
              <Button
                variant="outline"
                onPress={() => router.push('/onboarding')}
                style={styles.reSurveyButton}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <Text style={{ marginLeft: 8, fontWeight: '600' }}>Пройти анкету заново</Text>
              </Button>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Внешний вид</Text>
          </View>
          <View style={styles.themeRow}>
            <TouchableOpacity
              onPress={() => setTheme('light')}
              activeOpacity={0.8}
              style={[styles.themeOption, !isDark && styles.themeOptionActive]}
            >
              <Ionicons
                name="sunny"
                size={20}
                color={!isDark ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.themeOptionText, !isDark && styles.themeOptionTextActive]}>
                Светлая
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTheme('dark')}
              activeOpacity={0.8}
              style={[styles.themeOption, isDark && styles.themeOptionActive]}
            >
              <Ionicons
                name="moon"
                size={20}
                color={isDark ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.themeOptionText, isDark && styles.themeOptionTextActive]}>
                Тёмная
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button variant="destructive" onPress={handleLogout} style={styles.logoutButton}>
          Выйти
        </Button>

        <Text style={styles.version}>LowCor v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: Spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.foreground, marginBottom: Spacing.lg },

  card: {
    backgroundColor: colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.foreground },

  accountHero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  accountHeroText: { flex: 1, minWidth: 0 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.primary },

  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.foreground },
  email: { fontSize: FontSize.sm, color: colors.mutedForeground },

  editBtn: { flexDirection: 'row', alignItems: 'center' },
  editBtnText: { color: colors.primary, fontSize: FontSize.sm, fontWeight: '600' },

  infoRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: colors.mutedForeground, marginBottom: 2 },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: colors.foreground },

  section: { marginTop: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: colors.foreground },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgePrimary: { backgroundColor: colors.primary },
  badgeSecondary: { backgroundColor: colors.secondary },
  badgeText: { fontSize: 13, fontWeight: '600' },
  badgeTextPrimary: { color: '#fff' },
  badgeTextSecondary: { color: colors.mutedForeground },

  stressSection: { marginTop: Spacing.xl, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  stressLarge: { fontSize: 42, fontWeight: '700', marginBottom: 4 },
  stressLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  small: { fontSize: FontSize.xs, color: colors.mutedForeground },

  miniLink: { 
    fontSize: FontSize.sm, 
    color: colors.primary, 
    fontWeight: '600' 
  },

  reSurveyContainer: { marginTop: Spacing.xl, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  reSurveyText: { fontSize: FontSize.sm, color: colors.mutedForeground, marginBottom: Spacing.md },
  reSurveyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },

  progressBar: { height: 6, backgroundColor: colors.secondary, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: colors.primary },

  logoutButton: { marginTop: Spacing.lg },
  themeRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingTop: 0 },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeOptionActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  themeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.mutedForeground,
  },
  themeOptionTextActive: {
    color: colors.primary,
  },
  version: { textAlign: 'center', color: colors.mutedForeground, fontSize: 10, marginTop: Spacing.xl },
})