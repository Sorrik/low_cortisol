// mobile/components/ui/PhotoPicker.tsx
// Универсальный выбор фото: камера / галерея → base64 + превью.
// Используется в add-nutrition для AI-распознавания блюд.

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Camera as CameraIcon, Image as ImageIcon } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'

export interface PhotoResult {
  base64: string
  mimeType: string
  uri: string
}

interface Props {
  onPick: (photo: PhotoResult) => void
  disabled?: boolean
}

export function PhotoPicker({ onPick, disabled }: Props) {
  const [loading, setLoading] = useState<'camera' | 'gallery' | null>(null)

  async function ensurePermission(kind: 'camera' | 'gallery'): Promise<boolean> {
    if (kind === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Нет доступа к камере', 'Разрешите доступ в настройках телефона.')
        return false
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Нет доступа к галерее', 'Разрешите доступ в настройках телефона.')
        return false
      }
    }
    return true
  }

  async function handlePick(kind: 'camera' | 'gallery') {
    if (disabled || loading) return

    const ok = await ensurePermission(kind)
    if (!ok) return

    setLoading(kind)
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      }

      const result =
        kind === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options)

      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset?.base64) {
        Alert.alert('Ошибка', 'Не удалось получить фото')
        return
      }

      const mimeType = asset.mimeType || inferMime(asset.uri)
      onPick({ base64: asset.base64, mimeType, uri: asset.uri })
    } finally {
      setLoading(null)
    }
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
        onPress={() => handlePick('camera')}
        disabled={disabled || !!loading}
      >
        {loading === 'camera' ? (
          <ActivityIndicator color="#a3e635" />
        ) : (
          <>
            <CameraIcon size={18} color="#a3e635" />
            <Text style={styles.btnText}>Сфоткать</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
        onPress={() => handlePick('gallery')}
        disabled={disabled || !!loading}
      >
        {loading === 'gallery' ? (
          <ActivityIndicator color="#a3e635" />
        ) : (
          <>
            <ImageIcon size={18} color="#a3e635" />
            <Text style={styles.btnText}>Из галереи</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  )
}

function inferMime(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(163,230,53,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.3)',
    borderRadius: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 14, fontWeight: '600', color: '#a3e635' },
})
