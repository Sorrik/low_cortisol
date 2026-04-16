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

import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme'
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

const Badge = ({ children, variant = 'secondary' }: { children: React.ReactNode; variant?: 'default' | 'secondary' }) => (
  <View style={[styles.badge, variant === 'default' ? styles.badgePrimary : styles.badgeSecondary]}>
    <Text style={[styles.badgeText, variant === 'default' ? styles.badgeTextPrimary : styles.badgeTextSecondary]}>
      {children}
    </Text>
  </View>
)

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${Math.min(Math.max(progress, 0), 100)}%` }]} />
    </View>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const { signOut } = useAuth()
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
        <ActivityIndicator color={Colors.primary} size="large" />
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
                <Ionicons name="pencil" size={16} color={Colors.primary} />
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
            <View>
              <Text style={styles.name}>
                {profile?.firstName} {profile?.lastName}
              </Text>
              <Text style={styles.email}>{profile?.email}</Text>
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
                <Ionicons name="flag" size={18} color={Colors.primary} />
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
                <Ionicons name="refresh" size={18} color={Colors.primary} />
                <Text style={{ marginLeft: 8, fontWeight: '600' }}>Пройти анкету заново</Text>
              </Button>
            </View>
          </View>
        )}

        <Button variant="destructive" onPress={handleLogout} style={styles.logoutButton}>
          Выйти
        </Button>

        <Text style={styles.version}>LowCor v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.foreground, marginBottom: Spacing.lg },

  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.foreground },

  accountHero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryMuted, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700', color: Colors.primary },

  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.foreground },
  email: { fontSize: FontSize.sm, color: Colors.mutedForeground },

  editBtn: { flexDirection: 'row', alignItems: 'center' },
  editBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },

  infoRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.mutedForeground, marginBottom: 2 },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.foreground },

  section: { marginTop: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.foreground },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgePrimary: { backgroundColor: Colors.primary },
  badgeSecondary: { backgroundColor: Colors.secondary },
  badgeText: { fontSize: 13, fontWeight: '600' },
  badgeTextPrimary: { color: '#fff' },
  badgeTextSecondary: { color: Colors.mutedForeground },

  stressSection: { marginTop: Spacing.xl, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border },
  stressLarge: { fontSize: 42, fontWeight: '700', marginBottom: 4 },
  stressLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  small: { fontSize: FontSize.xs, color: Colors.mutedForeground },

  miniLink: { 
    fontSize: FontSize.sm, 
    color: Colors.primary, 
    fontWeight: '600' 
  },

  reSurveyContainer: { marginTop: Spacing.xl, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border },
  reSurveyText: { fontSize: FontSize.sm, color: Colors.mutedForeground, marginBottom: Spacing.md },
  reSurveyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },

  progressBar: { height: 6, backgroundColor: Colors.secondary, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: Colors.primary },

  logoutButton: { marginTop: Spacing.lg },
  version: { textAlign: 'center', color: Colors.mutedForeground, fontSize: 10, marginTop: Spacing.xl },
})