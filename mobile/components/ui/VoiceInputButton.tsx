// mobile/components/ui/VoiceInputButton.tsx
// Кнопка "тап и держи → запись, отпустил → отправка на /ai/voice-to-form".
// Визуал: Mic в idle, пульсирующая точка при записи, spinner при отправке.

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated } from 'react-native'
import { Mic, Square } from 'lucide-react-native'
import { Audio } from 'expo-av'

import { voiceToForm, type VoiceContext, type VoiceResponse } from '@/lib/health-api'

interface Props<T> {
  context: VoiceContext
  onResult: (result: VoiceResponse<T>) => void
  disabled?: boolean
  hint?: string
}

export function VoiceInputButton<T = Record<string, any>>({
  context,
  onResult,
  disabled,
  hint,
}: Props<T>) {
  const [state, setState] = useState<'idle' | 'recording' | 'sending'>('idle')
  const recordingRef = useRef<Audio.Recording | null>(null)
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (state === 'recording') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      )
      loop.start()
      return () => loop.stop()
    }
    pulse.setValue(1)
  }, [state, pulse])

  const startRecording = useCallback(async () => {
    if (disabled || state !== 'idle') return
    try {
      const perm = await Audio.requestPermissionsAsync()
      if (perm.status !== 'granted') {
        Alert.alert('Нет доступа к микрофону', 'Разрешите доступ в настройках.')
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const rec = new Audio.Recording()
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await rec.startAsync()
      recordingRef.current = rec
      setState('recording')
    } catch (err) {
      console.error('recording start failed', err)
      Alert.alert('Ошибка', 'Не удалось начать запись')
      setState('idle')
    }
  }, [disabled, state])

  const stopRecording = useCallback(async () => {
    const rec = recordingRef.current
    if (!rec || state !== 'recording') return

    setState('sending')
    recordingRef.current = null

    try {
      await rec.stopAndUnloadAsync()
      const uri = rec.getURI()
      if (!uri) throw new Error('no uri')

      const result = await voiceToForm<any>(uri, context)
      if (!result.transcript) {
        Alert.alert('Не распознано', 'Речь не услышана. Попробуйте ещё раз ближе к микрофону.')
        return
      }

      const confidence = (result.fields as any)?.confidence ?? 0
      if (confidence < 0.3) {
        Alert.alert(
          'Слабая уверенность',
          `Распознано: "${result.transcript}"\n\nМожно попробовать переформулировать.`,
          [
            { text: 'Переписать', style: 'cancel' },
            { text: 'Всё равно использовать', onPress: () => onResult(result) },
          ],
        )
        return
      }

      onResult(result)
    } catch (err) {
      console.error('voice flow failed', err)
      Alert.alert('Ошибка', 'Не удалось обработать запись. Проверьте соединение.')
    } finally {
      setState('idle')
    }
  }, [context, onResult, state])

  const isBusy = state !== 'idle'

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.btn,
          state === 'recording' && styles.btnRecording,
          (disabled || state === 'sending') && styles.btnDisabled,
        ]}
        onPressIn={startRecording}
        onPressOut={stopRecording}
        disabled={disabled || state === 'sending'}
        activeOpacity={0.85}
      >
        {state === 'sending' ? (
          <ActivityIndicator color="#a3e635" />
        ) : state === 'recording' ? (
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Square size={16} color="#ef4444" fill="#ef4444" />
          </Animated.View>
        ) : (
          <Mic size={18} color="#a3e635" />
        )}
        <Text style={[styles.btnText, state === 'recording' && styles.btnTextRecording]}>
          {state === 'recording'
            ? 'Говорите… (отпустите для отправки)'
            : state === 'sending'
              ? 'Распознаю…'
              : 'Голосом'}
        </Text>
      </TouchableOpacity>

      {hint && !isBusy && <Text style={styles.hint}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(163,230,53,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.3)',
  },
  btnRecording: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.5)',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 14, fontWeight: '600', color: '#a3e635' },
  btnTextRecording: { color: '#ef4444' },
  hint: { fontSize: 11, color: '#6b7280', marginTop: 6, textAlign: 'center' },
})
